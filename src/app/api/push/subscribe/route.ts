import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export interface StoredSub {
  userId?: string | null;
  role?: string | null;
  subscription: PushSubscriptionJSON;
  endpoint: string;
  updatedAt?: string;
}

const memorySubscriptions = new Map<string, StoredSub>();

const ALLOWED_PUSH_HOST_SUFFIXES = [
  '.push.services.mozilla.com',
  '.notify.windows.com',
  '.push.apple.com',
];

const ALLOWED_PUSH_HOSTS = new Set([
  'fcm.googleapis.com',
  'android.googleapis.com',
  'updates.push.services.mozilla.com',
]);

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (!host || /^(\d+\.){3}\d+$/.test(host) || host.includes(':')) return false;
    if (ALLOWED_PUSH_HOSTS.has(host)) return true;
    return ALLOWED_PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
  } catch {
    return false;
  }
}

export function hashEndpoint(endpoint: string): string {
  return crypto.createHash('sha256').update(endpoint).digest('hex');
}

export function getMemorySubscriptions(): StoredSub[] {
  return Array.from(memorySubscriptions.values());
}

export function removeMemoryEndpoints(endpoints: string[]): void {
  for (const ep of endpoints) {
    memorySubscriptions.delete(ep);
  }
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

    const { data: profile } = await supabaseAuth
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.is_active === false) {
      return NextResponse.json({ error: 'Akun dinonaktifkan.' }, { status: 403 });
    }

    let body: { subscription?: PushSubscriptionJSON };
    try {
      body = (await request.json()) as { subscription?: PushSubscriptionJSON };
    } catch {
      return NextResponse.json({ error: 'Format payload tidak valid.' }, { status: 400 });
    }

    const endpoint = body.subscription?.endpoint?.trim() || '';
    const keys = body.subscription?.keys;
    if (
      !endpoint ||
      !isAllowedPushEndpoint(endpoint) ||
      typeof keys?.p256dh !== 'string' ||
      !keys.p256dh.trim() ||
      typeof keys?.auth !== 'string' ||
      !keys.auth.trim()
    ) {
      return NextResponse.json({ error: 'Subscription push tidak valid.' }, { status: 400 });
    }

    const verifiedRole = (profile?.role as string | undefined) || 'MAHASISWA';
    const record: StoredSub = {
      endpoint,
      userId: user.id,
      role: verifiedRole,
      subscription: body.subscription!,
      updatedAt: new Date().toISOString(),
    };

    memorySubscriptions.set(endpoint, record);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && serviceKey) {
      const admin = createAdminClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { error: upsertErr } = await admin.from('push_subscriptions').upsert(
        {
          endpoint,
          user_id: user.id,
          role: verifiedRole,
          subscription: body.subscription,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );

      if (upsertErr) {
        console.warn('Gagal menyimpan push_subscriptions:', upsertErr.message);
      }
    }

    return NextResponse.json({ success: true, count: memorySubscriptions.size });
  } catch (error) {
    console.error('Error saat menyimpan push subscription:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabaseAuth = await createClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Tidak terautentikasi.' }, { status: 401 });
    }

    let endpoint = '';
    try {
      const body = (await request.json()) as { endpoint?: string };
      endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
    } catch {
      endpoint = '';
    }

    if (endpoint) {
      const existing = memorySubscriptions.get(endpoint);
      if (existing && existing.userId === user.id) {
        memorySubscriptions.delete(endpoint);
      }
    } else {
      for (const [key, value] of memorySubscriptions.entries()) {
        if (value.userId === user.id) memorySubscriptions.delete(key);
      }
    }

    let query = supabaseAuth.from('push_subscriptions').delete().eq('user_id', user.id);
    if (endpoint) {
      query = query.eq('endpoint', endpoint);
    }
    await query;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saat menghapus push subscription:', error);
    return NextResponse.json({ error: 'Gagal menghapus langganan push.' }, { status: 500 });
  }
}
