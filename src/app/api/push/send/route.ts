import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT } from '@/lib/push-server';
import { getMemorySubscriptions, isAllowedPushEndpoint, removeMemoryEndpoints } from '../subscribe/route';

interface SendPayload {
  title: string;
  body: string;
  url?: string;
  targetUserId?: string | null;
  targetRole?: string | null;
  tag?: string;
}

const ALLOWED_TARGET_ROLES = new Set(['SATPAM', 'SUPERADMIN', 'MAHASISWA', 'DOSEN']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeUrl(input?: string): string {
  if (!input || !input.startsWith('/') || input.startsWith('//') || input.includes('\\')) {
    return '/';
  }
  return input.slice(0, 200);
}

export async function POST(request: Request) {
  try {
    const supabaseAuth = await createClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Tidak terautentikasi.' }, { status: 401 });
    }

    const { data: requester } = await supabaseAuth
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .maybeSingle();

    if (requester?.is_active === false) {
      return NextResponse.json({ error: 'Akun dinonaktifkan.' }, { status: 403 });
    }

    const isStaffUser = requester?.role === 'SUPERADMIN' || requester?.role === 'SATPAM';

    if (!VAPID_PRIVATE_KEY) {
      return NextResponse.json({
        success: false,
        skipped: true,
        message: 'VAPID_PRIVATE_KEY belum dikonfigurasi di server.',
      });
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    let payload: SendPayload;
    try {
      payload = (await request.json()) as SendPayload;
    } catch {
      return NextResponse.json({ error: 'Format payload tidak valid.' }, { status: 400 });
    }

    const title = String(payload.title || '').trim().slice(0, 120);
    const body = String(payload.body || '').trim().slice(0, 300);

    if (!title || !body) {
      return NextResponse.json({ error: 'Title dan body wajib ada' }, { status: 400 });
    }

    if (payload.targetUserId && !UUID_PATTERN.test(payload.targetUserId)) {
      return NextResponse.json({ error: 'Target user tidak valid.' }, { status: 400 });
    }

    if (payload.targetRole && !ALLOWED_TARGET_ROLES.has(payload.targetRole)) {
      return NextResponse.json({ error: 'Target peran tidak valid.' }, { status: 400 });
    }

    // Pengguna non-petugas dilarang broadcast massal ke seluruh mahasiswa/dosen.
    if (!isStaffUser) {
      if (!payload.targetUserId && !payload.targetRole) {
        return NextResponse.json({ error: 'Target notifikasi wajib ditentukan.' }, { status: 400 });
      }
      if (payload.targetRole && payload.targetRole !== 'SATPAM' && payload.targetRole !== 'SUPERADMIN') {
        return NextResponse.json(
          { error: 'Hanya petugas yang dapat mengirim broadcast ke peran umum.' },
          { status: 403 }
        );
      }
    }

    const targetUrl = sanitizeUrl(payload.url);
    const subsToSend: webpush.PushSubscription[] = [];
    const endpointsToRemove: string[] = [];

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (url && serviceKey) {
      const admin = createAdminClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      try {
        let query = admin.from('push_subscriptions').select('subscription, user_id, role');
        if (payload.targetUserId) {
          query = query.eq('user_id', payload.targetUserId);
        } else if (payload.targetRole) {
          query = query.eq('role', payload.targetRole);
        }
        const { data } = await query;
        if (data && data.length > 0) {
          for (const row of data) {
            const sub = row.subscription as webpush.PushSubscription | undefined;
            if (sub?.endpoint && isAllowedPushEndpoint(sub.endpoint)) {
              subsToSend.push(sub);
            }
          }
        }
      } catch {
        // Fallback ke memori jika tabel belum ada
      }
    }

    const memorySubs = getMemorySubscriptions();
    for (const item of memorySubs) {
      if (!isAllowedPushEndpoint(item.endpoint)) continue;
      if (payload.targetUserId && item.userId === payload.targetUserId) {
        subsToSend.push(item.subscription as webpush.PushSubscription);
      } else if (payload.targetRole && item.role === payload.targetRole) {
        subsToSend.push(item.subscription as webpush.PushSubscription);
      } else if (!payload.targetUserId && !payload.targetRole) {
        subsToSend.push(item.subscription as webpush.PushSubscription);
      }
    }

    const uniqueSubs = new Map<string, webpush.PushSubscription>();
    for (const sub of subsToSend) {
      if (sub && sub.endpoint) {
        uniqueSubs.set(sub.endpoint, sub);
      }
    }

    const notifId = payload.tag || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const notificationPayload = JSON.stringify({
      id: notifId,
      title,
      body,
      url: targetUrl,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: notifId,
    });

    let deliveredCount = 0;
    let failedCount = 0;

    const sendPromises = Array.from(uniqueSubs.values()).map(async (sub) => {
      try {
        await webpush.sendNotification(sub, notificationPayload, {
          TTL: 86400,
          urgency: 'high',
        });
        deliveredCount += 1;
      } catch (err: unknown) {
        failedCount += 1;
        const error = err as { statusCode?: number };
        if (error.statusCode === 404 || error.statusCode === 410) {
          endpointsToRemove.push(sub.endpoint);
        }
      }
    });

    await Promise.allSettled(sendPromises);

    if (endpointsToRemove.length > 0) {
      removeMemoryEndpoints(endpointsToRemove);
      if (url && serviceKey) {
        try {
          const admin = createAdminClient(url, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          await admin.from('push_subscriptions').delete().in('endpoint', endpointsToRemove);
        } catch {
          // Abaikan
        }
      }
    }

    return NextResponse.json({
      success: deliveredCount > 0 || uniqueSubs.size === 0,
      deliveredToCount: deliveredCount,
      failedCount,
    });
  } catch (error) {
    console.error('Error saat mengirim background web push:', error);
    return NextResponse.json({ error: 'Gagal mengirim push' }, { status: 500 });
  }
}
