/**
 * RoadmapCanvas.tsx — Main orchestrator island
 * Full yellow theme, inline styles, no Tailwind dependency.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import RoadmapFlow from './RoadmapFlow';
import TopicPanel from './TopicPanel';
import { auth, isFirebaseReady } from '../lib/firebase';
import { subscribeToProgress, type ProgressMap } from '../lib/firestore';
import { NodeIdSchema } from '../lib/security';
import type { Roadmap } from '../lib/security';

interface TopicContent { nodeId: string; markdownBody: string; resources: { label: string; url: string }[]; }
interface Props { roadmap: Roadmap; topicContents: TopicContent[]; }

export default function RoadmapCanvas({ roadmap, topicContents }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const topicMap = useMemo(() => {
    const m = new Map<string, TopicContent>();
    topicContents.forEach(t => { const s = NodeIdSchema.safeParse(t.nodeId); if (s.success) m.set(s.data, t); });
    return m;
  }, [topicContents]);

  useEffect(() => {
    if (!isFirebaseReady()) { setAuthLoading(false); return; }
    return onAuthStateChanged(auth, u => { setUser(u); setAuthLoading(false); }, () => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (!user) { setProgress({}); return; }
    return subscribeToProgress(user, roadmap.id, setProgress, err => {
      if (import.meta.env.DEV) console.error('[Progress]', err);
    });
  }, [user, roadmap.id]);

  const handleNodeClick = useCallback((raw: string) => {
    const s = NodeIdSchema.safeParse(raw);
    if (!s.success) return;
    setActiveNodeId(s.data);
    setPanelOpen(true);
  }, []);

  const handleProgressUpdate = useCallback((nodeId: string, status: 'done' | 'bookmarked' | 'todo') => {
    setProgress(prev => {
      if (status === 'todo') { const n = { ...prev }; delete n[nodeId]; return n; }
      return { ...prev, [nodeId]: { status, updatedAt: new Date() } };
    });
  }, []);

  // Stats
  const total = roadmap.nodes.length;
  const done = Object.values(progress).filter(p => p.status === 'done').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const activeTopic = activeNodeId ? topicMap.get(activeNodeId) : null;
  const activeNode = activeNodeId ? roadmap.nodes.find(n => n.id === activeNodeId) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0D0D0D' }}>
      {/* ── Toolbar ── */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 48,
        borderBottom: '1px solid #1a1a1a',
        background: '#111',
        gap: 16,
      }}>
        {/* Progress */}
        {user && !authLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 140, height: 5, borderRadius: 999,
              background: '#1f1f1f', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 999,
                width: `${pct}%`,
                background: pct === 100 ? '#22C55E' : '#F5A623',
                transition: 'width .4s ease',
              }} />
            </div>
            <span style={{
              fontSize: '0.72rem', fontWeight: 600, color: '#737373',
              fontFamily: 'Space Mono, monospace',
            }}>
              {done}/{total} done
            </span>
          </div>
        )}

        {/* Auth */}
        <div style={{ marginLeft: 'auto' }}>
          {authLoading ? (
            <div style={{ width: 72, height: 30, borderRadius: 7, background: '#1a1a1a' }} />
          ) : user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img
                src={user.photoURL ?? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.displayName ?? 'U')}`}
                alt={user.displayName ?? 'User avatar'}
                width={28} height={28}
                style={{ borderRadius: '50%', border: '1.5px solid #262626' }}
              />
              <button
                onClick={async () => {
                  const { signOut } = await import('firebase/auth');
                  await signOut(auth);
                }}
                style={{
                  fontSize: '0.75rem', fontWeight: 500, color: '#737373',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                  borderRadius: 6, transition: 'color .15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#A3A3A3')}
                onMouseLeave={e => (e.currentTarget.style.color = '#737373')}
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              style={{
                padding: '6px 16px', borderRadius: 7,
                background: '#F5A623', color: '#0D0D0D',
                fontSize: '0.78rem', fontWeight: 700,
                border: 'none', cursor: 'pointer',
                transition: 'background .15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FCD068')}
              onMouseLeave={e => (e.currentTarget.style.background = '#F5A623')}
            >
              Sign in
            </button>
          )}
        </div>
      </div>

      {/* ── Canvas ── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <RoadmapFlow
          roadmap={roadmap}
          progress={progress}
          onNodeClick={handleNodeClick}
          accentColor={roadmap.color}
        />
      </div>

      {/* ── Topic Panel ── */}
      <TopicPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        nodeId={activeNodeId}
        nodeLabel={activeNode?.label ?? ''}
        markdownBody={activeTopic?.markdownBody ?? ''}
        resources={activeTopic?.resources ?? []}
        roadmapId={roadmap.id}
        user={user}
        progress={progress}
        onProgressUpdate={handleProgressUpdate}
      />

      {/* ── Auth Modal ── */}
      {authOpen && !user && (
        <AuthModal onClose={() => setAuthOpen(false)} />
      )}
    </div>
  );
}

// ── Inline Auth Modal ────────────────────────────────────────────────────
function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'options' | 'email'>('options');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const signInGoogle = async () => {
    setLoading(true); setError('');
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
      await signInWithPopup(auth, new GoogleAuthProvider());
      onClose();
    } catch { setError('Sign-in failed. Try again.'); }
    setLoading(false);
  };

  const signInEmail = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('firebase/auth');
      try { await signInWithEmailAndPassword(auth, email, password); }
      catch { await createUserWithEmailAndPassword(auth, email, password); }
      onClose();
    } catch { setError('Invalid credentials. Check email and password.'); }
    setLoading(false);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#141414', border: '1px solid #262626',
          borderRadius: 16, padding: 32, width: '100%', maxWidth: 380,
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F5F5F5', letterSpacing: '-0.03em', marginBottom: 6 }}>
            Sign in to Cosmic
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#525252' }}>
            Track your progress across all roadmaps
          </p>
        </div>

        {mode === 'options' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={signInGoogle}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '11px 16px', borderRadius: 9, border: '1px solid #2a2a2a',
                background: '#1a1a1a', color: '#E5E5E5',
                fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
                transition: 'border-color .15s', width: '100%',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>
            <button
              onClick={() => setMode('email')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '11px 16px', borderRadius: 9, border: '1px solid #2a2a2a',
                background: '#1a1a1a', color: '#E5E5E5',
                fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', width: '100%',
              }}
            >
              ✉ Continue with Email
            </button>
          </div>
        ) : (
          <form onSubmit={signInEmail} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email" placeholder="Email" value={email}
              onChange={e => setEmail(e.target.value)} required
              style={{
                padding: '10px 14px', borderRadius: 8, border: '1px solid #2a2a2a',
                background: '#111', color: '#F5F5F5', fontSize: '0.88rem', outline: 'none',
              }}
            />
            <input
              type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)} required minLength={6}
              style={{
                padding: '10px 14px', borderRadius: 8, border: '1px solid #2a2a2a',
                background: '#111', color: '#F5F5F5', fontSize: '0.88rem', outline: 'none',
              }}
            />
            {error && <p style={{ fontSize: '0.78rem', color: '#EF4444', margin: 0 }}>{error}</p>}
            <button
              type="submit" disabled={loading}
              style={{
                padding: '11px', borderRadius: 9, border: 'none',
                background: '#F5A623', color: '#0D0D0D',
                fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in / Create account'}
            </button>
            <button type="button" onClick={() => setMode('options')}
              style={{ background: 'none', border: 'none', color: '#525252', fontSize: '0.78rem', cursor: 'pointer' }}>
              ← Back
            </button>
          </form>
        )}

        <button onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none', color: '#525252',
            fontSize: '1rem', cursor: 'pointer', lineHeight: 1,
          }}
          aria-label="Close"
        >×</button>
      </div>
    </div>
  );
}
