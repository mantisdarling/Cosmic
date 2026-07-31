/**
 * RoadmapCanvas.tsx
 * - No auth, no progress tracking, no sign-in
 * - Click a node → TopicPanel slides in with content + resources
 * - Fully free and open source
 */

import { useState, useCallback, useMemo } from 'react';
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

export default function RoadmapCanvas({ roadmap, topicContents }: Props) {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // Build lookup map
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

  const activeTopic = activeNodeId ? topicMap.get(activeNodeId) : null;
  const activeNode = activeNodeId ? roadmap.nodes.find(n => n.id === activeNodeId) : null;

  return (
    <div style={{ width: '100%', height: '100%', background: '#0D0D0D', position: 'relative' }}>

      {/* ── React Flow canvas — static, no pan/zoom ── */}
      <RoadmapFlow
        roadmap={roadmap}
        progress={{}}
        onNodeClick={handleNodeClick}
      />

      {/* ── Topic side panel ── */}
      <TopicPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        nodeLabel={activeNode?.label ?? ''}
        markdownBody={activeTopic?.markdownBody ?? ''}
        resources={activeTopic?.resources ?? []}
      />
    </div>
  );
}
