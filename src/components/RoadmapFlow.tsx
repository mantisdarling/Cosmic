/**
 * src/components/RoadmapFlow.tsx
 *
 * Interactive React Flow canvas for rendering roadmap trees.
 *
 * Security:
 *  - All roadmap data is pre-validated by RoadmapSchema before this component mounts.
 *  - nodeTypes is defined OUTSIDE the component (prevents re-renders and subtle bugs).
 *  - Node labels are rendered as React text nodes, never via dangerouslySetInnerHTML.
 *  - onNodeClick passes only the validated node ID to the parent — no raw event data.
 *  - Edge and node IDs are derived from validated schema IDs only.
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
import { motion, AnimatePresence } from 'framer-motion';
import type { ProgressMap } from '../lib/firestore';
import type { Roadmap, RoadmapNode, NodeStatus } from '../lib/security';
import '@xyflow/react/dist/style.css';

// ── Layout constants ─────────────────────────────────────────────────────────
const NODE_WIDTH = 200;
const NODE_HEIGHT = 44;
const RANK_SEP = 80;
const NODE_SEP = 40;

// ── Status color map ─────────────────────────────────────────────────────────
const STATUS_COLORS: Record<NodeStatus | 'todo', { border: string; bg: string; dot: string }> = {
  todo: { border: '#1e1e35', bg: 'rgba(18,18,30,0.95)', dot: '#5a5a80' },
  'in-progress': { border: '#f59e0b', bg: 'rgba(245,158,11,0.08)', dot: '#f59e0b' },
  done: { border: '#10b981', bg: 'rgba(16,185,129,0.08)', dot: '#10b981' },
  bookmarked: { border: '#06b6d4', bg: 'rgba(6,182,212,0.08)', dot: '#06b6d4' },
};

// ── Custom Node component ────────────────────────────────────────────────────
// Defined OUTSIDE RoadmapFlow to prevent re-creation on every render.
// Security: label is rendered as React text — no HTML injection possible.
const RoadmapNodeComponent = memo(
  ({
    data,
  }: {
    data: {
      label: string;
      nodeType: string;
      status: NodeStatus | 'todo';
      onClick: () => void;
    };
  }) => {
    const colors = STATUS_COLORS[data.status] ?? STATUS_COLORS.todo;
    const isRoot = data.nodeType === 'root';

    return (
      <button
        onClick={data.onClick}
        className="group w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-[10px]"
        style={{
          width: NODE_WIDTH,
          height: isRoot ? NODE_HEIGHT + 8 : NODE_HEIGHT,
        }}
        aria-label={`Open topic: ${data.label}`}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            background: isRoot ? 'rgba(124,58,237,0.15)' : colors.bg,
            border: `1.5px solid ${isRoot ? '#7c3aed' : colors.border}`,
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            gap: 8,
            transition: 'all 0.15s ease',
            boxShadow: isRoot ? '0 0 20px rgba(124,58,237,0.2)' : 'none',
          }}
          className="group-hover:border-[var(--accent-purple)] group-hover:shadow-[0_0_12px_rgba(124,58,237,0.25)] transition-all duration-150"
        >
          {/* Status dot */}
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: isRoot ? '#a78bfa' : colors.dot,
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
            aria-hidden="true"
          />
          {/* Label — pure text, no HTML */}
          <span
            style={{
              fontFamily: isRoot ? '"Bebas Neue", sans-serif' : '"Space Grotesk", sans-serif',
              fontSize: isRoot ? 15 : 13,
              letterSpacing: isRoot ? '0.08em' : '0.01em',
              fontWeight: isRoot ? 400 : 500,
              color: isRoot ? '#c4b5fd' : '#f0f0ff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.2,
            }}
          >
            {data.label}
          </span>
        </div>
      </button>
    );
  },
);
RoadmapNodeComponent.displayName = 'RoadmapNodeComponent';

// nodeTypes MUST be defined outside the component — React Flow requirement
const nodeTypes: NodeTypes = {
  roadmapNode: RoadmapNodeComponent as any,
};

// ── Dagre layout ─────────────────────────────────────────────────────────────
function getLayoutedElements(
  rfNodes: Node[],
  rfEdges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: RANK_SEP, nodesep: NODE_SEP });

  rfNodes.forEach((n) => {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });
  rfEdges.forEach((e) => {
    g.setEdge(e.source, e.target);
  });

  dagre.layout(g);

  return {
    nodes: rfNodes.map((n) => {
      const { x, y } = g.node(n.id);
      return { ...n, position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 } };
    }),
    edges: rfEdges,
  };
}

// ── Main component ────────────────────────────────────────────────────────────
interface RoadmapFlowProps {
  roadmap: Roadmap;
  progress: ProgressMap;
  onNodeClick: (nodeId: string) => void;
  accentColor?: string;
}

export default function RoadmapFlow({
  roadmap,
  progress,
  onNodeClick,
  accentColor = '#7c3aed',
}: RoadmapFlowProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [ready, setReady] = useState(false);

  // Build nodes and edges from roadmap data
  const { initialNodes, initialEdges } = useMemo(() => {
    const rfNodes: Node[] = roadmap.nodes.map((node) => {
      const nodeProgress = progress[node.id];
      const status = (nodeProgress?.status as NodeStatus) ?? 'todo';

      return {
        id: node.id,
        type: 'roadmapNode',
        position: { x: 0, y: 0 }, // Will be set by dagre
        data: {
          label: node.label,
          nodeType: node.type,
          status,
          // onClick is a closure — does NOT pass raw event objects
          onClick: () => onNodeClick(node.id),
        },
        selectable: false,
        draggable: false,
      };
    });

    const rfEdges: Edge[] = roadmap.nodes
      .filter((n) => n.parentId !== null)
      .map((n) => ({
        id: `e-${n.parentId}-${n.id}`,
        source: n.parentId!,
        target: n.id,
        type: 'smoothstep',
        style: {
          stroke: 'rgba(80,80,120,0.6)',
          strokeWidth: 1.5,
        },
        animated: false,
      }));

    return { initialNodes: rfNodes, initialEdges: rfEdges };
  }, [roadmap, progress, onNodeClick]);

  // Apply dagre layout
  useEffect(() => {
    const { nodes: laid, edges: laidEdges } = getLayoutedElements(initialNodes, initialEdges);
    setNodes(laid);
    setEdges(laidEdges);
    setReady(true);
  }, [initialNodes, initialEdges]);

  return (
    <AnimatePresence>
      {ready && (
        <motion.div
          className="w-full h-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
            minZoom={0.3}
            maxZoom={2}
            proOptions={{ hideAttribution: false }}
            // Security: disable drag-and-drop to prevent unintended data injection
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            // Accessibility
            aria-label={`${roadmap.title} roadmap diagram`}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="rgba(80,80,120,0.25)"
            />
            <Controls
              showInteractive={false}
              aria-label="Diagram zoom controls"
            />
            <MiniMap
              nodeColor={(n) => {
                const status = (n.data as any)?.status ?? 'todo';
                return STATUS_COLORS[status as NodeStatus]?.dot ?? '#5a5a80';
              }}
              maskColor="rgba(8,8,16,0.75)"
              aria-label="Roadmap minimap"
            />
          </ReactFlow>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
