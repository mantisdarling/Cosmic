/**
 * RoadmapCanvas.tsx — Orchestrates flow + panel + completion tracking + mobile fallback
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import RoadmapFlow from './RoadmapFlow';
import TopicPanel from './TopicPanel';
import { NodeIdSchema } from '../lib/security';
import type { Roadmap } from '../lib/security';

interface TopicContent {
  nodeId: string;
  markdownBody: string;
  resources: { label: string; url: string }[];
}

interface Props {
  roadmap: Roadmap;
  topicContents: TopicContent[];
}

const STORAGE_KEY = (id: string) => `cosmic-done-${id}`;

export default function RoadmapCanvas({ roadmap, topicContents }: Props) {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [doneNodes, setDoneNodes] = useState<Set<string>>(new Set());
  const [showBadge, setShowBadge] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Load done nodes from localStorage
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY(roadmap.id));
    if (raw) {
      try { setDoneNodes(new Set(JSON.parse(raw))); } catch {}
    }
    setIsMobile(window.innerWidth < 768);
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [roadmap.id]);

  const topicMap = useMemo(() => {
    const m = new Map<string, TopicContent>();
    topicContents.forEach(t => {
      const s = NodeIdSchema.safeParse(t.nodeId);
      if (s.success) m.set(s.data, t);
    });
    return m;
  }, [topicContents]);

  const handleNodeClick = useCallback((raw: string) => {
    const s = NodeIdSchema.safeParse(raw);
    if (!s.success) return;
    setActiveNodeId(s.data);
    setPanelOpen(true);
  }, []);

  const markDone = useCallback((nodeId: string) => {
    setDoneNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) { next.delete(nodeId); }
      else { next.add(nodeId); }
      localStorage.setItem(STORAGE_KEY(roadmap.id), JSON.stringify([...next]));
      return next;
    });
  }, [roadmap.id]);

  const activeTopic = activeNodeId ? topicMap.get(activeNodeId) : null;
  const activeNode  = activeNodeId ? roadmap.nodes.find(n => n.id === activeNodeId) : null;

  const totalTopics    = roadmap.nodes.filter(n => n.type !== 'root').length;
  const doneCount      = [...doneNodes].filter(id => roadmap.nodes.find(n => n.id === id)).length;
  const progressPct    = totalTopics > 0 ? Math.round((doneCount / totalTopics) * 100) : 0;
  const isComplete     = progressPct === 100;

  // ── Mobile list view ──────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ background: '#0D0D0D', minHeight: '100%', padding: '16px' }}>
        {/* Progress bar */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: '0.75rem', color: '#525252', fontFamily: 'Space Mono, monospace' }}>Progress</span>
            <span style={{ fontSize: '0.75rem', color: '#F5A623', fontWeight: 700, fontFamily: 'Space Mono, monospace' }}>{progressPct}%</span>
          </div>
          <div style={{ height: 4, background: '#1f1f1f', borderRadius: 99 }}>
            <div style={{ height: '100%', background: roadmap.color || '#F5A623', borderRadius: 99, width: `${progressPct}%`, transition: 'width .4s' }} />
          </div>
        </div>

        {/* Node list */}
        {roadmap.nodes.filter(n => n.type !== 'root').map(n => {
          const done = doneNodes.has(n.id);
          const accent = roadmap.color || '#F5A623';
          return (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <button
                onClick={() => { handleNodeClick(n.id); }}
                style={{
                  flex: 1, textAlign: 'left', padding: '12px 14px',
                  background: done ? `${accent}12` : '#141414',
                  border: `1.5px solid ${done ? accent : '#2a2a2a'}`,
                  borderRadius: 8, color: done ? accent : '#A3A3A3',
                  fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', transition: 'all .15s',
                }}
              >
                {n.label}
              </button>
              <button
                onClick={() => markDone(n.id)}
                title={done ? 'Mark undone' : 'Mark done'}
                style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  border: `1.5px solid ${done ? accent : '#2a2a2a'}`,
                  background: done ? accent : 'transparent',
                  color: done ? '#0D0D0D' : '#525252',
                  fontSize: '0.9rem', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                ✓
              </button>
            </div>
          );
        })}

        {/* Panel */}
        <TopicPanel
          isOpen={panelOpen}
          onClose={() => setPanelOpen(false)}
          nodeLabel={activeNode?.label ?? ''}
          roadmapTitle={roadmap.title}
          markdownBody={activeTopic?.markdownBody ?? ''}
          resources={activeTopic?.resources ?? []}
          onMarkDone={activeNodeId ? () => markDone(activeNodeId) : undefined}
          isDone={activeNodeId ? doneNodes.has(activeNodeId) : false}
        />
      </div>
    );
  }

  // ── Desktop canvas view ───────────────────────────────────────
  return (
    <div style={{ width: '100%', height: '100%', background: '#0B0C10', position: 'relative' }}>
      {/* Progress bar at top */}
      {doneCount > 0 && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3, zIndex: 5,
          background: '#1f1f1f',
        }}>
          <div style={{
            height: '100%', background: roadmap.color || '#F5A623',
            width: `${progressPct}%`, transition: 'width .5s',
          }} />
        </div>
      )}

      <RoadmapFlow
        roadmap={roadmap}
        progress={{}}
        onNodeClick={handleNodeClick}
        doneNodes={doneNodes}
      />

      {/* Completion badge trigger */}
      {isComplete && !showBadge && (
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 20,
          background: 'rgba(13,13,13,0.95)', border: `1px solid ${roadmap.color || '#F5A623'}`,
          borderRadius: 12, padding: '14px 24px',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: `0 0 40px ${roadmap.color || '#F5A623'}33`,
          animation: 'fadeUp .4s ease both',
        }}>
          <span style={{ fontSize: '1.5rem' }}>🎉</span>
          <div>
            <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#F5F5F5' }}>Roadmap Complete!</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#737373' }}>You've covered all {totalTopics} topics</p>
          </div>
          <button
            onClick={() => setShowBadge(true)}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: roadmap.color || '#F5A623', color: '#0D0D0D',
              fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Get Badge ✦
          </button>
        </div>
      )}

      {/* Completion Badge Modal */}
      {showBadge && (
        <div
          onClick={() => setShowBadge(false)}
          style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            id="completion-badge"
            style={{
              background: '#141414', border: `2px solid ${roadmap.color || '#F5A623'}`,
              borderRadius: 20, padding: '40px 48px', textAlign: 'center',
              maxWidth: 400, width: '90%',
              boxShadow: `0 0 80px ${roadmap.color || '#F5A623'}44`,
            }}
          >
            <div style={{ fontSize: '3.5rem', marginBottom: 12 }}>{roadmap.icon}</div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: roadmap.color || '#F5A623', letterSpacing: '0.15em', marginBottom: 10, fontFamily: 'Space Mono, monospace', textTransform: 'uppercase' }}>
              Certificate of Completion
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#F5F5F5', margin: '0 0 8px', letterSpacing: '-0.03em' }}>
              {roadmap.title}
            </h2>
            <p style={{ color: '#737373', fontSize: '0.85rem', margin: '0 0 24px', lineHeight: 1.6 }}>
              Completed all <strong style={{ color: '#F5F5F5' }}>{totalTopics} topics</strong> in this roadmap on Cosmic
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => {
                  const text = `I just completed the ${roadmap.title} roadmap on Cosmic! 🎉\n\n${window.location.href}`;
                  navigator.clipboard.writeText(text).catch(() => {});
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`I just completed the ${roadmap.title} roadmap on Cosmic! 🎉 ${window.location.href}`)}`, '_blank');
                }}
                style={{
                  padding: '10px 20px', borderRadius: 9, border: 'none',
                  background: roadmap.color || '#F5A623', color: '#0D0D0D',
                  fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                }}
              >
                Share on X ↗
              </button>
              <button
                onClick={() => setShowBadge(false)}
                style={{
                  padding: '10px 20px', borderRadius: 9,
                  border: '1px solid #2a2a2a', background: 'transparent',
                  color: '#737373', fontSize: '0.85rem', cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <TopicPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        nodeLabel={activeNode?.label ?? ''}
        roadmapTitle={roadmap.title}
        markdownBody={activeTopic?.markdownBody ?? ''}
        resources={activeTopic?.resources ?? []}
        onMarkDone={activeNodeId ? () => markDone(activeNodeId) : undefined}
        isDone={activeNodeId ? doneNodes.has(activeNodeId) : false}
      />
    </div>
  );
}
