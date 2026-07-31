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

// Node dimension and layout spacing configuration
const NODE_WIDTH = 220;
const NODE_HEIGHT = 48;
const ROOT_WIDTH = 240;
const ROOT_HEIGHT = 60;
const LEVEL_SEPARATION = 60;
const SIBLING_SEPARATION = 10;

// Custom rendered node component for the roadmap graph
const FlowNode = memo(({ data }: {
  data: { label: string; isRoot: boolean; accent: string; done: boolean };
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const { isRoot, accent, label, done } = data;

  if (isRoot) {
    return (
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: ROOT_WIDTH,
          height: ROOT_HEIGHT,
          background: `linear-gradient(135deg, ${accent}ee, ${accent}aa)`,
          border: `2px solid ${accent}`,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: isHovered
            ? `0 0 40px ${accent}66, 0 8px 32px rgba(0,0,0,0.4)`
            : `0 0 24px ${accent}44`,
          transition: 'box-shadow 0.2s ease',
          fontFamily: 'Inter, system-ui, sans-serif',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: '#0D0D0D',
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
            textAlign: 'center',
            padding: '0 16px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        background: done ? `${accent}12` : isHovered ? '#1E2333' : '#141722',
        border: `1.5px solid ${done ? accent : isHovered ? accent : '#1E2333'}`,
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px 0 18px',
        gap: 10,
        cursor: 'pointer',
        boxShadow: isHovered
          ? `0 0 0 1px ${accent}30, 0 8px 24px rgba(0,0,0,0.5)`
          : done
          ? `0 0 0 1px ${accent}20`
          : 'none',
        transition: 'all 0.18s ease',
        fontFamily: 'Inter, system-ui, sans-serif',
        userSelect: 'none',
      }}
    >
      {/* Left indicator accent bar */}
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: 8,
          bottom: 8,
          width: 3,
          borderRadius: '0 3px 3px 0',
          background: isHovered || done ? accent : 'transparent',
          transition: 'background 0.18s ease',
        }}
      />

      <span
        style={{
          fontSize: 13.5,
          fontWeight: 500,
          color: done ? accent : isHovered ? '#F5F5F5' : '#A3A3A3',
          letterSpacing: '-0.01em',
          lineHeight: 1.25,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          flex: 1,
          transition: 'color 0.18s ease',
        }}
      >
        {label}
      </span>

      {done ? (
        <span style={{ fontSize: 13, color: accent, flexShrink: 0, fontWeight: 700 }}>✓</span>
      ) : (
        <span
          style={{
            fontSize: 10,
            color: isHovered ? accent : '#404040',
            flexShrink: 0,
            transition: 'color 0.18s ease',
          }}
        >
          →
        </span>
      )}
    </div>
  );
});

FlowNode.displayName = 'FlowNode';

const customNodeTypes: NodeTypes = { flowNode: FlowNode as any };

// Calculates automatic left-to-right tree layout using Dagre
function calculateLayout(nodes: Node[], edges: Edge[]) {
  const layoutGraph = new dagre.graphlib.Graph();
  layoutGraph.setDefaultEdgeLabel(() => ({}));
  layoutGraph.setGraph({
    rankdir: 'LR',
    ranksep: LEVEL_SEPARATION,
    nodesep: SIBLING_SEPARATION,
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach((n) => {
    const isRoot = (n.data as any).isRoot;
    layoutGraph.setNode(n.id, {
      width: isRoot ? ROOT_WIDTH : NODE_WIDTH,
      height: isRoot ? ROOT_HEIGHT : NODE_HEIGHT,
    });
  });

  edges.forEach((e) => layoutGraph.setEdge(e.source, e.target));
  dagre.layout(layoutGraph);

  return nodes.map((n) => {
    const { x, y } = layoutGraph.node(n.id);
    const isRoot = (n.data as any).isRoot;
    const w = isRoot ? ROOT_WIDTH : NODE_WIDTH;
    const h = isRoot ? ROOT_HEIGHT : NODE_HEIGHT;
    return { ...n, position: { x: x - w / 2, y: y - h / 2 } };
  });
}

interface RoadmapFlowProps {
  roadmap: Roadmap;
  progress?: Record<string, string>;
  onNodeClick: (id: string) => void;
  doneNodes?: Set<string>;
}

export default function RoadmapFlow({ roadmap, onNodeClick, doneNodes }: RoadmapFlowProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isReady, setIsReady] = useState(false);

  const { flowNodes, flowEdges } = useMemo(() => {
    const accentColor = roadmap.color || '#F5A623';

    const flowNodes: Node[] = roadmap.nodes.map((n) => ({
      id: n.id,
      type: 'flowNode',
      position: { x: 0, y: 0 },
      data: {
        label: n.label,
        isRoot: n.type === 'root',
        accent: accentColor,
        done: doneNodes?.has(n.id) ?? false,
      },
      draggable: false,
    }));

    const flowEdges: Edge[] = roadmap.nodes
      .filter((n) => n.parentId !== null)
      .map((n) => ({
        id: `edge-${n.parentId}-${n.id}`,
        source: n.parentId!,
        target: n.id,
        type: 'smoothstep',
        style: { stroke: '#2A3147', strokeWidth: 1.5 },
        animated: doneNodes?.has(n.id) ?? false,
      }));

    return { flowNodes, flowEdges };
  }, [roadmap, doneNodes]);

  useEffect(() => {
    const laidOutNodes = calculateLayout(flowNodes, flowEdges);
    setNodes(laidOutNodes);
    setEdges(flowEdges);
    const timer = setTimeout(() => setIsReady(true), 60);
    return () => clearTimeout(timer);
  }, [flowNodes, flowEdges]);

  const handleNodeClick: NodeMouseHandler = (_, node) => onNodeClick(node.id);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        opacity: isReady ? 1 : 0,
        transition: 'opacity 0.4s ease',
      }}
    >
      <style>{`
        .react-flow { background: transparent !important; }
        .react-flow__background { background: transparent !important; }
        .react-flow__container { background: transparent !important; }
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
        nodeTypes={customNodeTypes}
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
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="#1E2333" />
      </ReactFlow>
    </div>
  );
}
