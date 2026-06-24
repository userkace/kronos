import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Cloud, CloudOff, Mail, LogOut, RefreshCw, Check, AlertCircle, Loader2,
} from 'lucide-react';

const STATUS_META = {
  idle: { label: 'Idle', cls: 'text-gray-500 bg-gray-100' },
  syncing: { label: 'Syncing…', cls: 'text-blue-700 bg-blue-100' },
  synced: { label: 'Synced', cls: 'text-emerald-700 bg-emerald-100' },
  error: { label: 'Sync error', cls: 'text-red-700 bg-red-100' },
};

const AccountSettings = () => {
  const { isConfigured, user, syncStatus, signInWithMagicLink, signOut, syncNow } = useAuth();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  // Cloud sync not set up — explain how to enable it. The app works fine
  // without it, so this is informational, not an error.
  if (!isConfigured) {
    return (
      <div className="bg-white border border-gray-200/80 rounded-2xl shadow-xs p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gray-100 text-gray-500">
            <CloudOff className="w-[18px] h-[18px]" />
          </div>
          <h4 className="text-base font-semibold text-gray-900 tracking-tight">Account & Sync</h4>
        </div>
        <p className="text-sm text-gray-500">
          Cloud sync isn't configured. Add your Supabase{' '}
          <span className="font-mono text-xs">VITE_SUPABASE_URL</span> and{' '}
          <span className="font-mono text-xs">VITE_SUPABASE_ANON_KEY</span> to{' '}
          <span className="font-mono text-xs">.env.local</span> and restart the app to enable optional
          accounts and cross-device sync. Until then, all your data stays on this device.
        </p>
      </div>
    );
  }

  const handleSend = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setError(null);
    const { ok, error: err } = await signInWithMagicLink(email);
    setSending(false);
    if (ok) setSent(true);
    else setError(err || 'Could not send the link.');
  };

  const status = STATUS_META[syncStatus.state] || STATUS_META.idle;

  return (
    <div className="bg-white border border-gray-200/80 rounded-2xl shadow-xs p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600">
          <Cloud className="w-[18px] h-[18px]" />
        </div>
        <h4 className="text-base font-semibold text-gray-900 tracking-tight">Account & Sync</h4>
      </div>

      {user ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm text-gray-500">Signed in as</p>
              <p className="text-sm font-medium text-gray-900 break-all">{user.email}</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.cls}`}>
              {syncStatus.state === 'syncing' && <Loader2 className="w-3 h-3 animate-spin" />}
              {syncStatus.state === 'synced' && <Check className="w-3 h-3" />}
              {syncStatus.state === 'error' && <AlertCircle className="w-3 h-3" />}
              {status.label}
            </span>
          </div>

          {syncStatus.state === 'error' && syncStatus.lastError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 break-words">
              {syncStatus.lastError}
            </p>
          )}

          <p className="text-[13px] text-gray-500">
            Your workspaces, time entries, invoice settings, preferences, and Pomodoro settings sync
            automatically across devices where you sign in with this email.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              onClick={syncNow}
              disabled={syncStatus.state === 'syncing'}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncStatus.state === 'syncing' ? 'animate-spin' : ''}`} />
              Sync now
            </button>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg shadow-xs transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      ) : sent ? (
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
          <div className="flex items-center gap-2 text-emerald-800 font-medium text-sm">
            <Check className="w-4 h-4" /> Check your inbox
          </div>
          <p className="text-[13px] text-emerald-700 mt-1">
            We sent a sign-in link to <span className="font-medium">{email}</span>. Open it on this device
            to finish signing in.
          </p>
          <button
            onClick={() => { setSent(false); setEmail(''); }}
            className="mt-2 text-xs font-medium text-emerald-700 hover:text-emerald-900 underline"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={handleSend} className="space-y-3">
          <p className="text-[13px] text-gray-500">
            Sign in with your email to back up and sync your data. No password — we'll email you a one-time
            link. The app keeps working without an account.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow-sm shadow-blue-600/25 hover:bg-blue-500 active:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Send link
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
};

export default AccountSettings;
