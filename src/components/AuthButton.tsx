/**
 * src/components/AuthButton.tsx
 *
 * Firebase Auth sign-in/sign-out button with Google OAuth and email/password.
 *
 * Security hardening:
 *  - Rate limiting on all auth attempts (client-side friction layer).
 *  - Email validated through Zod EmailSchema before calling Firebase.
 *  - Password length enforced (min 8, max 128) — bcrypt/Argon2 safe lengths.
 *  - Errors mapped through mapFirebaseError() → toSafeError() — no raw Firebase
 *    error messages or codes reach the DOM.
 *  - Google sign-in uses signInWithPopup (not redirect) to avoid URL token leakage.
 *  - onAuthStateChanged listener always cleaned up on unmount.
 *  - No user data is stored in component state beyond what's needed for UI.
 *  - Auth state is read from Firebase SDK (single source of truth), not localStorage.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, isFirebaseReady } from '../lib/firebase';
import {
  EmailSchema,
  checkRateLimit,
  mapFirebaseError,
  toSafeError,
} from '../lib/security';

// ── Constants ────────────────────────────────────────────────────────────────
const MIN_PASSWORD_LEN = 8;
const MAX_PASSWORD_LEN = 128; // Safe for bcrypt/Argon2
const GOOGLE_PROVIDER = new GoogleAuthProvider();
// Request minimal scopes — principle of least privilege
GOOGLE_PROVIDER.addScope('profile');
GOOGLE_PROVIDER.addScope('email');
// Force account picker every time for explicit consent
GOOGLE_PROVIDER.setCustomParameters({ prompt: 'select_account' });

// ── Component ────────────────────────────────────────────────────────────────
export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  // Track Firebase availability
  const firebaseReady = isFirebaseReady();

  // ── Auth state listener ──────────────────────────────────────────────────
  useEffect(() => {
    if (!firebaseReady) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(
      auth,
      (u) => {
        setUser(u);
        setLoading(false);
      },
      () => {
        // Auth error — fail gracefully
        setLoading(false);
      },
    );
    return unsubscribe; // Cleanup on unmount — prevents memory leaks
  }, [firebaseReady]);

  // Focus first input when modal opens
  useEffect(() => {
    if (modalOpen) {
      setTimeout(() => emailRef.current?.focus(), 50);
    }
  }, [modalOpen]);

  // ── Validation ───────────────────────────────────────────────────────────
  function validateInputs(): string | null {
    const emailResult = EmailSchema.safeParse(email);
    if (!emailResult.success) {
      return 'Please enter a valid email address.';
    }
    if (password.length < MIN_PASSWORD_LEN) {
      return `Password must be at least ${MIN_PASSWORD_LEN} characters.`;
    }
    if (password.length > MAX_PASSWORD_LEN) {
      return 'Password is too long.';
    }
    // Basic entropy check — no passwords of all same character
    if (/^(.)\1+$/.test(password)) {
      return 'Password is too simple. Please choose a stronger password.';
    }
    return null;
  }

  // ── Google Sign-in ───────────────────────────────────────────────────────
  const handleGoogleSignIn = useCallback(async () => {
    if (!firebaseReady) {
      setError('Authentication service is not available. Please add Firebase config.');
      return;
    }

    // Rate limit by IP-equivalent (email unknown, use fixed key for Google)
    const rl = checkRateLimit('auth:google');
    if (!rl.allowed) {
      const minutes = Math.ceil((rl.retryAfterMs ?? 300_000) / 60_000);
      setError(`Too many sign-in attempts. Please wait ${minutes} minute(s).`);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await signInWithPopup(auth, GOOGLE_PROVIDER);
      setModalOpen(false);
      resetForm();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      const safe = toSafeError(err, mapFirebaseError(code));
      setError(safe.message);
    } finally {
      setSubmitting(false);
    }
  }, [firebaseReady]);

  // ── Email/Password Auth ──────────────────────────────────────────────────
  const handleEmailAuth = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!firebaseReady) {
        setError('Authentication service is not available.');
        return;
      }

      // Validate inputs first — reject before hitting Firebase
      const validationError = validateInputs();
      if (validationError) {
        setError(validationError);
        return;
      }

      // Rate limit keyed by email to prevent credential stuffing
      const safeEmail = EmailSchema.parse(email); // Already validated above
      const rl = checkRateLimit(`auth:email:${safeEmail}`);
      if (!rl.allowed) {
        const minutes = Math.ceil((rl.retryAfterMs ?? 300_000) / 60_000);
        setError(`Too many attempts for this account. Please wait ${minutes} minute(s).`);
        return;
      }

      setSubmitting(true);
      setError('');

      try {
        if (mode === 'signin') {
          await signInWithEmailAndPassword(auth, safeEmail, password);
        } else {
          await createUserWithEmailAndPassword(auth, safeEmail, password);
        }
        setModalOpen(false);
        resetForm();
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code ?? '';
        const safe = toSafeError(err, mapFirebaseError(code));
        setError(safe.message);
      } finally {
        setSubmitting(false);
      }
    },
    [email, password, mode, firebaseReady],
  );

  // ── Sign Out ─────────────────────────────────────────────────────────────
  const handleSignOut = useCallback(async () => {
    if (!firebaseReady) return;
    try {
      await signOut(auth);
    } catch (err) {
      // Sign-out errors are non-critical; log in dev only
      if (import.meta.env.DEV) console.error('[Auth] Sign-out error:', err);
    }
  }, [firebaseReady]);

  function resetForm() {
    setEmail('');
    setPassword('');
    setError('');
  }

  function closeModal() {
    setModalOpen(false);
    resetForm();
  }

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full border border-[var(--border-default)] animate-pulse bg-[var(--bg-card)]" />
    );
  }

  // ── Signed in ────────────────────────────────────────────────────────────
  if (user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {user.photoURL && (
            <img
              src={user.photoURL}
              alt="" // Decorative — screen readers skip
              width={28}
              height={28}
              className="w-7 h-7 rounded-full border border-[var(--border-default)]"
              referrerPolicy="no-referrer" // Prevent referrer leakage
            />
          )}
          <span className="hidden sm:block font-mono text-xs text-[var(--text-muted)] max-w-[120px] truncate">
            {/* Only show local part of email — avoid leaking full address in UI */}
            {user.email?.split('@')[0] ?? 'user'}
          </span>
        </div>
        <button
          onClick={handleSignOut}
          className="font-mono text-xs px-3 py-1.5 rounded-full border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-red-500/50 hover:text-red-400 transition-all duration-200"
        >
          Sign out
        </button>
      </div>
    );
  }

  // ── Signed out ───────────────────────────────────────────────────────────
  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="font-mono text-xs px-3 py-1.5 rounded-full border border-[var(--accent-purple)] bg-[rgba(124,58,237,0.1)] text-[var(--accent-purple-light)] hover:bg-[rgba(124,58,237,0.2)] transition-all duration-200"
      >
        Sign in
      </button>

      {/* Auth Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={closeModal}
              aria-hidden="true"
            />

            {/* Modal panel */}
            <motion.div
              className="relative w-full max-w-sm bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Close button */}
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all text-sm font-mono"
                aria-label="Close sign-in modal"
              >
                ✕
              </button>

              <h2
                id="auth-modal-title"
                className="font-display text-3xl tracking-wider text-[var(--text-primary)] mb-1"
              >
                {mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
              </h2>
              <p className="text-[var(--text-muted)] text-sm mb-6">
                {mode === 'signin'
                  ? 'Track your progress across sessions.'
                  : 'Start tracking your learning journey.'}
              </p>

              {/* Error banner — safe message only, never raw error */}
              {error && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
                >
                  {error}
                </div>
              )}

              {/* Google Sign-in */}
              <button
                onClick={handleGoogleSignIn}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:border-[var(--accent-purple)] hover:bg-[rgba(124,58,237,0.05)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mb-4 font-sans font-medium text-sm"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-[var(--border-default)]" />
                <span className="font-mono text-xs text-[var(--text-muted)]">or</span>
                <div className="flex-1 h-px bg-[var(--border-default)]" />
              </div>

              {/* Email/Password form */}
              <form onSubmit={handleEmailAuth} noValidate>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="auth-email" className="block font-mono text-xs text-[var(--text-muted)] mb-1.5 uppercase tracking-widest">
                      Email
                    </label>
                    <input
                      ref={emailRef}
                      id="auth-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      maxLength={254}
                      required
                      placeholder="you@example.com"
                      className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm focus:outline-none focus:border-[var(--accent-purple)] transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="auth-password" className="block font-mono text-xs text-[var(--text-muted)] mb-1.5 uppercase tracking-widest">
                      Password
                    </label>
                    <input
                      id="auth-password"
                      type="password"
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={MIN_PASSWORD_LEN}
                      maxLength={MAX_PASSWORD_LEN}
                      required
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm focus:outline-none focus:border-[var(--accent-purple)] transition-colors"
                    />
                    {mode === 'signup' && (
                      <p className="mt-1.5 font-mono text-xs text-[var(--text-muted)]">
                        Min. 8 characters
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-5 w-full py-3 rounded-xl bg-[var(--accent-purple)] text-white font-sans font-semibold text-sm hover:bg-[var(--accent-violet)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {submitting
                    ? 'Please wait…'
                    : mode === 'signin'
                    ? 'Sign In'
                    : 'Create Account'}
                </button>
              </form>

              {/* Toggle mode */}
              <p className="mt-4 text-center font-mono text-xs text-[var(--text-muted)]">
                {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
                  className="text-[var(--accent-purple-light)] hover:underline"
                >
                  {mode === 'signin' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
