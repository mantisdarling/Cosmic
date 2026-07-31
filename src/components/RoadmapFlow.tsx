/**
 * RoadmapFlow.tsx
 * - Static canvas (no pan, no zoom, no controls)
 * - TB dagre layout, large nodes
 * - Click node → opens TopicPanel
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
import type { Roadmap } from '../lib/security';
import '@xyflow/react/dist/style.css';

// ── Layout constants ────────────────────────────────────────────
const NW = 220;   // node width
const NH = 48;    // node height
const RH = 58;    // root height
const RS = 72;    // rank separation
const NS = 14;    // node separation

// ── Custom Node ─────────────────────────────────────────────────
const FlowNode = memo(({ data }: {
  data: { label: string; isRoot: boolean; accent: string; onClick: () => void };
}) => {
  const [hov, setHov] = useState(false);
  const { isRoot, accent, label, onClick } = data;

  if (isRoot) {
    return (
      <button
        onClick={onClick}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        aria-label={`Explore: ${label}`}
        style={{
          width: NW, height: RH,
          background: accent,
          border: `2px solid ${accent}`,
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', outline: 'none',
          boxShadow: `0 0 28px ${accent}55`,
          filter: hov ? 'brightness(1.12)' : 'brightness(1)',
          transition: 'filter .15s, box-shadow .15s',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <span style={{
          fontSize: 14, fontWeight: 800, color: '#0D0D0D',
          letterSpacing: '-0.03em', lineHeight: 1.2,
          textAlign: 'center', padding: '0 14px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      aria-label={`Explore: ${label}`}
      style={{
        position: 'relative',
        width: NW, height: NH,
        background: hov ? '#1e1e1e' : '#161616',
        border: `1.5px solid ${hov ? accent : '#2a2a2a'}`,
        borderRadius: 8,
        display: 'flex', alignItems: 'center',
        padding: '0 12px 0 16px', gap: 8,
        cursor: 'pointer', textAlign: 'left', outline: 'none',
        boxShadow: hov ? `0 0 0 1px ${accent}35, 0 6px 20px rgba(0,0,0,0.5)` : 'none',
        transition: 'border-color .15s, background .15s, box-shadow .15s',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Left accent bar on hover */}
      <span style={{
        position: 'absolute', left: 0, top: 6, bottom: 6, width: 3,
        borderRadius: '0 3px 3px 0',
        background: hov ? accent : 'transparent',
        transition: 'background .15s',
      }} aria-hidden="true" />

      <span style={{
        fontSize: 13, fontWeight: 500,
        color: hov ? '#F5F5F5' : '#A3A3A3',
        letterSpacing: '-0.01em', lineHeight: 1.25,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        flex: 1, transition: 'color .15s',
      }}>
        {label}
      </span>

      <span style={{
        fontSize: 10, color: hov ? accent : '#333',
        flexShrink: 0, transition: 'color .15s',
      }} aria-hidden="true">→</span>
    </button>
  );
});
FlowNode.displayName = 'FlowNode';

const nodeTypes: NodeTypes = { flowNode: FlowNode as any };

// ── Dagre layout ────────────────────────────────────────────────
function applyLayout(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: RS, nodesep: NS, marginx: 32, marginy: 32 });

  nodes.forEach(n => {
    g.setNode(n.id, { width: NW, height: (n.data as any).isRoot ? RH : NH });
  });
  edges.forEach(e => g.setEdge(e.source, e.target));
  dagre.layout(g);

  return nodes.map(n => {
    const { x, y } = g.node(n.id);
    const h = (n.data as any).isRoot ? RH : NH;
    return { ...n, position: { x: x - NW / 2, y: y - h / 2 } };
  });
}

// ── Main component ───────────────────────────────────────────────
interface Props {
  roadmap: Roadmap;
  progress: Record<string, string>;
  onNodeClick: (id: string) => void;
}

export default function RoadmapFlow({ roadmap, onNodeClick }: Props) {
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
  }, [roadmap, onNodeClick]);

  useEffect(() => {
    const laid = applyLayout(rfNodes, rfEdges);
    setNodes(laid);
    setEdges(rfEdges);
    setTimeout(() => setReady(true), 60);
  }, [rfNodes, rfEdges]);

  return (
    <div style={{ width: '100%', height: '100%', opacity: ready ? 1 : 0, transition: 'opacity .45s' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.12, maxZoom: 1.35 }}
        minZoom={0.3}
        maxZoom={1.35}
        // All interaction disabled — static diagram
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        panOnScroll={false}
        panOnDrag={false}
        preventScrolling={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        aria-label={`${roadmap.title} roadmap diagram`}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={30}
          size={1}
          color="#1c1c1c"
        />
      </ReactFlow>
    </div>
  );
}
