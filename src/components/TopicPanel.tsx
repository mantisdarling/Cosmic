/**
 * TopicPanel.tsx
 * - Slide-in panel: Content tab + AI Tutor tab
 * - AI calls /api/ai (serverless) — no API key needed from user
 * - Security: marked → DOMPurify, HTTPS-only resource URLs
 */

import { useEffect, useRef, useState, memo } from 'react';
import { marked } from 'marked';
import { sanitizeHtml } from '../lib/security';

interface Resource { label: string; url: string; }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  nodeLabel: string;
  roadmapTitle: string;
  markdownBody: string;
  resources: Resource[];
  onMarkDone?: () => void;
  isDone?: boolean;
}

marked.setOptions({ gfm: true, breaks: false });

function isSafeUrl(u: string) {
  try { return new URL(u).protocol === 'https:'; } catch { return false; }
}

async function renderMd(text: string): Promise<string> {
  const raw = await marked.parse(text, { async: false }) as string;
  return await sanitizeHtml(raw);
}

// ── AI fetch via our serverless proxy ────────────────────────────
async function fetchAI(topic: string, roadmap: string): Promise<string> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, roadmap }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error ?? 'AI request failed');
  return data.text as string;
}

async function fetchNextTopic(topic: string, roadmap: string): Promise<string> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: `_next_after_${topic}`,
      roadmap,
      prompt: `A student just finished learning "${topic}" in their ${roadmap} journey. In ONE short sentence, tell them the single most logical next topic to study after this. Format: "Next, learn **[Topic Name]** — [one-line reason why]." Be concise and direct.`,
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) return '';
  return data.text as string;
}

