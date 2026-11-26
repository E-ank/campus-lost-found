'use client';

import { createBrowserClient } from '@supabase/ssr';

// Client Supabase untuk Client Component (browser).
// Memakai Publishable Key yang aman dipublikasikan karena dilindungi RLS.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
