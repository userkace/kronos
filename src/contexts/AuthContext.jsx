import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import * as sync from '../utils/syncEngine';

const AuthContext = createContext();

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

// Owns optional cloud accounts (magic-link auth) AND drives the sync engine.
// Everything is a no-op when Supabase isn't configured, so the rest of the app
// renders identically whether or not cloud sync exists.
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState(sync.getStatus());
  const [conflicts, setConflicts] = useState([]); // surfaced by reconcile()
  const reconciledForRef = useRef(null); // guard: reconcile once per user per load

  // Run the initial pull/merge for a freshly-available session. Idempotent per
  // user id so the getSession() call and the onAuthStateChange listener don't
  // both trigger it.
  const reconcileNow = useCallback(async (userId) => {
    if (reconciledForRef.current === userId) return;
    reconciledForRef.current = userId;
    sync.start(userId);
    const { conflicts: found, changedLocal } = await sync.reconcile();
    if (found.length > 0) {
      setConflicts(found);
    } else if (changedLocal) {
      // Cloud data was merged in — reload so every context re-reads storage.
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    sync.onStatus(setSyncStatus);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        reconcileNow(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        reconcileNow(session.user.id);
      } else {
        setUser(null);
        reconciledForRef.current = null;
        sync.stop();
      }
    });

    return () => subscription?.unsubscribe();
  }, [reconcileNow]);

  // Send a magic link. Returns { ok, error }.
  const signInWithMagicLink = useCallback(async (email) => {
    if (!isSupabaseConfigured) return { ok: false, error: 'Cloud sync is not configured.' };
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    sync.stop();
    await supabase.auth.signOut();
    setUser(null);
    reconciledForRef.current = null;
  }, []);

  // Manual "Sync now" — re-run reconcile on demand.
  const syncNow = useCallback(async () => {
    if (!user) return;
    const { conflicts: found, changedLocal } = await sync.reconcile();
    if (found.length > 0) setConflicts(found);
    else if (changedLocal) window.location.reload();
  }, [user]);

  // Resolve the conflicts surfaced by reconcile; choices maps id -> 'local'|'cloud'.
  const resolveConflicts = useCallback(async (choices) => {
    await sync.resolveConflicts(conflicts, choices);
    setConflicts([]);
    // Reload so contexts pick up any locally-applied cloud values cleanly.
    window.location.reload();
  }, [conflicts]);

  const value = {
    isConfigured: isSupabaseConfigured,
    user,
    syncStatus,
    conflicts,
    signInWithMagicLink,
    signOut,
    syncNow,
    resolveConflicts,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
