import { useEffect, useState } from 'react';
import RoadmapCanvas from './RoadmapCanvas';
import { RoadmapSchema, type Roadmap } from '../lib/security';

export default function CustomRoadmapLoader() {
  const [roadmapData, setRoadmapData] = useState<Roadmap | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    try {
      const storedData = sessionStorage.getItem('custom_roadmap_data');
      if (!storedData) {
        setError('No custom roadmap data found. Please return to the homepage and generate one.');
        return;
      }

      const parsedData = JSON.parse(storedData);
      const validationResult = RoadmapSchema.safeParse(parsedData);

      if (!validationResult.success) {
        console.error('Validation errors:', validationResult.error.issues);
        setError('The generated roadmap format was invalid. Please try generating it again.');
        return;
      }

      setRoadmapData(validationResult.data);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred while loading the roadmap.');
    }
  }, []);

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#EF4444', fontFamily: 'sans-serif' }}>
        <h2>Error Loading Roadmap</h2>
        <p>{error}</p>
        <a href="/" style={{ color: '#00E5FF', textDecoration: 'underline', marginTop: '20px', display: 'inline-block' }}>
          Return Home
        </a>
      </div>
    );
  }

  if (!roadmapData) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', color: '#00E5FF' }}>
        <div style={{ animation: 'spin 1s linear infinite', border: '3px solid rgba(0,229,255,0.2)', borderTopColor: '#00E5FF', borderRadius: '50%', width: '40px', height: '40px' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0D0D0D' }}>
      {/* Top Bar */}
      <header style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '56px',
        padding: '0 20px',
        background: 'rgba(13,13,13,0.95)',
        borderBottom: '1px solid #1f1f1f',
        backdropFilter: 'blur(10px)',
        zIndex: 10,
        position: 'relative'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a href="/" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.78rem',
            fontWeight: 500,
            color: '#525252',
            textDecoration: 'none',
            padding: '5px 8px',
            borderRadius: '6px',
            transition: 'color .15s, background .15s'
          }}>
            ← All Roadmaps
          </a>
          <span style={{ color: '#2a2a2a', fontSize: '0.9rem' }}>/</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.25rem', lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{roadmapData.icon}</span>
            <h1 id="custom-header-title" style={{
              fontSize: '0.92rem',
              fontWeight: 700,
              color: '#E5E5E5',
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
              margin: 0,
              lineHeight: 1
            }}>
              {roadmapData.title}
            </h1>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 500,
              color: '#525252',
              background: '#1a1a1a',
              border: '1px solid #222',
              borderRadius: '999px',
              padding: '3px 8px',
              whiteSpace: 'nowrap',
              lineHeight: 1
            }}>
              {roadmapData.nodes.length} topics
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <a
            href="https://github.com/mantisdarling/cosmic"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              height: '28px',
              padding: '0 10px',
              borderRadius: '6px',
              border: '1px solid #1f1f1f',
              background: 'none',
              color: '#737373',
              fontSize: '0.72rem',
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none',
              transition: 'all .15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#A3A3A3'; e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.background = '#141722'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#737373'; e.currentTarget.style.borderColor = '#1f1f1f'; e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
            GitHub
          </a>
        </div>
      </header>

      {/* AI Tutor Banner */}
      <div style={{
        flexShrink: 0,
        padding: '10px 20px',
        background: 'linear-gradient(90deg, rgba(245,166,35,0.08) 0%, rgba(245,166,35,0.03) 100%)',
        borderBottom: '1px solid rgba(245,166,35,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: 'rgba(245,166,35,0.12)',
            border: '1px solid rgba(245,166,35,0.3)',
            borderRadius: '999px',
            padding: '3px 10px',
            fontSize: '0.68rem',
            fontWeight: 700,
            color: '#F5A623',
            fontFamily: '"Space Mono", monospace',
            letterSpacing: '0.05em'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F5A623', display: 'inline-block' }} />
            ✦ AI GENERATED
          </span>
          <span style={{ fontSize: '0.8rem', color: '#737373' }}>
            This learning path was dynamically generated by the Cosmic AI.
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <RoadmapCanvas roadmap={roadmapData} topicContents={[]} />
      </div>
    </div>
  );
}
