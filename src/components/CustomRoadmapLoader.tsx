import React, { useEffect, useState } from 'react';
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
            <span style={{ fontSize: '1.2rem' }}>{roadmapData.icon}</span>
            <h1 id="custom-header-title" style={{
              fontSize: '0.92rem',
              fontWeight: 700,
              color: '#E5E5E5',
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
              margin: 0
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
              padding: '2px 8px',
              whiteSpace: 'nowrap'
            }}>
              {roadmapData.nodes.length} topics
            </span>
          </div>
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
