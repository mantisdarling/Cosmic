/**
 * RoadmapFlow.tsx — React Flow canvas with yellow theme
 * Nodes rendered as clean roadmap.sh-style boxes.
 * Security: labels are React text nodes, never innerHTML.
 */

import { useCallback, useMemo, useEffect, useState, memo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import dagre from 'dagre';
import type { ProgressMap } from '../lib/firestore';
import type { Roadmap, NodeStatus } from '../lib/security';
import '@xyflow/react/dist/style.css';

// ── Layout constants ─────────────────────────────────────────────────────
const NODE_W = 230;
const NODE_H = 48;
const ROOT_H = 56;
const RANK_SEP = 90;
const NODE_SEP = 24;

// ── Status styles ────────────────────────────────────────────────────────
const STATUS: Record<string, { bg: string; border: string; dot: string; text: string }> = {
  todo:        { bg: '#141414', border: '#262626', dot: '#333',    text: '#A3A3A3' },
  'in-progress':{ bg: 'rgba(245,166,35,0.08)', border: '#F5A623', dot: '#F5A623', text: '#F5F5F5' },
  done:        { bg: 'rgba(34,197,94,0.08)',   border: '#22C55E', dot: '#22C55E', text: '#F5F5F5' },
  bookmarked:  { bg: 'rgba(59,130,246,0.08)', border: '#3B82F6', dot: '#3B82F6', text: '#F5F5F5' },
};

// ── Custom Node ──────────────────────────────────────────────────────────
const RoadmapNode = memo(({ data }: {
  data: { label: string; nodeType: string; status: string; accentColor: string; onClick: () => void }
}) => {
  const isRoot = data.nodeType === 'root';
  const s = STATUS[data.status] ?? STATUS.todo;

  return (
    <button
      onClick={data.onClick}
      aria-label={`Open topic: ${data.label}`}
      style={{
        width: NODE_W,
        height: isRoot ? ROOT_H : NODE_H,
        background: isRoot ? `rgba(${hexToRgb(data.accentColor)},0.12)` : s.bg,
        border: `1.5px solid ${isRoot ? data.accentColor : s.border}`,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        gap: 10,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'border-color .15s, box-shadow .15s, background .15s',
        boxShadow: isRoot ? `0 0 24px ${data.accentColor}30` : 'none',
        outline: 'none',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.borderColor = isRoot ? data.accentColor : '#404040';
        el.style.boxShadow = `0 0 0 1px ${isRoot ? data.accentColor : '#303030'}40, 0 4px 12px rgba(0,0,0,0.4)`;
        el.style.background = isRoot ? `rgba(${hexToRgb(data.accentColor)},0.18)` : '#1a1a1a';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.borderColor = isRoot ? data.accentColor : s.border;
        el.style.boxShadow = isRoot ? `0 0 24px ${data.accentColor}30` : 'none';
        el.style.background = isRoot ? `rgba(${hexToRgb(data.accentColor)},0.12)` : s.bg;
      }}
    >
      {/* Status indicator */}
      <span style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: isRoot ? data.accentColor : s.dot,
        boxShadow: isRoot ? `0 0 6px ${data.accentColor}` : 'none',
      }} aria-hidden="true" />

      {/* Label */}
      <span style={{
        fontSize: isRoot ? 14 : 13,
        fontWeight: isRoot ? 700 : 500,
        color: isRoot ? '#F5F5F5' : s.text,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        lineHeight: 1.3,
        flex: 1,
      }}>
        {data.label}
      </span>

      {/* Done checkmark */}
      {data.status === 'done' && (
        <span style={{ fontSize: 11, color: '#22C55E', flexShrink: 0 }} aria-hidden="true">✓</span>
      )}
      {data.status === 'bookmarked' && (
        <span style={{ fontSize: 11, color: '#3B82F6', flexShrink: 0 }} aria-hidden="true">◈</span>
      )}
      {data.status === 'in-progress' && (
        <span style={{ fontSize: 9, color: '#F5A623', flexShrink: 0 }} aria-hidden="true">●</span>
      )}

      {/* Arrow */}
      <span style={{ fontSize: 10, color: '#333', flexShrink: 0, transition: 'color .15s' }} aria-hidden="true">
        →
      </span>
    </button>
  );
});
RoadmapNode.displayName = 'RoadmapNode';

const nodeTypes: NodeTypes = { roadmapNode: RoadmapNode as any };

// ── Dagre layout ────────────────────────────────────────────────────────
function layout(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: RANK_SEP, nodesep: NODE_SEP });
  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: (n.data as any).nodeType === 'root' ? ROOT_H : NODE_H }));
  edges.forEach(e => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return {
    nodes: nodes.map(n => {
      const { x, y } = g.node(n.id);
      const h = (n.data as any).nodeType === 'root' ? ROOT_H : NODE_H;
      return { ...n, position: { x: x - NODE_W / 2, y: y - h / 2 } };
    }),
    edges,
  };
}

// Helper
function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

// ── Component ────────────────────────────────────────────────────────────
interface Props {
  roadmap: Roadmap;
  progress: ProgressMap;
  onNodeClick: (id: string) => void;
  accentColor?: string;
}

export default function RoadmapFlow({ roadmap, progress, onNodeClick, accentColor = '#F5A623' }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [ready, setReady] = useState(false);

  const { rfNodes, rfEdges } = useMemo(() => {
    const rfNodes: Node[] = roadmap.nodes.map(n => ({
      id: n.id,
      type: 'roadmapNode',
      position: { x: 0, y: 0 },
      data: {
        label: n.label,
        nodeType: n.type,
        status: (progress[n.id]?.status as string) ?? 'todo',
        accentColor,
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
  }, [roadmap, progress, onNodeClick, accentColor]);

  useEffect(() => {
    const { nodes: laid, edges: laidEdges } = layout(rfNodes, rfEdges);
    setNodes(laid);
    setEdges(laidEdges);
    setReady(true);
  }, [rfNodes, rfEdges]);

  return (
    <div style={{ width: '100%', height: '100%', opacity: ready ? 1 : 0, transition: 'opacity .4s' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18, maxZoom: 1.1 }}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: false }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        aria-label={`${roadmap.title} roadmap diagram`}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1}
          color="#1f1f1f"
        />
        <Controls
          showInteractive={false}
          aria-label="Zoom controls"
          style={{
            background: '#141414',
            border: '1px solid #222',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        />
        <MiniMap
          nodeColor={n => {
            const s = (n.data as any)?.status ?? 'todo';
            return STATUS[s]?.dot ?? '#333';
          }}
          maskColor="rgba(13,13,13,0.82)"
          style={{ background: '#141414', border: '1px solid #222', borderRadius: 8 }}
          aria-label="Roadmap minimap"
        />
      </ReactFlow>
    </div>
  );
}
