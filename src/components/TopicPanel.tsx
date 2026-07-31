/**
 * TopicPanel.tsx
 * - Slide-in panel with topic content + AI Tutor (Gemini 1.5 Flash, free)
 * - API key stored in localStorage — no backend needed
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
}

marked.setOptions({ gfm: true, breaks: false });

function isSafeUrl(u: string) {
  try { return new URL(u).protocol === 'https:'; } catch { return false; }
}

async function renderMd(text: string): Promise<string> {
  const raw = await marked.parse(text, { async: false }) as string;
  return await sanitizeHtml(raw);
}

// ── Gemini API call ────────────────────────────────────────────────────
async function callGemini(apiKey: string, topic: string, roadmap: string): Promise<string> {
  const prompt = `You are an expert developer mentor and teacher. 
A student is learning "${topic}" as part of their ${roadmap} learning journey.

Give a clear, helpful explanation covering:
**1. What is ${topic}?**
A simple, jargon-free definition.

**2. Why does it matter?**
Real-world importance and use cases.

**3. Key concepts to master**
The 4–6 most important things to understand (use bullet points).

**4. How to get started**
Concrete first steps a beginner can take today.

**5. Common mistakes to avoid**
2–3 pitfalls beginners often hit.

Keep the tone friendly, practical, and motivating. Use markdown. Be concise but thorough (around 400–600 words).`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 900, temperature: 0.7 },
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? 'Gemini API error');
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

// ── Component ──────────────────────────────────────────────────────────
const TopicPanel = memo(function TopicPanel({
  isOpen, onClose, nodeLabel, roadmapTitle, markdownBody, resources,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [contentHtml, setContentHtml] = useState('');

  // AI Tutor state
  const [tab, setTab] = useState<'content' | 'ai'>('content');
  const [aiHtml, setAiHtml] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem('cosmic-gemini-key') ?? ''; } catch { return ''; }
  });
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');

  // Reset AI state when topic changes
  useEffect(() => {
    setAiHtml('');
    setAiError('');
    setAiLoading(false);
    setShowKeyInput(false);
    setTab('content');
  }, [nodeLabel]);

  // Render static markdown
  useEffect(() => {
    if (!markdownBody) {
      setContentHtml('<p style="color:#525252;font-size:0.9rem;line-height:1.75;">No written content yet — click <strong style="color:#F5A623">Ask AI</strong> above for an instant explanation!</p>');
      return;
    }
    let cancelled = false;
    (async () => {
      const safe = await renderMd(markdownBody);
      if (!cancelled) setContentHtml(safe);
    })();
    return () => { cancelled = true; };
  }, [markdownBody]);

  // Focus + Escape
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

  // ── Ask AI ────────────────────────────────────────────────────────────
  const handleAskAI = async () => {
    if (!apiKey) { setShowKeyInput(true); setTab('ai'); return; }
    setTab('ai');
    if (aiHtml) return; // already fetched for this topic
    setAiLoading(true);
    setAiError('');
    try {
      const text = await callGemini(apiKey, nodeLabel, roadmapTitle);
      const safe = await renderMd(text);
      setAiHtml(safe);
    } catch (e: any) {
      setAiError(e?.message ?? 'Something went wrong. Check your API key.');
    }
    setAiLoading(false);
  };

  const saveKey = () => {
    const k = keyDraft.trim();
    if (!k) return;
    localStorage.setItem('cosmic-gemini-key', k);
    setApiKey(k);
    setShowKeyInput(false);
    setKeyDraft('');
    // Immediately ask AI with the new key
    setAiLoading(true);
    setAiError('');
    callGemini(k, nodeLabel, roadmapTitle).then(async text => {
      const safe = await renderMd(text);
      setAiHtml(safe);
    }).catch(e => {
      setAiError(e?.message ?? 'Failed. Double-check your API key.');
    }).finally(() => setAiLoading(false));
  };

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
          width: 500, maxWidth: '100vw',
          background: '#141414', borderLeft: '1px solid #1f1f1f',
          display: 'flex', flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform .35s cubic-bezier(0.16,1,0.3,1)',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.7)',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          flexShrink: 0, padding: '20px 24px 0',
          borderBottom: '1px solid #1f1f1f',
        }}>
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
            <button
              ref={closeRef} onClick={onClose} aria-label="Close panel"
              style={{
                flexShrink: 0, width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8, border: '1px solid #222',
                background: '#1a1a1a', color: '#525252',
                fontSize: '1.1rem', lineHeight: 1, cursor: 'pointer',
                transition: 'color .15s, border-color .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#F5F5F5'; e.currentTarget.style.borderColor = '#404040'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#525252'; e.currentTarget.style.borderColor = '#222'; }}
            >×</button>
          </div>

          {/* ── Tab bar ── */}
          <div style={{ display: 'flex', gap: 4, marginBottom: '-1px' }}>
            {/* Content tab */}
            <button
              onClick={() => setTab('content')}
              style={{
                padding: '8px 16px', borderRadius: '8px 8px 0 0',
                border: '1px solid transparent',
                borderBottom: tab === 'content' ? '1px solid #141414' : '1px solid transparent',
                background: tab === 'content' ? '#141414' : 'transparent',
                color: tab === 'content' ? '#F5F5F5' : '#525252',
                fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                transition: 'color .15s',
              }}
            >
              📄 Content
            </button>

            {/* AI Tutor tab */}
            <button
              onClick={handleAskAI}
              style={{
                padding: '8px 16px', borderRadius: '8px 8px 0 0',
                border: tab === 'ai' ? '1px solid #F5A623' : '1px solid transparent',
                borderBottom: tab === 'ai' ? '1px solid #141414' : '1px solid transparent',
                background: tab === 'ai' ? 'rgba(245,166,35,0.08)' : 'transparent',
                color: tab === 'ai' ? '#F5A623' : '#737373',
                fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'color .15s, border-color .15s',
              }}
            >
              <span style={{ fontSize: '1rem' }}>✦</span>
              AI Tutor
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
                  }}>
                    Resources
                  </p>
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

              {/* Ask AI nudge */}
              <div
                onClick={handleAskAI}
                style={{
                  marginTop: 24, padding: '14px 16px', borderRadius: 10,
                  background: 'rgba(245,166,35,0.05)',
                  border: '1px solid rgba(245,166,35,0.2)',
                  cursor: 'pointer', transition: 'background .15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,166,35,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(245,166,35,0.05)')}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && handleAskAI()}
              >
                <p style={{ fontSize: '0.84rem', color: '#A3A3A3', margin: 0, lineHeight: 1.6 }}>
                  ✦ <strong style={{ color: '#F5A623' }}>Get an AI explanation</strong> for this topic — click the <em>AI Tutor</em> tab above or here.
                </p>
              </div>
            </>
          )}

          {/* ── AI TUTOR TAB ── */}
          {tab === 'ai' && (
            <>
              {/* API key entry */}
              {showKeyInput && (
                <div style={{
                  padding: '20px', borderRadius: 12,
                  background: '#111', border: '1px solid #1f1f1f',
                  marginBottom: 20,
                }}>
                  <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#F5F5F5', margin: '0 0 6px' }}>
                    ✦ Enter your Gemini API Key
                  </p>
                  <p style={{ fontSize: '0.8rem', color: '#525252', margin: '0 0 14px', lineHeight: 1.6 }}>
                    Get a <strong>free key</strong> (1,500 requests/day) at{' '}
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
                      style={{ color: '#F5A623', textDecoration: 'none' }}>
                      aistudio.google.com →
                    </a>
                    <br />Your key is saved locally in your browser only.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="password"
                      placeholder="AIza..."
                      value={keyDraft}
                      onChange={e => setKeyDraft(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveKey()}
                      autoFocus
                      style={{
                        flex: 1, padding: '9px 12px', borderRadius: 8,
                        border: '1px solid #2a2a2a', background: '#0D0D0D',
                        color: '#F5F5F5', fontSize: '0.84rem', outline: 'none',
                        fontFamily: '"Space Mono", monospace',
                      }}
                    />
                    <button
                      onClick={saveKey}
                      style={{
                        padding: '9px 18px', borderRadius: 8, border: 'none',
                        background: '#F5A623', color: '#0D0D0D',
                        fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer',
                        transition: 'background .15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FCD068')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#F5A623')}
                    >
                      Save & Ask
                    </button>
                  </div>
                </div>
              )}

              {/* Loading */}
              {aiLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 16 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    border: '3px solid #1f1f1f', borderTopColor: '#F5A623',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  <p style={{ fontSize: '0.84rem', color: '#525252', margin: 0 }}>
                    Asking Gemini about <strong style={{ color: '#A3A3A3' }}>{nodeLabel}</strong>…
                  </p>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {/* Error */}
              {aiError && !aiLoading && (
                <div style={{
                  padding: '16px', borderRadius: 10, marginBottom: 16,
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                }}>
                  <p style={{ fontSize: '0.84rem', color: '#FCA5A5', margin: '0 0 10px' }}>
                    ⚠ {aiError}
                  </p>
                  <button
                    onClick={() => { setShowKeyInput(true); setApiKey(''); localStorage.removeItem('cosmic-gemini-key'); }}
                    style={{
                      fontSize: '0.78rem', color: '#F5A623', background: 'none', border: 'none',
                      cursor: 'pointer', padding: 0, textDecoration: 'underline',
                    }}
                  >
                    Update API key
                  </button>
                </div>
              )}

              {/* AI Response */}
              {aiHtml && !aiLoading && (
                <>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 16, padding: '8px 12px', borderRadius: 8,
                    background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.15)',
                  }}>
                    <span style={{ fontSize: '1rem' }}>✦</span>
                    <span style={{ fontSize: '0.75rem', color: '#737373', flex: 1 }}>
                      Explained by <strong style={{ color: '#F5A623' }}>Gemini 1.5 Flash</strong>
                    </span>
                    <button
                      onClick={() => { setAiHtml(''); handleAskAI(); }}
                      style={{
                        fontSize: '0.72rem', color: '#525252', background: 'none',
                        border: '1px solid #222', borderRadius: 6,
                        padding: '3px 8px', cursor: 'pointer', transition: 'color .15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#A3A3A3')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#525252')}
                    >
                      ↺ Regenerate
                    </button>
                  </div>
                  <div className="prose" dangerouslySetInnerHTML={{ __html: aiHtml }} />
                </>
              )}

              {/* Initial state — no key yet, not loading */}
              {!aiHtml && !aiLoading && !aiError && !showKeyInput && (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✦</div>
                  <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#F5F5F5', marginBottom: 8 }}>
                    AI Tutor
                  </p>
                  <p style={{ fontSize: '0.82rem', color: '#525252', lineHeight: 1.7, marginBottom: 20 }}>
                    Get a personalized explanation of <strong style={{ color: '#A3A3A3' }}>{nodeLabel}</strong> powered by Gemini AI.
                  </p>
                  <button
                    onClick={() => setShowKeyInput(true)}
                    style={{
                      padding: '10px 24px', borderRadius: 9, border: 'none',
                      background: '#F5A623', color: '#0D0D0D',
                      fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Set up AI Tutor (free)
                  </button>
                </div>
              )}

              {/* Change key link */}
              {apiKey && !showKeyInput && !aiLoading && (
                <div style={{ marginTop: 24, textAlign: 'center' }}>
                  <button
                    onClick={() => { setShowKeyInput(true); setKeyDraft(apiKey); }}
                    style={{
                      fontSize: '0.72rem', color: '#2a2a2a', background: 'none',
                      border: 'none', cursor: 'pointer', transition: 'color .15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#525252')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#2a2a2a')}
                  >
                    Change API key
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
});

export default TopicPanel;
