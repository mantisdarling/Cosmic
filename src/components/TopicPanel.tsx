import { useEffect, useRef, useState, memo } from 'react';
import { marked } from 'marked';
import { sanitizeHtml, cleanAndParseJSON } from '../lib/clientSecurity';
import { fallbackChallenge, requestCodingChallenge, runCodingChallenge, type CodingChallenge, type ChallengeRun } from '../lib/challenges';

interface Resource {
  label: string;
  url: string;
}

interface TopicPanelProps {
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

// Validates that resource URLs use secure HTTPS protocol
function isSafeUrl(targetUrl: string): boolean {
  try {
    return new URL(targetUrl).protocol === 'https:';
  } catch {
    return false;
  }
}

// Parses markdown content into sanitized HTML
async function renderMarkdownContent(text: string): Promise<string> {
  const rawHtml = marked.parse(text, { async: false }) as string;
  return await sanitizeHtml(rawHtml);
}

// Fetches AI explanations from our serverless proxy endpoint
async function fetchAIExplanation(topic: string, roadmap: string): Promise<string> {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, roadmap }),
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error ?? 'Unable to generate AI explanation.');
  }
  return data.text as string;
}

// Requests recommended follow-up topic recommendations from AI
async function fetchNextTopicRecommendation(topic: string, roadmap: string): Promise<string> {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: `next-after-${topic}`,
      roadmap,
      prompt: `A student just finished learning "${topic}" in their ${roadmap} journey. In ONE short sentence, tell them the single most logical next topic to study after this. Format: "Next, learn **[Topic Name]** — [one-line reason why]." Be concise and direct.`,
    }),
  });
  const data = await response.json();
  if (!response.ok || data.error) return '';
  return data.text as string;
}

