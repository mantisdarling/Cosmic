/**
 * RoadmapFlow.tsx — Bigger nodes, better visual hierarchy, static canvas
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
  type NodeMouseHandler,
} from '@xyflow/react';
import dagre from 'dagre';
import type { Roadmap } from '../lib/security';
import '@xyflow/react/dist/style.css';

// ── Layout constants ─────────────────────────────────────────────
const NW = 240;   // node width
const NH = 54;    // node height
const RH = 66;    // root height
const RS = 80;    // rank separation
const NS = 16;    // node separation

// ── Custom Node ──────────────────────────────────────────────────
const FlowNode = memo(({ data }: {
  data: { label: string; isRoot: boolean; accent: string; done: boolean };
}) => {
  const [hov, setHov] = useState(false);
  const { isRoot, accent, label, done } = data;

  if (isRoot) {
    return (
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          width: NW, height: RH,
          background: `linear-gradient(135deg, ${accent}ee, ${accent}aa)`,
          border: `2px solid ${accent}`,
          borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: hov ? `0 0 40px ${accent}66, 0 8px 32px rgba(0,0,0,0.4)` : `0 0 24px ${accent}44`,
          transition: 'box-shadow .2s',
          fontFamily: 'Inter, system-ui, sans-serif',
          userSelect: 'none',
        }}
      >
        <span style={{
          fontSize: 15, fontWeight: 800, color: '#0D0D0D',
          letterSpacing: '-0.03em', lineHeight: 1.2,
          textAlign: 'center', padding: '0 16px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'relative',
        width: NW, height: NH,
        background: done ? `${accent}12` : (hov ? '#1e1e1e' : '#161616'),
        border: `1.5px solid ${done ? accent : (hov ? accent : '#2a2a2a')}`,
        borderRadius: 10,
        display: 'flex', alignItems: 'center',
        padding: '0 14px 0 18px', gap: 10,
        cursor: 'pointer',
        boxShadow: hov ? `0 0 0 1px ${accent}30, 0 8px 24px rgba(0,0,0,0.5)` : (done ? `0 0 0 1px ${accent}20` : 'none'),
        transition: 'all .18s',
        fontFamily: 'Inter, system-ui, sans-serif',
        userSelect: 'none',
      }}
    >
      {/* Left accent bar */}
      <span style={{
        position: 'absolute', left: 0, top: 8, bottom: 8, width: 3,
        borderRadius: '0 3px 3px 0',
        background: (hov || done) ? accent : 'transparent',
        transition: 'background .18s',
      }} />

      <span style={{
        fontSize: 13.5, fontWeight: 500,
        color: done ? accent : (hov ? '#F5F5F5' : '#A3A3A3'),
        letterSpacing: '-0.01em', lineHeight: 1.25,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        flex: 1, transition: 'color .18s',
      }}>
        {label}
      </span>

      {done ? (
        <span style={{ fontSize: 13, color: accent, flexShrink: 0, fontWeight: 700 }}>✓</span>
      ) : (
        <span style={{ fontSize: 10, color: hov ? accent : '#333', flexShrink: 0, transition: 'color .18s' }}>→</span>
      )}
    </div>
  );
});
FlowNode.displayName = 'FlowNode';

const nodeTypes: NodeTypes = { flowNode: FlowNode as any };

// ── Dagre layout ─────────────────────────────────────────────────
function applyLayout(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: RS, nodesep: NS, marginx: 40, marginy: 40 });
  nodes.forEach(n => g.setNode(n.id, { width: NW, height: (n.data as any).isRoot ? RH : NH }));
  edges.forEach(e => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map(n => {
    const { x, y } = g.node(n.id);
    const h = (n.data as any).isRoot ? RH : NH;
    return { ...n, position: { x: x - NW / 2, y: y - h / 2 } };
  });
}

// ── Main component ────────────────────────────────────────────────
interface Props {
  roadmap: Roadmap;
  progress: Record<string, string>;
  onNodeClick: (id: string) => void;
  doneNodes?: Set<string>;
}

export default function RoadmapFlow({ roadmap, onNodeClick, doneNodes }: Props) {
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
        done: doneNodes?.has(n.id) ?? false,
      },
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
        animated: doneNodes?.has(n.id) ?? false,
      }));

    return { rfNodes, rfEdges };
  }, [roadmap, doneNodes]);

  useEffect(() => {
    const laid = applyLayout(rfNodes, rfEdges);
    setNodes(laid);
    setEdges(rfEdges);
    setTimeout(() => setReady(true), 60);
  }, [rfNodes, rfEdges]);

  const handleNodeClick: NodeMouseHandler = (_e, node) => onNodeClick(node.id);

  return (
    <div style={{ width: '100%', height: '100%', opacity: ready ? 1 : 0, transition: 'opacity .4s' }}>
      <style>{`
        .react-flow__node { cursor: pointer !important; }
        .react-flow__node.selected > div { outline: none !important; box-shadow: none !important; }
        .react-flow__node-flowNode.selected { outline: none !important; }
        .react-flow__edge-path { stroke-width: 1.5 !important; }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1.3 }}
        minZoom={0.2}
        maxZoom={1.3}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        panOnScroll={false}
        panOnDrag={false}
        preventScrolling={false}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        aria-label={`${roadmap.title} roadmap diagram`}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="#1a1a1a" />
      </ReactFlow>
    </div>
  );
}