// ── Component ─────────────────────────────────────────────────────
const TopicPanel = memo(function TopicPanel({
  isOpen, onClose, nodeLabel, roadmapTitle, markdownBody, resources, onMarkDone, isDone,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [contentHtml, setContentHtml] = useState('');
  const [tab, setTab] = useState<'content' | 'ai'>('content');
  const [aiHtml, setAiHtml] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [nextTopic, setNextTopic] = useState('');

  // Reset state when topic changes
  useEffect(() => {
    setAiHtml('');
    setAiError('');
    setAiLoading(false);
    setTab('content');
  }, [nodeLabel]);

  // Render static markdown
  useEffect(() => {
    if (!markdownBody) {
      setContentHtml('<p style="color:#525252;font-size:0.9rem;line-height:1.75;">No written content yet — try the <strong style="color:#F5A623">AI Tutor</strong> tab for an instant explanation!</p>');
      return;
    }
    let cancelled = false;
    (async () => {
      const safe = await renderMd(markdownBody);
      if (!cancelled) setContentHtml(safe);
    })();
    return () => { cancelled = true; };
  }, [markdownBody]);

  // Focus + Escape + scroll lock
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

  // Ask AI
  const handleAskAI = async () => {
    setTab('ai');
    if (aiHtml || aiLoading) return;
    setAiLoading(true);
    setAiError('');
    setNextTopic('');
    try {
      const text = await fetchAI(nodeLabel, roadmapTitle);
      const safe = await renderMd(text);
      setAiHtml(safe);
      // Fetch "what to learn next" in background
      fetchNextTopic(nodeLabel, roadmapTitle).then(t => setNextTopic(t.replace(/\*\*/g, '').trim()));
    } catch (e: any) {
      setAiError(e?.message ?? 'Something went wrong. Please try again.');
    }
    setAiLoading(false);
  };

  const regenerate = async () => {
    setAiHtml('');
    setAiError('');
    setNextTopic('');
    setAiLoading(true);
    try {
      const text = await fetchAI(nodeLabel, roadmapTitle);
      const safe = await renderMd(text);
      setAiHtml(safe);
      fetchNextTopic(nodeLabel, roadmapTitle).then(t => setNextTopic(t.replace(/\*\*/g, '').trim()));
    } catch (e: any) {
      setAiError(e?.message ?? 'Something went wrong.');
    }
    setAiLoading(false);
  };

  const safeResources = resources.filter(r =>
    typeof r.label === 'string' && r.label.length > 0 && r.label.length <= 120 && isSafeUrl(r.url)
  );

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        onClick={onClose} aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
          opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity .25s',
        }}
      />

      {/* ── Panel ── */}
      <aside
        role="complementary" aria-label="Topic details"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
          width: 500, maxWidth: '100vw',
          background: '#141414', borderLeft: '1px solid #1f1f1f',
          display: 'flex', flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform .35s cubic-bezier(0.16,1,0.3,1)',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.7)',
        }}
      >
        {/* ── Header + Tabs ── */}
        <div style={{ flexShrink: 0, padding: '20px 24px 0', borderBottom: '1px solid #1f1f1f' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
              <p style={{
                fontSize: '0.65rem', fontWeight: 700, color: '#F5A623',
                fontFamily: '"Space Mono", monospace', letterSpacing: '0.14em',
                textTransform: 'uppercase', margin: '0 0 8px',
              }}>
                {roadmapTitle}
              </p>
              <h2 style={{
                fontSize: '1.1rem', fontWeight: 800, color: '#F5F5F5',
                letterSpacing: '-0.03em', lineHeight: 1.3, margin: 0,
              }}>
                {nodeLabel || '—'}
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {onMarkDone && (
                <button
                  onClick={onMarkDone}
                  title={isDone ? 'Mark as undone' : 'Mark as done'}
                  style={{
                    height: 32, padding: '0 12px',
                    display: 'flex', alignItems: 'center', gap: 6,
                    borderRadius: 8, border: `1px solid ${isDone ? '#22C55E' : '#222'}`,
                    background: isDone ? 'rgba(34,197,94,0.1)' : '#1a1a1a',
                    color: isDone ? '#22C55E' : '#525252',
                    fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                    transition: 'all .15s', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#22C55E'; e.currentTarget.style.color = '#22C55E'; }}
                  onMouseLeave={e => { if (!isDone) { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.color = '#525252'; } }}
                >
                  {isDone ? '✓ Done' : '◯ Mark Done'}
                </button>
              )}
              <button
                ref={closeRef} onClick={onClose} aria-label="Close panel"
                style={{
                  flexShrink: 0, width: 32, height: 32,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 8, border: '1px solid #222', background: '#1a1a1a',
                  color: '#525252', fontSize: '1.1rem', lineHeight: 1,
                  cursor: 'pointer', transition: 'color .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#F5F5F5'}
                onMouseLeave={e => e.currentTarget.style.color = '#525252'}
              >×</button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: '-1px' }}>
            <button
              onClick={() => setTab('content')}
              style={{
                padding: '8px 16px', borderRadius: '8px 8px 0 0', cursor: 'pointer',
                border: '1px solid transparent',
                borderBottom: tab === 'content' ? '1px solid #141414' : '1px solid transparent',
                background: tab === 'content' ? '#141414' : 'transparent',
                color: tab === 'content' ? '#F5F5F5' : '#525252',
                fontSize: '0.82rem', fontWeight: 600, transition: 'color .15s',
              }}
            >
              📄 Content
            </button>
            <button
              onClick={handleAskAI}
              style={{
                padding: '8px 16px', borderRadius: '8px 8px 0 0', cursor: 'pointer',
                border: tab === 'ai' ? '1px solid rgba(245,166,35,0.3)' : '1px solid transparent',
                borderBottom: tab === 'ai' ? '1px solid #141414' : '1px solid transparent',
                background: tab === 'ai' ? 'rgba(245,166,35,0.06)' : 'transparent',
                color: tab === 'ai' ? '#F5A623' : '#737373',
                fontSize: '0.82rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'color .15s',
              }}
            >
              <span>✦</span> AI Tutor
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', overscrollBehavior: 'contain' }}>

          {/* ── CONTENT TAB ── */}
          {tab === 'content' && (
            <>
              <div className="prose" dangerouslySetInnerHTML={{ __html: contentHtml }} />

              {safeResources.length > 0 && (
                <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #1f1f1f' }}>
                  <p style={{
                    fontSize: '0.68rem', fontWeight: 700, color: '#525252',
                    fontFamily: '"Space Mono", monospace', letterSpacing: '0.14em',
                    textTransform: 'uppercase', margin: '0 0 12px',
                  }}>Resources</p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {safeResources.map((r, i) => (
                      <li key={i}>
                        <a
                          href={r.url} target="_blank" rel="noopener noreferrer"
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            gap: 12, padding: '10px 14px', borderRadius: 8,
                            border: '1px solid #1f1f1f', background: '#1a1a1a',
                            color: '#A3A3A3', fontSize: '0.84rem', fontWeight: 500,
                            textDecoration: 'none', transition: 'all .15s',
                          }}
                          onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = '#F5A623'; el.style.color = '#F5F5F5'; el.style.background = 'rgba(245,166,35,0.05)'; }}
                          onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = '#1f1f1f'; el.style.color = '#A3A3A3'; el.style.background = '#1a1a1a'; }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                          <span style={{ fontSize: '0.75rem', color: '#525252', flexShrink: 0 }} aria-hidden="true">↗</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AI nudge */}
              <div
                onClick={handleAskAI} role="button" tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && handleAskAI()}
                style={{
                  marginTop: 24, padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                  background: 'rgba(245,166,35,0.05)', border: '1px solid rgba(245,166,35,0.2)',
                  transition: 'background .15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,166,35,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(245,166,35,0.05)')}
              >
                <p style={{ fontSize: '0.84rem', color: '#A3A3A3', margin: 0, lineHeight: 1.6 }}>
                  ✦ <strong style={{ color: '#F5A623' }}>Ask AI</strong> to explain <em>{nodeLabel}</em> — click the AI Tutor tab or here →
                </p>
              </div>
            </>
          )}

          {/* ── AI TUTOR TAB ── */}
          {tab === 'ai' && (
            <>
              {/* Loading */}
              {aiLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '52px 0', gap: 16 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    border: '3px solid #1f1f1f', borderTopColor: '#F5A623',
                    animation: 'ai-spin 0.75s linear infinite',
                  }} />
                  <p style={{ fontSize: '0.84rem', color: '#525252', margin: 0, textAlign: 'center' }}>
                    Asking Gemini about <strong style={{ color: '#A3A3A3' }}>{nodeLabel}</strong>…
                  </p>
                  <style>{`@keyframes ai-spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {/* Error */}
              {aiError && !aiLoading && (
                <div style={{
                  padding: '16px', borderRadius: 10, marginBottom: 16,
                  background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
                }}>
                  <p style={{ fontSize: '0.84rem', color: '#FCA5A5', margin: '0 0 10px', lineHeight: 1.6 }}>
                    ⚠ {aiError}
                  </p>
                  <button onClick={regenerate} style={{
                    fontSize: '0.78rem', color: '#F5A623', background: 'none',
                    border: 'none', cursor: 'pointer', padding: 0,
                  }}>
                    Try again →
                  </button>
                </div>
              )}

              {/* AI Response */}
              {aiHtml && !aiLoading && (
                <>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 18, padding: '8px 12px', borderRadius: 8,
                    background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.15)',
                  }}>
                    <span style={{ fontSize: '1rem' }}>✦</span>
                    <span style={{ fontSize: '0.75rem', color: '#737373', flex: 1 }}>
                      Explained by <strong style={{ color: '#F5A623' }}>Llama 3.1 (Groq)</strong>
                    </span>
                    <button
                      onClick={regenerate}
                      style={{
                        fontSize: '0.72rem', color: '#525252', background: 'none',
                        border: '1px solid #222', borderRadius: 6,
                        padding: '3px 8px', cursor: 'pointer', transition: 'color .15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#A3A3A3'}
                      onMouseLeave={e => e.currentTarget.style.color = '#525252'}
                    >
                      ↺ Regenerate
                    </button>
                  </div>
                  <div className="prose" dangerouslySetInnerHTML={{ __html: aiHtml }} />

                  {/* What to learn next */}
                  {nextTopic && (
                    <div style={{
                      marginTop: 20, padding: '14px 16px', borderRadius: 10,
                      background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.2)',
                    }}>
                      <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#F5A623', margin: '0 0 6px', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: '"Space Mono", monospace' }}>
                        ✦ What to learn next
                      </p>
                      <p style={{ fontSize: '0.85rem', color: '#A3A3A3', margin: 0, lineHeight: 1.6 }}>
                        {nextTopic}
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
});

export default TopicPanel;