const TopicPanel = memo(function TopicPanel({
  isOpen,
  onClose,
  nodeLabel,
  roadmapTitle,
  markdownBody,
  resources,
  onMarkDone,
  isDone,
}: TopicPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [contentHtml, setContentHtml] = useState('');
  const [activeTab, setActiveTab] = useState<'content' | 'ai' | 'quiz' | 'challenge'>('content');
  const [aiHtml, setAiHtml] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [nextTopic, setNextTopic] = useState('');

  const [quizData, setQuizData] = useState<any[] | null>(null);
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState('');
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [challengeData, setChallengeData] = useState<CodingChallenge | null>(null);
  const [isChallengeLoading, setIsChallengeLoading] = useState(false);
  const [challengeError, setChallengeError] = useState('');
  const [challengeCode, setChallengeCode] = useState('');
  const [challengeRun, setChallengeRun] = useState<ChallengeRun | null>(null);
  const [studyNotes, setStudyNotes] = useState('');

  // Reset tab state when selected node changes
  useEffect(() => {
    setAiHtml('');
    setAiError('');
    setIsAiLoading(false);
    setQuizData(null);
    setQuizError('');
    setQuizAnswers({});
    setChallengeData(null);
    setChallengeError('');
    setChallengeCode('');
    setChallengeRun(null);
    try {
      setStudyNotes(localStorage.getItem(`cosmic-notes-${encodeURIComponent(roadmapTitle)}-${encodeURIComponent(nodeLabel)}`) ?? '');
    } catch {
      setStudyNotes('');
    }
    setActiveTab('content');
  }, [nodeLabel, roadmapTitle]);

  // Render provided static topic markdown
  useEffect(() => {
    if (!markdownBody) {
      setContentHtml(
        '<p style="color:#525252;font-size:0.9rem;line-height:1.75;">No written content available yet — try the <strong style="color:#F5A623">AI Tutor</strong> tab for an instant explanation!</p>'
      );
      return;
    }
    let isCancelled = false;
    (async () => {
      const safe = await renderMarkdownContent(markdownBody);
      if (!isCancelled) setContentHtml(safe);
    })();
    return () => {
      isCancelled = true;
    };
  }, [markdownBody]);

  // Handle auto-focus when panel opens
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => closeButtonRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Handle escape key listener to close panel
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scrolling when panel is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handler to fetch and render AI explanation
  const handleAskAI = async () => {
    setActiveTab('ai');
    if (aiHtml || isAiLoading) return;
    setIsAiLoading(true);
    setAiError('');
    setNextTopic('');

    try {
      const text = await fetchAIExplanation(nodeLabel, roadmapTitle);
      const safeHtml = await renderMarkdownContent(text);
      setAiHtml(safeHtml);
      fetchNextTopicRecommendation(nodeLabel, roadmapTitle).then((recommendedTopic) =>
        setNextTopic(recommendedTopic.replace(/\*\*/g, '').trim())
      );
    } catch (err: any) {
      setAiError(err?.message ?? 'Failed to get response from AI Tutor.');
    }
    setIsAiLoading(false);
  };

  const handleRegenerateAI = async () => {
    setAiHtml('');
    setAiError('');
    setNextTopic('');
    setIsAiLoading(true);

    try {
      const text = await fetchAIExplanation(nodeLabel, roadmapTitle);
      const safeHtml = await renderMarkdownContent(text);
      setAiHtml(safeHtml);
      fetchNextTopicRecommendation(nodeLabel, roadmapTitle).then((recommendedTopic) =>
        setNextTopic(recommendedTopic.replace(/\*\*/g, '').trim())
      );
    } catch (err: any) {
      setAiError(err?.message ?? 'Failed to refresh AI response.');
    }
    setIsAiLoading(false);
  };

  const handleAskQuiz = async () => {
    setActiveTab('quiz');
    if (quizData || isQuizLoading) return;
    setIsQuizLoading(true);
    setQuizError('');

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: nodeLabel, roadmap: roadmapTitle, action: 'quiz' }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error ?? 'Unable to generate quiz.');
      }
      
      const parsed = cleanAndParseJSON(data.text);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Invalid quiz format');
      setQuizData(parsed);
    } catch (err: any) {
      setQuizError(err?.message ?? 'Failed to generate quiz.');
    }
    setIsQuizLoading(false);
  };

  const handleAskChallenge = async () => {
    setActiveTab('challenge');
    if (challengeData || isChallengeLoading) return;
    setIsChallengeLoading(true);
    setChallengeError('');
    setChallengeRun(null);
    try {
      const challenge = await requestCodingChallenge(nodeLabel, roadmapTitle);
      setChallengeData(challenge);
      setChallengeCode(challenge.starterCode);
    } catch (error) {
      setChallengeData(fallbackChallenge(nodeLabel, roadmapTitle));
      setChallengeCode(fallbackChallenge(nodeLabel, roadmapTitle).starterCode);
      setChallengeError(error instanceof Error ? `${error.message} Showing a local practice challenge instead.` : 'AI is unavailable. Showing a local practice challenge instead.');
    } finally {
      setIsChallengeLoading(false);
    }
  };

  const handleRunChallenge = async () => {
    if (!challengeData) return;
    try {
      setChallengeError('');
      setChallengeRun(await runCodingChallenge(challengeData, challengeCode));
    } catch (error) {
      setChallengeRun(null);
      setChallengeError(error instanceof Error ? error.message : 'Unable to run this solution.');
    }
  };

  const safeResources = resources.filter(
    (resource) =>
      typeof resource.label === 'string' &&
      resource.label.length > 0 &&
      resource.label.length <= 120 &&
      isSafeUrl(resource.url)
  );

  return (
    <>
      {/* Background Backdrop Overlay */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Main Slide-in Topic Details Drawer */}
      <aside
        role="complementary"
        aria-label="Topic details"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          width: 500,
          maxWidth: '100vw',
          background: '#141722',
          borderLeft: '1px solid #1E2333',
          display: 'flex',
          flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.35s cubic-bezier(0.16,1,0.3,1)',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header containing title, mark done action, and tabs */}
        <div style={{ flexShrink: 0, padding: '20px 24px 0', borderBottom: '1px solid #1E2333' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
              <p
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  color: '#F5A623',
                  fontFamily: '"Space Mono", monospace',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  margin: '0 0 8px',
                }}
              >
                {roadmapTitle}
              </p>
              <h2
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  color: '#F5F5F5',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.3,
                  margin: 0,
                }}
              >
                {nodeLabel || '—'}
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {onMarkDone && (
                <button
                  onClick={onMarkDone}
                  title={isDone ? 'Mark as undone' : 'Mark as done'}
                  style={{
                    height: 32,
                    padding: '0 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    borderRadius: 8,
                    border: `1px solid ${isDone ? '#22C55E' : '#2A3147'}`,
                    background: isDone ? 'rgba(34,197,94,0.1)' : '#10121A',
                    color: isDone ? '#22C55E' : '#A3A3A3',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    fontFamily: 'inherit',
                  }}
                >
                  {isDone ? '✓ Done' : '◯ Mark Done'}
                </button>
              )}

              <button
                ref={closeButtonRef}
                onClick={onClose}
                aria-label="Close panel"
                style={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  border: '1px solid #2A3147',
                  background: '#10121A',
                  color: '#A3A3A3',
                  fontSize: '1.1rem',
                  lineHeight: 1,
                  cursor: 'pointer',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#F5F5F5')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#A3A3A3')}
              >
                ×
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: '-1px' }}>
            <button
              onClick={() => setActiveTab('content')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                border: '1px solid transparent',
                borderBottom: activeTab === 'content' ? '1px solid #141722' : '1px solid transparent',
                background: activeTab === 'content' ? '#141722' : 'transparent',
                color: activeTab === 'content' ? '#F5F5F5' : '#737373',
                fontSize: '0.82rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'color 0.15s ease',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>📄</span>
              <span>Content</span>
            </button>

            <button
              onClick={handleAskAI}
              style={{
                padding: '8px 16px',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                border: activeTab === 'ai' ? '1px solid rgba(245,166,35,0.3)' : '1px solid transparent',
                borderBottom: activeTab === 'ai' ? '1px solid #141722' : '1px solid transparent',
                background: activeTab === 'ai' ? 'rgba(245,166,35,0.06)' : 'transparent',
                color: activeTab === 'ai' ? '#F5A623' : '#737373',
                fontSize: '0.82rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'color 0.15s ease',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>✦</span>
              <span>AI Tutor</span>
            </button>

            <button
              onClick={handleAskQuiz}
              style={{
                padding: '8px 16px',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                border: activeTab === 'quiz' ? '1px solid rgba(0,229,255,0.3)' : '1px solid transparent',
                borderBottom: activeTab === 'quiz' ? '1px solid #141722' : '1px solid transparent',
                background: activeTab === 'quiz' ? 'rgba(0,229,255,0.06)' : 'transparent',
                color: activeTab === 'quiz' ? '#00E5FF' : '#737373',
                fontSize: '0.82rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'color 0.15s ease',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>🎯</span>
              <span>Quiz</span>
            </button>

            <button
              onClick={handleAskChallenge}
              style={{
                padding: '8px 16px', borderRadius: '8px 8px 0 0', cursor: 'pointer',
                border: activeTab === 'challenge' ? '1px solid rgba(98,244,190,0.3)' : '1px solid transparent',
                borderBottom: activeTab === 'challenge' ? '1px solid #141722' : '1px solid transparent',
                background: activeTab === 'challenge' ? 'rgba(98,244,190,0.06)' : 'transparent',
                color: activeTab === 'challenge' ? '#62F4BE' : '#737373', fontSize: '0.82rem', fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'color 0.15s ease', fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>⌘</span>
              <span>Challenge</span>
            </button>
          </div>
        </div>

        {/* Scrollable Drawer Body Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', overscrollBehavior: 'contain' }}>
          {/* Static Content Tab */}
          {activeTab === 'content' && (
            <>
              <div className="prose" dangerouslySetInnerHTML={{ __html: contentHtml }} />

              <div style={{ marginTop: 24, padding: 16, borderRadius: 10, border: '1px solid rgba(0,229,255,0.16)', background: 'rgba(0,229,255,0.035)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 9 }}>
                  <label htmlFor="topic-notes" style={{ color: '#9EEBFF', fontFamily: '"Space Mono", monospace', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Study notes</label>
                  <span style={{ color: '#6F7B95', fontSize: '0.68rem' }}>Saved on this device</span>
                </div>
                <textarea id="topic-notes" value={studyNotes} onChange={(event) => { const value = event.target.value.slice(0, 4000); setStudyNotes(value); try { localStorage.setItem(`cosmic-notes-${encodeURIComponent(roadmapTitle)}-${encodeURIComponent(nodeLabel)}`, value); } catch { /* storage can be unavailable */ } }} placeholder={`Capture the key idea, an example, or a question about ${nodeLabel}…`} style={{ width: '100%', minHeight: 120, resize: 'vertical', padding: '12px', border: '1px solid #2A3550', borderRadius: 8, outline: 'none', background: '#0B101B', color: '#DCE4F5', fontFamily: 'inherit', fontSize: '0.82rem', lineHeight: 1.6 }} />
              </div>

              {safeResources.length > 0 && (
                <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #1E2333' }}>
                  <p
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: '#525252',
                      fontFamily: '"Space Mono", monospace',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      margin: '0 0 12px',
                    }}
                  >
                    Resources
                  </p>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    {safeResources.map((resource, index) => (
                      <li key={index}>
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            padding: '10px 14px',
                            borderRadius: 8,
                            border: '1px solid #1E2333',
                            background: '#10121A',
                            color: '#A3A3A3',
                            fontSize: '0.84rem',
                            fontWeight: 500,
                            textDecoration: 'none',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            const element = e.currentTarget;
                            element.style.borderColor = '#F5A623';
                            element.style.color = '#F5F5F5';
                            element.style.background = 'rgba(245,166,35,0.05)';
                          }}
                          onMouseLeave={(e) => {
                            const element = e.currentTarget;
                            element.style.borderColor = '#1E2333';
                            element.style.color = '#A3A3A3';
                            element.style.background = '#10121A';
                          }}
                        >
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {resource.label}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#525252', flexShrink: 0 }} aria-hidden="true">
                            ↗
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Callout box triggering AI explanation */}
              <div
                onClick={handleAskAI}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                style={{
                  marginTop: 24,
                  padding: '14px 16px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  background: 'rgba(245,166,35,0.05)',
                  border: '1px solid rgba(245,166,35,0.2)',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245,166,35,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(245,166,35,0.05)')}
              >
                <p style={{ fontSize: '0.84rem', color: '#A3A3A3', margin: 0, lineHeight: 1.6 }}>
                  ✦ <strong style={{ color: '#F5A623' }}>Ask AI</strong> to explain <em>{nodeLabel}</em> — click the AI Tutor tab or here →
                </p>
              </div>
            </>
          )}

            {/* Coding Challenge Tab */}
          {activeTab === 'challenge' && (
            <div style={{ animation: 'fadeUp 0.3s ease both' }}>
              {isChallengeLoading ? (
                <div style={{ padding: '46px 0', textAlign: 'center' }}>
                  <div style={{ width: 30, height: 30, margin: '0 auto 14px', border: '2px solid rgba(98,244,190,0.2)', borderTopColor: '#62F4BE', borderRadius: '50%', animation: 'challengeSpin 0.75s linear infinite' }} />
                  <p style={{ color: '#A3A3A3', fontSize: '0.88rem' }}>Designing a JavaScript challenge for {nodeLabel}…</p>
                  <style>{`@keyframes challengeSpin { to { transform: rotate(360deg); } }`}</style>
                </div>
              ) : challengeData ? (
                <>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 9px', borderRadius: 99, background: 'rgba(98,244,190,0.08)', border: '1px solid rgba(98,244,190,0.22)', color: '#62F4BE', fontFamily: '"Space Mono", monospace', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    <span aria-hidden="true">●</span> Live JavaScript lab
                  </div>
                  <h3 style={{ margin: '16px 0 8px', color: '#F5F5F5', fontSize: '1.18rem', letterSpacing: '-0.03em' }}>{challengeData.title}</h3>
                  <p style={{ margin: '0 0 18px', color: '#AAB7D0', fontSize: '0.88rem', lineHeight: 1.65 }}>{challengeData.brief}</p>
                  {challengeError && <p role="status" style={{ margin: '0 0 14px', padding: '10px 12px', borderRadius: 8, color: '#FCD068', background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.18)', fontSize: '0.76rem', lineHeight: 1.5 }}>{challengeError}</p>}
                  <label htmlFor="challenge-code" style={{ display: 'block', marginBottom: 7, color: '#6F7B95', fontFamily: '"Space Mono", monospace', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Your solution · function solve</label>
                  <textarea id="challenge-code" value={challengeCode} onChange={(event) => { setChallengeCode(event.target.value); setChallengeRun(null); }} spellCheck={false} aria-label="Coding challenge solution" style={{ width: '100%', minHeight: 180, resize: 'vertical', padding: '14px', border: '1px solid #2A3550', borderRadius: 10, outline: 'none', background: '#0B101B', color: '#DCE4F5', fontFamily: '"Space Mono", monospace', fontSize: '0.74rem', lineHeight: 1.6 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    <button type="button" onClick={handleRunChallenge} style={{ padding: '9px 14px', border: '1px solid #62F4BE', borderRadius: 8, background: '#62F4BE', color: '#08110F', fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer' }}>Run tests</button>
                    <button type="button" onClick={() => { setChallengeData(null); setChallengeRun(null); setChallengeError(''); handleAskChallenge(); }} style={{ padding: '9px 12px', border: '1px solid #2A3550', borderRadius: 8, background: 'transparent', color: '#AAB7D0', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}>New challenge</button>
                    <span style={{ marginLeft: 'auto', color: '#6F7B95', fontFamily: '"Space Mono", monospace', fontSize: '0.62rem' }}>{challengeData.tests.length} tests · browser only</span>
                  </div>
                  {challengeRun && (
                    <div role="status" style={{ marginTop: 16, padding: 14, borderRadius: 10, border: `1px solid ${challengeRun.passed === challengeRun.total ? 'rgba(98,244,190,0.35)' : 'rgba(245,166,35,0.25)'}`, background: challengeRun.passed === challengeRun.total ? 'rgba(98,244,190,0.08)' : 'rgba(245,166,35,0.06)' }}>
                      <strong style={{ display: 'block', color: challengeRun.passed === challengeRun.total ? '#62F4BE' : '#FCD068', fontSize: '0.88rem' }}>{challengeRun.passed}/{challengeRun.total} tests passing</strong>
                      <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                        {challengeRun.outputs.map((result, index) => <div key={index} style={{ color: result.passed ? '#62F4BE' : '#FCA5A5', fontFamily: '"Space Mono", monospace', fontSize: '0.65rem' }}>{result.passed ? '✓' : '×'} Test {index + 1}{result.error ? ` · ${result.error}` : ''}</div>)}
                      </div>
                    </div>
                  )}
                  <details style={{ marginTop: 16, color: '#8B98B3', fontSize: '0.78rem' }}>
                    <summary style={{ cursor: 'pointer', color: '#F5A623', fontWeight: 700 }}>Need a hint?</summary>
                    <p style={{ margin: '10px 0 0', lineHeight: 1.6 }}>{challengeData.hint}</p>
                  </details>
                </>
              ) : null}
            </div>
          )}

          {/* Quiz Tab */}
          {activeTab === 'quiz' && (
            <div style={{ animation: 'fadeUp 0.3s ease both' }}>
              {isQuizLoading ? (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      margin: '0 auto 16px',
                      border: '2px solid rgba(0,229,255,0.2)',
                      borderTopColor: '#00E5FF',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                  <p style={{ color: '#A3A3A3', fontSize: '0.9rem' }}>
                    Generating quiz for {nodeLabel}...
                  </p>
                </div>
              ) : quizError ? (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    color: '#EF4444',
                    fontSize: '0.9rem',
                    lineHeight: 1.5,
                  }}
                >
                  <p style={{ margin: '0 0 12px' }}>
                    <strong>Error:</strong> {quizError}
                  </p>
                  <button
                    onClick={handleAskQuiz}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      background: 'rgba(239,68,68,0.2)',
                      border: 'none',
                      color: '#EF4444',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Try Again
                  </button>
                </div>
              ) : quizData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                  {quizData.map((q, qIndex) => {
                    const selected = quizAnswers[qIndex];
                    const isAnswered = selected !== undefined;
                    return (
                      <div key={qIndex} style={{ borderBottom: '1px solid #1E2333', paddingBottom: 24 }}>
                        <h3 style={{ color: '#F5F5F5', fontSize: '1rem', marginBottom: 16 }}>{q.question}</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {q.options.map((opt: string, optIndex: number) => {
                            const isSelected = selected === optIndex;
                            const isCorrect = q.answerIndex === optIndex;
                            let bg = '#10121A';
                            let border = '#2A3147';
                            let color = '#A3A3A3';

                            if (isAnswered) {
                              if (isCorrect) {
                                bg = 'rgba(34,197,94,0.1)'; border = '#22C55E'; color = '#22C55E';
                              } else if (isSelected) {
                                bg = 'rgba(239,68,68,0.1)'; border = '#EF4444'; color = '#EF4444';
                              }
                            }

                            return (
                              <button
                                key={optIndex}
                                disabled={isAnswered}
                                onClick={() => setQuizAnswers(prev => ({ ...prev, [qIndex]: optIndex }))}
                                style={{
                                  textAlign: 'left', padding: '12px 16px', borderRadius: 8,
                                  background: bg, border: `1px solid ${border}`, color: color,
                                  cursor: isAnswered ? 'default' : 'pointer', transition: 'all 0.2s'
                                }}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                        {isAnswered && (
                          <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: '#10121A', border: '1px solid #1E2333', color: '#E5E5E5', fontSize: '0.85rem' }}>
                            <strong>Explanation:</strong> {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          )}

          {/* AI Tutor Tab */}
          {activeTab === 'ai' && (
            <>
              {/* Spinner while waiting for server response */}
              {isAiLoading && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '52px 0',
                    gap: 16,
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      border: '3px solid #1E2333',
                      borderTopColor: '#F5A623',
                      animation: 'aiSpin 0.75s linear infinite',
                    }}
                  />
                  <p style={{ fontSize: '0.84rem', color: '#525252', margin: 0, textAlign: 'center' }}>
                    Generating response for <strong style={{ color: '#A3A3A3' }}>{nodeLabel}</strong>…
                  </p>
                  <style>{`@keyframes aiSpin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {/* Error Callout */}
              {aiError && !isAiLoading && (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 10,
                    marginBottom: 16,
                    background: 'rgba(239,68,68,0.07)',
                    border: '1px solid rgba(239,68,68,0.2)',
                  }}
                >
                  <p style={{ fontSize: '0.84rem', color: '#FCA5A5', margin: '0 0 10px', lineHeight: 1.6 }}>
                    ⚠ {aiError}
                  </p>
                  <button
                    onClick={handleRegenerateAI}
                    style={{
                      fontSize: '0.78rem',
                      color: '#F5A623',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Try again →
                  </button>
                </div>
              )}

              {/* AI Generated Content */}
              {aiHtml && !isAiLoading && (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 18,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'rgba(245,166,35,0.06)',
                      border: '1px solid rgba(245,166,35,0.15)',
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>✦</span>
                    <span style={{ fontSize: '0.75rem', color: '#737373', flex: 1 }}>
                      Explained by <strong style={{ color: '#F5A623' }}>Llama 3.1 (Groq)</strong>
                    </span>
                    <button
                      onClick={handleRegenerateAI}
                      style={{
                        fontSize: '0.72rem',
                        color: '#737373',
                        background: 'none',
                        border: '1px solid #2A3147',
                        borderRadius: 6,
                        padding: '3px 8px',
                        cursor: 'pointer',
                        transition: 'color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#F5F5F5')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#737373')}
                    >
                      ↺ Regenerate
                    </button>
                  </div>
                  <div className="prose" dangerouslySetInnerHTML={{ __html: aiHtml }} />

                  {/* Recommendation Card */}
                  {nextTopic && (
                    <div
                      style={{
                        marginTop: 20,
                        padding: '14px 16px',
                        borderRadius: 10,
                        background: 'rgba(245,166,35,0.06)',
                        border: '1px solid rgba(245,166,35,0.2)',
                      }}
                    >
                      <p
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: '#F5A623',
                          margin: '0 0 6px',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          fontFamily: '"Space Mono", monospace',
                        }}
                      >
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
