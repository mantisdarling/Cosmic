/**
 * TopicPanel.tsx — Premium slide-in topic detail panel
 * Yellow theme, inline styles, secure markdown rendering.
 * Security: marked → DOMPurify, HTTPS-only resource URLs, Zod-validated IDs.
 */

import { useEffect, useRef, useCallback, useState, memo } from 'react';
import { marked } from 'marked';
import type { User } from 'firebase/auth';
import { setNodeProgress, clearNodeProgress, type ProgressMap } from '../lib/firestore';
import { NodeIdSchema, SlugSchema, sanitizeHtml, toSafeError } from '../lib/security';

interface Resource { label: string; url: string; }
interface Props {
  isOpen: boolean; onClose: () => void;
  nodeId: string | null; nodeLabel: string;
  markdownBody: string; resources: Resource[];
  roadmapId: string; user: User | null;
  progress: ProgressMap;
  onProgressUpdate: (nodeId: string, status: 'done' | 'bookmarked' | 'todo') => void;
}

marked.setOptions({ gfm: true, breaks: false });

function isSafeUrl(url: string) {
  try { return new URL(url).protocol === 'https:'; } catch { return false; }
}

const TopicPanel = memo(function TopicPanel({
  isOpen, onClose, nodeId, nodeLabel,
  markdownBody, resources, roadmapId,
  user, progress, onProgressUpdate,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');
  const [html, setHtml] = useState('');
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const status = nodeId ? (progress[nodeId]?.status ?? 'todo') : 'todo';
  const isDone = status === 'done';
  const isBookmarked = status === 'bookmarked';

  // Render markdown
  useEffect(() => {
    if (!markdownBody) {
      setHtml('<p style="color:#525252;font-size:0.875rem;">Content coming soon for this topic.</p>');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const raw = await marked.parse(markdownBody, { async: false }) as string;
        const safe = await sanitizeHtml(raw);
        if (!cancelled) setHtml(safe);
      } catch {
        if (!cancelled) setHtml('<p style="color:#525252;">Could not render content.</p>');
      }
    })();
    return () => { cancelled = true; };
  }, [markdownBody]);

  // Focus / key / scroll
  useEffect(() => { if (isOpen) setTimeout(() => closeRef.current?.focus(), 60); }, [isOpen]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen, onClose]);
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const toggle = useCallback(async (target: 'done' | 'bookmarked') => {
    if (!user || !nodeId || toggling) return;
    const safeNode = NodeIdSchema.safeParse(nodeId);
    const safeRm = SlugSchema.safeParse(roadmapId);
    if (!safeNode.success || !safeRm.success) { setError('Invalid ID.'); return; }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setToggling(true); setError('');
      try {
        const next = status === target ? 'todo' : target;
        const r = next === 'todo'
          ? await clearNodeProgress(user, safeRm.data, safeNode.data)
          : await setNodeProgress(user, safeRm.data, safeNode.data, next);
        if (!r.success) setError(r.error ?? 'Failed to update.');
        onProgressUpdate(safeNode.data, next);
      } catch (e) { setError(toSafeError(e).message); }
      setToggling(false);
    }, 250);
  }, [user, nodeId, roadmapId, status, toggling, onProgressUpdate]);

  const safeResources = resources.filter(r =>
    typeof r.label === 'string' && r.label.length > 0 && r.label.length <= 120 && isSafeUrl(r.url)
  );

  const PANEL_W = 460;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity .25s',
        }}
      />

      {/* Panel */}
      <aside
        role="complementary"
        aria-label="Topic details"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
          width: PANEL_W, maxWidth: '100vw',
          background: '#141414',
          borderLeft: '1px solid #222',
          display: 'flex', flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform .35s cubic-bezier(0.16,1,0.3,1)',
          boxShadow: '-16px 0 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{
          flexShrink: 0, padding: '20px 24px 16px',
          borderBottom: '1px solid #1f1f1f',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: '0.68rem', fontWeight: 600, color: '#F5A623',
              fontFamily: 'Space Mono, monospace', letterSpacing: '0.12em',
              textTransform: 'uppercase', marginBottom: 6,
            }}>
              Topic
            </p>
            <h2 style={{
              fontSize: '1.15rem', fontWeight: 800, color: '#F5F5F5',
              letterSpacing: '-0.03em', lineHeight: 1.25,
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {nodeLabel || 'Select a topic'}
            </h2>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close topic panel"
            style={{
              flexShrink: 0, width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8, border: '1px solid #222',
              background: '#1a1a1a', color: '#737373',
              fontSize: '1rem', cursor: 'pointer', lineHeight: 1,
              transition: 'color .15s, border-color .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#F5F5F5'; e.currentTarget.style.borderColor = '#333'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#737373'; e.currentTarget.style.borderColor = '#222'; }}
          >×</button>
        </div>

        {/* Progress actions */}
        {user && nodeId && (
          <div style={{
            flexShrink: 0, padding: '12px 24px',
            borderBottom: '1px solid #1f1f1f',
            display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
          }}>
            <button
              onClick={() => toggle('done')}
              disabled={toggling}
              aria-pressed={isDone}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 7,
                background: isDone ? 'rgba(34,197,94,0.1)' : '#1a1a1a',
                border: `1px solid ${isDone ? '#22C55E' : '#262626'}`,
                color: isDone ? '#22C55E' : '#737373',
                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                transition: 'all .15s', opacity: toggling ? 0.5 : 1,
              }}
            >
              <span>{isDone ? '✓' : '○'}</span>
              {isDone ? 'Completed' : 'Mark complete'}
            </button>
            <button
              onClick={() => toggle('bookmarked')}
              disabled={toggling}
              aria-pressed={isBookmarked}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 7,
                background: isBookmarked ? 'rgba(59,130,246,0.1)' : '#1a1a1a',
                border: `1px solid ${isBookmarked ? '#3B82F6' : '#262626'}`,
                color: isBookmarked ? '#3B82F6' : '#737373',
                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                transition: 'all .15s', opacity: toggling ? 0.5 : 1,
              }}
            >
              <span>{isBookmarked ? '◈' : '◇'}</span>
              {isBookmarked ? 'Bookmarked' : 'Bookmark'}
            </button>
            {error && <p role="alert" style={{ fontSize: '0.75rem', color: '#EF4444', margin: 0 }}>{error}</p>}
          </div>
        )}

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', overscrollBehavior: 'contain' }}>

          {/* Markdown content */}
          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: html }}
            style={{ marginBottom: 24 }}
          />

          {/* Resources */}
          {safeResources.length > 0 && (
            <div style={{ borderTop: '1px solid #1f1f1f', paddingTop: 20 }}>
              <p style={{
                fontSize: '0.7rem', fontWeight: 700, color: '#525252',
                fontFamily: 'Space Mono, monospace', letterSpacing: '0.12em',
                textTransform: 'uppercase', marginBottom: 12,
              }}>
                Resources
              </p>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, listStyle: 'none' }}>
                {safeResources.map((r, i) => (
                  <li key={i}>
                    <a
                      href={r.url}
                      rel="noopener noreferrer"
                      target="_blank"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 12, padding: '10px 14px',
                        borderRadius: 8, border: '1px solid #1f1f1f',
                        background: '#1a1a1a', color: '#A3A3A3',
                        fontSize: '0.84rem', fontWeight: 500, textDecoration: 'none',
                        transition: 'border-color .15s, color .15s, background .15s',
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget;
                        el.style.borderColor = '#F5A623';
                        el.style.color = '#F5F5F5';
                        el.style.background = 'rgba(245,166,35,0.05)';
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget;
                        el.style.borderColor = '#1f1f1f';
                        el.style.color = '#A3A3A3';
                        el.style.background = '#1a1a1a';
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.label}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#525252', flexShrink: 0 }} aria-hidden="true">↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sign-in nudge */}
          {!user && (
            <div style={{
              marginTop: 24, padding: '14px 16px', borderRadius: 10,
              background: 'rgba(245,166,35,0.06)',
              border: '1px solid rgba(245,166,35,0.2)',
            }}>
              <p style={{ fontSize: '0.84rem', color: '#737373', margin: 0, lineHeight: 1.6 }}>
                <strong style={{ color: '#F5A623' }}>Sign in</strong> to track your progress and bookmark topics across all roadmaps.
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
});

export default TopicPanel;
