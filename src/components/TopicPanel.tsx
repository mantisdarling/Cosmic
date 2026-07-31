/**
 * TopicPanel.tsx
 * - No auth/user — progress tracked locally via parent state
 * - Premium slide-in panel, yellow theme
 * Security: marked → DOMPurify, HTTPS-only URLs
 */

import { useEffect, useRef, useCallback, useState, memo } from 'react';
import { marked } from 'marked';
import { sanitizeHtml, toSafeError } from '../lib/security';

interface Resource { label: string; url: string; }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string | null;
  nodeLabel: string;
  markdownBody: string;
  resources: Resource[];
  progress: Record<string, string>;
  onProgressUpdate: (nodeId: string, status: string) => void;
}

marked.setOptions({ gfm: true, breaks: false });

function isSafeUrl(u: string) {
  try { return new URL(u).protocol === 'https:'; } catch { return false; }
}

const TopicPanel = memo(function TopicPanel({
  isOpen, onClose, nodeId, nodeLabel,
  markdownBody, resources, progress, onProgressUpdate,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [html, setHtml] = useState('');

  const status = nodeId ? (progress[nodeId] ?? 'todo') : 'todo';
  const isDone = status === 'done';
  const isBookmarked = status === 'bookmarked';
  const isInProgress = status === 'in-progress';

  // Render markdown safely
  useEffect(() => {
    if (!markdownBody) {
      setHtml('<p style="color:#525252;font-size:0.875rem;line-height:1.7;">Content coming soon for this topic. Check the resources below to get started.</p>');
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

  // Focus + keyboard
  useEffect(() => { if (isOpen) setTimeout(() => closeRef.current?.focus(), 60); }, [isOpen]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  // Scroll lock
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const toggle = useCallback((target: string) => {
    if (!nodeId) return;
    const next = status === target ? 'todo' : target;
    onProgressUpdate(nodeId, next);
  }, [nodeId, status, onProgressUpdate]);

  const safeResources = resources.filter(r =>
    typeof r.label === 'string' && r.label.length > 0 && r.label.length <= 120 && isSafeUrl(r.url)
  );

  const W = 460;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
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
          width: W, maxWidth: '100vw',
          background: '#141414', borderLeft: '1px solid #1f1f1f',
          display: 'flex', flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform .35s cubic-bezier(0.16,1,0.3,1)',
          boxShadow: '-16px 0 64px rgba(0,0,0,0.7)',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          flexShrink: 0, padding: '20px 24px 16px',
          borderBottom: '1px solid #1f1f1f',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: '0.65rem', fontWeight: 700, color: '#F5A623',
              fontFamily: 'Space Mono, monospace', letterSpacing: '0.14em',
              textTransform: 'uppercase', marginBottom: 8,
            }}>
              Topic
            </p>
            <h2 style={{
              fontSize: '1.1rem', fontWeight: 800, color: '#F5F5F5',
              letterSpacing: '-0.03em', lineHeight: 1.3,
            }}>
              {nodeLabel || '—'}
            </h2>
          </div>
          <button
            ref={closeRef} onClick={onClose}
            aria-label="Close"
            style={{
              width: 32, height: 32, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8, border: '1px solid #222', background: '#1a1a1a',
              color: '#525252', fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1,
              transition: 'color .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#F5F5F5'}
            onMouseLeave={e => e.currentTarget.style.color = '#525252'}
          >×</button>
        </div>

        {/* ── Progress Actions ── */}
        {nodeId && (
          <div style={{
            flexShrink: 0, padding: '12px 24px',
            borderBottom: '1px solid #1a1a1a',
            display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
          }}>
            {/* Mark done */}
            <button
              onClick={() => toggle('done')}
              aria-pressed={isDone}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 7, border: 'none',
                background: isDone ? 'rgba(34,197,94,0.12)' : '#1a1a1a',
                border: `1px solid ${isDone ? '#22C55E' : '#262626'}`,
                color: isDone ? '#4ADE80' : '#737373',
                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                transition: 'all .15s',
              } as React.CSSProperties}
            >
              <span>{isDone ? '✓' : '○'}</span>
              {isDone ? 'Done!' : 'Mark done'}
            </button>

            {/* In progress */}
            <button
              onClick={() => toggle('in-progress')}
              aria-pressed={isInProgress}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 7, border: 'none',
                background: isInProgress ? 'rgba(245,166,35,0.1)' : '#1a1a1a',
                border: `1px solid ${isInProgress ? '#F5A623' : '#262626'}`,
                color: isInProgress ? '#FCD068' : '#737373',
                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                transition: 'all .15s',
              } as React.CSSProperties}
            >
              <span style={{ fontSize: 8 }}>●</span>
              {isInProgress ? 'In progress' : 'Start learning'}
            </button>

            {/* Bookmark */}
            <button
              onClick={() => toggle('bookmarked')}
              aria-pressed={isBookmarked}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 7, border: 'none',
                background: isBookmarked ? 'rgba(59,130,246,0.1)' : '#1a1a1a',
                border: `1px solid ${isBookmarked ? '#3B82F6' : '#262626'}`,
                color: isBookmarked ? '#60A5FA' : '#737373',
                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                transition: 'all .15s',
              } as React.CSSProperties}
            >
              <span>{isBookmarked ? '◈' : '◇'}</span>
              {isBookmarked ? 'Saved' : 'Save'}
            </button>
          </div>
        )}

        {/* ── Scrollable content ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, overscrollBehavior: 'contain' }}>

          {/* Markdown */}
          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: html }}
            style={{ marginBottom: 24 }}
          />

          {/* Resources */}
          {safeResources.length > 0 && (
            <div style={{ borderTop: '1px solid #1f1f1f', paddingTop: 20 }}>
              <p style={{
                fontSize: '0.68rem', fontWeight: 700, color: '#525252',
                fontFamily: 'Space Mono, monospace', letterSpacing: '0.14em',
                textTransform: 'uppercase', marginBottom: 12,
              }}>
                Resources
              </p>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, listStyle: 'none', padding: 0 }}>
                {safeResources.map((r, i) => (
                  <li key={i}>
                    <a
                      href={r.url}
                      rel="noopener noreferrer"
                      target="_blank"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 12, padding: '10px 14px', borderRadius: 8,
                        border: '1px solid #1f1f1f', background: '#1a1a1a',
                        color: '#A3A3A3', fontSize: '0.84rem', fontWeight: 500,
                        textDecoration: 'none', transition: 'all .15s',
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

          {/* Free forever note */}
          <div style={{
            marginTop: 24, padding: '12px 14px', borderRadius: 8,
            background: '#111', border: '1px solid #1f1f1f',
          }}>
            <p style={{ fontSize: '0.78rem', color: '#525252', margin: 0, lineHeight: 1.6 }}>
              ✦ Progress is saved locally in your browser — no account needed. <span style={{ color: '#2a2a2a' }}>•</span> 100% free & open source.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
});

export default TopicPanel;
