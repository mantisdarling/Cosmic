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

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const GOOGLE_AUTH_PROVIDER = new GoogleAuthProvider();

GOOGLE_AUTH_PROVIDER.addScope('profile');
GOOGLE_AUTH_PROVIDER.addScope('email');
GOOGLE_AUTH_PROVIDER.setCustomParameters({ prompt: 'select_account' });

export default function AuthButton() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const isFirebaseAvailable = isFirebaseReady();

  useEffect(() => {
    if (!isFirebaseAvailable) {
      setIsLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (userState) => {
      setCurrentUser(userState);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [isFirebaseAvailable]);

  useEffect(() => {
    if (!isModalOpen) return;
    const timer = setTimeout(() => emailInputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, [isModalOpen]);

  function validateInputForm(): string | null {
    const emailResult = EmailSchema.safeParse(emailInput);
    if (!emailResult.success) {
      return 'Please enter a valid email address.';
    }
    if (passwordInput.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
    }
    if (passwordInput.length > MAX_PASSWORD_LENGTH) {
      return 'Password exceeds maximum allowed length.';
    }
    return null;
  }

  const handleGoogleAuth = useCallback(async () => {
    if (!isFirebaseAvailable) {
      setErrorMessage('Authentication service is currently unavailable.');
      return;
    }

    const rateLimitResult = checkRateLimit('auth:google');
    if (!rateLimitResult.allowed) {
      const retryMinutes = Math.ceil((rateLimitResult.retryAfterMs ?? 300000) / 60000);
      setErrorMessage(`Too many sign-in attempts. Please wait ${retryMinutes} minute(s).`);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await signInWithPopup(auth, GOOGLE_AUTH_PROVIDER);
      setIsModalOpen(false);
      resetFormState();
    } catch (err: unknown) {
      const errorCode = (err as { code?: string })?.code ?? '';
      const safeError = toSafeError(err, mapFirebaseError(errorCode));
      setErrorMessage(safeError.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [isFirebaseAvailable]);

  const handleEmailFormSubmit = useCallback(
    async (event: { preventDefault: () => void }) => {
      event.preventDefault();
      if (!isFirebaseAvailable) {
        setErrorMessage('Authentication service is currently unavailable.');
        return;
      }

      const formError = validateInputForm();
      if (formError) {
        setErrorMessage(formError);
        return;
      }

      const validatedEmail = EmailSchema.parse(emailInput);
      const rateLimitResult = checkRateLimit(`auth:email:${validatedEmail}`);
      if (!rateLimitResult.allowed) {
        const retryMinutes = Math.ceil((rateLimitResult.retryAfterMs ?? 300000) / 60000);
        setErrorMessage(`Too many attempts for this account. Please wait ${retryMinutes} minute(s).`);
        return;
      }

      setIsSubmitting(true);
      setErrorMessage('');

      try {
        if (authMode === 'signin') {
          await signInWithEmailAndPassword(auth, validatedEmail, passwordInput);
        } else {
          await createUserWithEmailAndPassword(auth, validatedEmail, passwordInput);
        }
        setIsModalOpen(false);
        resetFormState();
      } catch (err: unknown) {
        const errorCode = (err as { code?: string })?.code ?? '';
        const safeError = toSafeError(err, mapFirebaseError(errorCode));
        setErrorMessage(safeError.message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [emailInput, passwordInput, authMode, isFirebaseAvailable]
  );

  const handleUserSignOut = useCallback(async () => {
    if (!isFirebaseAvailable) return;
    try {
      await signOut(auth);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[Authentication Error]: Failed to sign out user', err);
      }
    }
  }, [isFirebaseAvailable]);

  function resetFormState() {
    setEmailInput('');
    setPasswordInput('');
    setErrorMessage('');
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    resetFormState();
  }

  if (isLoading) {
    return (
      <div className="w-8 h-8 rounded-full border border-[var(--border-default)] animate-pulse bg-[var(--bg-card)]" />
    );
  }

  if (currentUser) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {currentUser.photoURL && (
            <img
              src={currentUser.photoURL}
              alt=""
              width={28}
              height={28}
              className="w-7 h-7 rounded-full border border-[var(--border-default)]"
              referrerPolicy="no-referrer"
            />
          )}
          <span className="hidden sm:block font-mono text-xs text-[var(--text-muted)] max-w-[120px] truncate">
            {currentUser.email?.split('@')[0] ?? 'user'}
          </span>
        </div>
        <button
          onClick={handleUserSignOut}
          className="font-mono text-xs px-3 py-1.5 rounded-full border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-red-500/50 hover:text-red-400 transition-all duration-200"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="font-mono text-xs px-3 py-1.5 rounded-full border border-[var(--accent-purple)] bg-[rgba(124,58,237,0.1)] text-[var(--accent-purple-light)] hover:bg-[rgba(124,58,237,0.2)] transition-all duration-200"
      >
        Sign in
      </button>

      <AnimatePresence>
        {isModalOpen && (
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
            <motion.div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={handleCloseModal}
              aria-hidden="true"
            />

            <motion.div
              className="relative w-full max-w-sm bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-8 shadow-2xl"
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <button
                onClick={handleCloseModal}
                className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all text-sm font-mono"
                aria-label="Close sign-in modal"
              >
                ✕
              </button>

              <h2
                id="auth-modal-title"
                className="font-display text-3xl tracking-wider text-[var(--text-primary)] mb-1"
              >
                {authMode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
              </h2>
              <p className="text-[var(--text-muted)] text-sm mb-6">
                {authMode === 'signin'
                  ? 'Track your progress across sessions.'
                  : 'Start tracking your learning journey.'}
              </p>

              {errorMessage && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
                >
                  {errorMessage}
                </div>
              )}

              <button
                onClick={handleGoogleAuth}
                disabled={isSubmitting}
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

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-[var(--border-default)]" />
                <span className="font-mono text-xs text-[var(--text-muted)]">or</span>
                <div className="flex-1 h-px bg-[var(--border-default)]" />
              </div>

              <form onSubmit={handleEmailFormSubmit} noValidate>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="auth-email" className="block font-mono text-xs text-[var(--text-muted)] mb-1.5 uppercase tracking-widest">
                      Email
                    </label>
                    <input
                      ref={emailInputRef}
                      id="auth-email"
                      type="email"
                      autoComplete="email"
                      value={emailInput}
                      onChange={(event) => setEmailInput(event.target.value)}
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
                      autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                      value={passwordInput}
                      onChange={(event) => setPasswordInput(event.target.value)}
                      minLength={MIN_PASSWORD_LENGTH}
                      maxLength={MAX_PASSWORD_LENGTH}
                      required
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm focus:outline-none focus:border-[var(--accent-purple)] transition-colors"
                    />
                    {authMode === 'signup' && (
                      <p className="mt-1.5 font-mono text-xs text-[var(--text-muted)]">
                        Min. 8 characters
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-5 w-full py-3 rounded-xl bg-[var(--accent-purple)] text-white font-sans font-semibold text-sm hover:bg-[var(--accent-violet)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {isSubmitting
                    ? 'Please wait…'
                    : authMode === 'signin'
                    ? 'Sign In'
                    : 'Create Account'}
                </button>
              </form>

              <p className="mt-4 text-center font-mono text-xs text-[var(--text-muted)]">
                {authMode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={() => {
                    setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
                    setErrorMessage('');
                  }}
                  className="text-[var(--accent-purple-light)] hover:underline"
                >
                  {authMode === 'signin' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
