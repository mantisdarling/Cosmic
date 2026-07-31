/**
 * RoadmapCanvas.tsx
 * - No auth, no sign-in — fully free & open source
 * - Progress stored in localStorage per roadmap
 * - Simple, clean, no external dependencies for state
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
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

// localStorage key for this roadmap's progress
function storageKey(id: string) { return `cosmic-progress-${id}`; }

// Progress shape: nodeId → 'done' | 'bookmarked' | 'in-progress' | 'todo'
type ProgressMap = Record<string, string>;

export default function RoadmapCanvas({ roadmap, topicContents }: Props) {
  const [progress, setProgress] = useState<ProgressMap>(() => {
    try {
      const raw = typeof localStorage !== 'undefined'
        ? localStorage.getItem(storageKey(roadmap.id))
        : null;
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // Persist to localStorage whenever progress changes
  useEffect(() => {
    try { localStorage.setItem(storageKey(roadmap.id), JSON.stringify(progress)); } catch {}
  }, [progress, roadmap.id]);

  // Topic content lookup
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

  const handleProgressUpdate = useCallback((nodeId: string, status: string) => {
    setProgress(prev => {
      if (status === 'todo') {
        const n = { ...prev }; delete n[nodeId]; return n;
      }
      return { ...prev, [nodeId]: status };
    });
  }, []);

  // Stats
  const total = roadmap.nodes.length;
  const done = Object.values(progress).filter(s => s === 'done').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const activeTopic = activeNodeId ? topicMap.get(activeNodeId) : null;
  const activeNode = activeNodeId ? roadmap.nodes.find(n => n.id === activeNodeId) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0D0D0D' }}>

      {/* ── Progress toolbar ── */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 44,
        borderBottom: '1px solid #1a1a1a',
        background: '#111', gap: 16,
      }}>
        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 160, height: 4, borderRadius: 999,
            background: '#1f1f1f', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 999,
              width: `${pct}%`,
              background: pct === 100 ? '#22C55E' : '#F5A623',
              transition: 'width .5s ease',
            }} />
          </div>
          <span style={{
            fontSize: '0.72rem', fontWeight: 600, color: '#525252',
            fontFamily: 'Space Mono, monospace', whiteSpace: 'nowrap',
          }}>
            {done}/{total} completed
          </span>
          {pct === 100 && (
            <span style={{ fontSize: '0.75rem', color: '#22C55E', fontWeight: 700 }}>🎉 Done!</span>
          )}
        </div>

        {/* Reset button */}
        {done > 0 && (
          <button
            onClick={() => setProgress({})}
            style={{
              fontSize: '0.72rem', color: '#525252', background: 'none',
              border: '1px solid #1f1f1f', borderRadius: 6,
              padding: '4px 10px', cursor: 'pointer',
              fontFamily: 'Space Mono, monospace', transition: 'color .15s, border-color .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#A3A3A3'; e.currentTarget.style.borderColor = '#333'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#525252'; e.currentTarget.style.borderColor = '#1f1f1f'; }}
          >
            Reset progress
          </button>
        )}
      </div>

      {/* ── React Flow canvas ── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <RoadmapFlow
          roadmap={roadmap}
          progress={progress}
          onNodeClick={handleNodeClick}
        />
      </div>

      {/* ── Topic side panel ── */}
      <TopicPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        nodeId={activeNodeId}
        nodeLabel={activeNode?.label ?? ''}
        markdownBody={activeTopic?.markdownBody ?? ''}
        resources={activeTopic?.resources ?? []}
        progress={progress}
        onProgressUpdate={handleProgressUpdate}
      />
    </div>
  );
}
