/**
 * TopicPanel.tsx
 * - Slide-in panel showing topic name + description + resources
 * - No progress tracking, no auth
 * - Yellow theme, inline styles
 * Security: marked → DOMPurify sanitization, HTTPS-only resource URLs
 */

import { useEffect, useRef, useState, memo } from 'react';
import { marked } from 'marked';
import { sanitizeHtml } from '../lib/security';

interface Resource { label: string; url: string; }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  nodeLabel: string;
  markdownBody: string;
  resources: Resource[];
}

marked.setOptions({ gfm: true, breaks: false });

function isSafeUrl(u: string) {
  try { return new URL(u).protocol === 'https:'; } catch { return false; }
}

const TopicPanel = memo(function TopicPanel({
  isOpen, onClose, nodeLabel, markdownBody, resources,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [html, setHtml] = useState('');

  // Render markdown → sanitized HTML
  useEffect(() => {
    if (!markdownBody) {
      setHtml('<p style="color:#525252;font-size:0.875rem;line-height:1.75;">Content coming soon for this topic. Check the resources below to get started.</p>');
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

  // Focus close button on open
  useEffect(() => { if (isOpen) setTimeout(() => closeRef.current?.focus(), 60); }, [isOpen]);

  // Escape key closes panel
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  // Scroll lock while open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const safeResources = resources.filter(r =>
    typeof r.label === 'string' && r.label.length > 0 && r.label.length <= 120 && isSafeUrl(r.url)
  );

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity .25s',
        }}
      />

      {/* ── Panel ── */}
      <aside
        role="complementary"
        aria-label="Topic details"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
          width: 480, maxWidth: '100vw',
          background: '#141414',
          borderLeft: '1px solid #1f1f1f',
          display: 'flex', flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform .35s cubic-bezier(0.16,1,0.3,1)',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.7)',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          flexShrink: 0,
          padding: '22px 26px 18px',
          borderBottom: '1px solid #1f1f1f',
          display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', gap: 16,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: '0.65rem', fontWeight: 700, color: '#F5A623',
              fontFamily: '"Space Mono", monospace',
              letterSpacing: '0.14em', textTransform: 'uppercase',
              margin: '0 0 10px',
            }}>
              Topic
            </p>
            <h2 style={{
              fontSize: '1.15rem', fontWeight: 800, color: '#F5F5F5',
              letterSpacing: '-0.03em', lineHeight: 1.3, margin: 0,
            }}>
              {nodeLabel || '—'}
            </h2>
          </div>

          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close panel"
            style={{
              flexShrink: 0, width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8, border: '1px solid #222',
              background: '#1a1a1a', color: '#525252',
              fontSize: '1.1rem', lineHeight: 1,
              cursor: 'pointer', transition: 'color .15s, border-color .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#F5F5F5'; e.currentTarget.style.borderColor = '#404040'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#525252'; e.currentTarget.style.borderColor = '#222'; }}
          >
            ×
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 26px', overscrollBehavior: 'contain' }}>

          {/* Markdown content */}
          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {/* Resource links */}
          {safeResources.length > 0 && (
            <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #1f1f1f' }}>
              <p style={{
                fontSize: '0.68rem', fontWeight: 700, color: '#525252',
                fontFamily: '"Space Mono", monospace',
                letterSpacing: '0.14em', textTransform: 'uppercase',
                margin: '0 0 12px',
              }}>
                Resources
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {safeResources.map((r, i) => (
                  <li key={i}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', gap: 12,
                        padding: '10px 14px', borderRadius: 8,
                        border: '1px solid #1f1f1f', background: '#1a1a1a',
                        color: '#A3A3A3', fontSize: '0.84rem',
                        fontWeight: 500, textDecoration: 'none',
                        transition: 'all .15s',
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

          {/* Footer note */}
          <div style={{ marginTop: 28, padding: '12px 14px', borderRadius: 8, background: '#111', border: '1px solid #1a1a1a' }}>
            <p style={{ fontSize: '0.76rem', color: '#404040', margin: 0, lineHeight: 1.6 }}>
              ✦ Cosmic is 100% free and open source — <a href="https://github.com/mantisdarling/cosmic" target="_blank" rel="noopener noreferrer" style={{ color: '#525252' }}>contribute on GitHub</a>
            </p>
          </div>
        </div>
      </aside>
    </>
  );
});

export default TopicPanel;
