// Supabase client for optional cloud accounts + sync.
//
// Kronos is local-first: the entire app works with no account and no Supabase
// project configured. When the two env vars below are present we expose a real
// client; otherwise `supabase` is null and every sync code path short-circuits
// (the Account section in Settings shows a "not configured" note instead).
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        // Persist the session in localStorage and recover it from the magic-link
        // redirect URL automatically (both are supabase-js defaults; spelled out
        // here so the intent is obvious).
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
