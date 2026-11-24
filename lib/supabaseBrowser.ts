import { createClient, SupabaseClient } from '@supabase/supabase-js';

let clientInstance: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (clientInstance) return clientInstance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!url || !anonKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local');
  }

  clientInstance = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  });

  return clientInstance;
}

export function detectDeviceLabel(): 'pc' | 'tablet' | 'mobile' {
  if (typeof window === 'undefined') return 'pc';
  const ua = navigator.userAgent.toLowerCase();
  if (/mobi|android.+mobile|iphone|ipod/.test(ua)) return 'mobile';
  if (/ipad|tablet|android(?!.*mobile)/.test(ua)) return 'tablet';
  return 'pc';
}
