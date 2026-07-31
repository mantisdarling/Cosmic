/**
 * RoadmapFlow.tsx
 * - No Controls, no MiniMap (clean canvas like roadmap.sh)
 * - Large nodes, tight layout, LR direction
 * - No auth dependency
 */

import { useMemo, useEffect, useState, memo } from 'react';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import dagre from 'dagre';
import type { Roadmap, NodeStatus } from '../lib/security';
import '@xyflow/react/dist/style.css';

// ── Layout ───────────────────────────────────────────────────
const NW = 210;   // node width
const NH = 46;    // node height
const RH = 56;    // root height
const RS = 70;    // rank sep
const NS = 12;    // node sep

// ── Styles per status ─────────────────────────────────────────
const S: Record<string, { bg: string; border: string; color: string }> = {
  todo:         { bg: '#161616', border: '#2a2a2a', color: '#A3A3A3' },
  'in-progress':{ bg: '#1a1200', border: '#F5A623', color: '#FCD068' },
  done:         { bg: '#0a1a0a', border: '#22C55E', color: '#4ADE80' },
  bookmarked:   { bg: '#0a0f1a', border: '#3B82F6', color: '#60A5FA' },
};

// ── Node component ────────────────────────────────────────────
const FlowNode = memo(({ data }: {
  data: {
    label: string;
    isRoot: boolean;
    status: string;
    accent: string;
    onClick: () => void;
  };
}) => {
  const st = S[data.status] ?? S.todo;
  const [hov, setHov] = useState(false);

  if (data.isRoot) {
    return (
      <button
        onClick={data.onClick}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          width: NW, height: RH,
          background: hov ? data.accent : data.accent,
          border: `2px solid ${data.accent}`,
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: `0 0 32px ${data.accent}50`,
          filter: hov ? 'brightness(1.1)' : 'brightness(1)',
          transition: 'filter .15s, box-shadow .15s',
          outline: 'none',
        }}
        aria-label={`Open topic: ${data.label}`}
      >
        <span style={{
          fontSize: 14, fontWeight: 800, color: '#0D0D0D',
          fontFamily: 'Inter, system-ui, sans-serif',
          letterSpacing: '-0.03em', lineHeight: 1.2,
          textAlign: 'center', padding: '0 12px',
        }}>
          {data.label}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={data.onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: NW, height: NH,
        background: hov ? '#1f1f1f' : st.bg,
        border: `1.5px solid ${hov ? data.accent : st.border}`,
        borderRadius: 8,
        display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: 10,
        cursor: 'pointer', textAlign: 'left',
        transition: 'border-color .15s, background .15s, box-shadow .15s',
        boxShadow: hov ? `0 0 0 1px ${data.accent}40, 0 4px 16px rgba(0,0,0,0.5)` : 'none',
        outline: 'none',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      aria-label={`Open topic: ${data.label}`}
    >
      {/* Status bar on left edge */}
      <span style={{
        position: 'absolute', left: 0, top: 4, bottom: 4, width: 3,
        borderRadius: '0 3px 3px 0',
        background: data.status === 'todo' ? 'transparent' : st.border,
        transition: 'background .15s',
      }} aria-hidden="true" />

      <span style={{
        fontSize: 13, fontWeight: 500, color: hov ? '#F5F5F5' : st.color,
        letterSpacing: '-0.01em', lineHeight: 1.25,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        flex: 1, transition: 'color .15s',
      }}>
        {data.label}
      </span>

      {/* Status badge */}
      {data.status === 'done' && (
        <span style={{ fontSize: 12, color: '#22C55E', flexShrink: 0, fontWeight: 700 }}>✓</span>
      )}
      {data.status === 'bookmarked' && (
        <span style={{ fontSize: 11, color: '#3B82F6', flexShrink: 0 }}>◈</span>
      )}
      {data.status === 'in-progress' && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F5A623', flexShrink: 0, display: 'inline-block' }} aria-hidden="true" />
      )}
    </button>
  );
});
FlowNode.displayName = 'FlowNode';

const nodeTypes: NodeTypes = { flowNode: FlowNode as any };

// ── Dagre layout ──────────────────────────────────────────────
function layoutNodes(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: RS, nodesep: NS, marginx: 24, marginy: 24 });

  nodes.forEach(n => {
    const h = (n.data as any).isRoot ? RH : NH;
    g.setNode(n.id, { width: NW, height: h });
  });
  edges.forEach(e => g.setEdge(e.source, e.target));
  dagre.layout(g);

  return nodes.map(n => {
    const { x, y } = g.node(n.id);
    const h = (n.data as any).isRoot ? RH : NH;
    return { ...n, position: { x: x - NW / 2, y: y - h / 2 } };
  });
}

// ── Component ─────────────────────────────────────────────────
interface Props {
  roadmap: Roadmap;
  progress: Record<string, string>;  // nodeId → status
  onNodeClick: (id: string) => void;
}

export default function RoadmapFlow({ roadmap, progress, onNodeClick }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [ready, setReady] = useState(false);

  const { rfNodes, rfEdges } = useMemo(() => {
    const accent = roadmap.color || '#F5A623';

    const rfNodes: Node[] = roadmap.nodes.map(n => ({
      id: n.id,
      type: 'flowNode',
      position: { x: 0, y: 0 },
      data: {
        label: n.label,
        isRoot: n.type === 'root',
        status: progress[n.id] ?? 'todo',
        accent,
        onClick: () => onNodeClick(n.id),
      },
      selectable: false,
      draggable: false,
    }));

    const rfEdges: Edge[] = roadmap.nodes
      .filter(n => n.parentId !== null)
      .map(n => ({
        id: `e-${n.parentId}-${n.id}`,
        source: n.parentId!,
        target: n.id,
        type: 'smoothstep',
        style: { stroke: '#2a2a2a', strokeWidth: 1.5 },
      }));

    return { rfNodes, rfEdges };
  }, [roadmap, progress, onNodeClick]);

  useEffect(() => {
    const laid = layoutNodes(rfNodes, rfEdges);
    setNodes(laid);
    setEdges(rfEdges);
    // Small delay so ReactFlow is mounted before fitView
    setTimeout(() => setReady(true), 50);
  }, [rfNodes, rfEdges]);

  return (
    <div style={{ width: '100%', height: '100%', opacity: ready ? 1 : 0, transition: 'opacity .5s' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.1, maxZoom: 1.4, minZoom: 0.3 }}
        minZoom={0.15}
        maxZoom={3}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        panOnScroll={true}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        aria-label={`${roadmap.title} roadmap diagram`}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={32}
          size={1.2}
          color="#1e1e1e"
        />
        {/* No Controls, No MiniMap — clean like roadmap.sh */}
      </ReactFlow>
    </div>
  );
}
