import { lazy, Suspense, useState, useCallback, useMemo, useEffect, useRef } from 'react';
const RoadmapFlow = lazy(() => import('./RoadmapFlow'));
import TopicPanel from './TopicPanel';
import type { Roadmap } from '../lib/security';

const isValidNodeId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 64 && /^[a-z0-9-]+$/.test(value);

interface TopicContent {
  nodeId: string;
  markdownBody: string;
  resources: { label: string; url: string }[];
}

interface RoadmapCanvasProps {
  roadmap: Roadmap;
  topicContents: TopicContent[];
}

// Generates unique storage key per roadmap for persisting completion progress
const getStorageKey = (roadmapId: string) => `cosmic-done-${roadmapId}`;

export default function RoadmapCanvas({ roadmap, topicContents }: RoadmapCanvasProps) {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [doneNodes, setDoneNodes] = useState<Set<string>>(new Set());
  const [showCompletionBadge, setShowCompletionBadge] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  const canvasRef = useRef<HTMLDivElement>(null);

  // Restore completed nodes from browser local storage on component mount
  useEffect(() => {
    const storedDone = localStorage.getItem(getStorageKey(roadmap.id));
    if (storedDone) {
      try {
        setDoneNodes(new Set(JSON.parse(storedDone)));
      } catch {
        // Fall back gracefully if storage item is corrupt
      }
    }
    setIsMobileViewport(window.innerWidth < 768);
    const handleResize = () => setIsMobileViewport(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [roadmap.id]);

  // Index topic content items by sanitized node id
  const topicMap = useMemo(() => {
    const map = new Map<string, TopicContent>();
    topicContents.forEach((topic) => {
      if (isValidNodeId(topic.nodeId)) {
        map.set(topic.nodeId, topic);
      }
    });
    return map;
  }, [topicContents]);

  // Handles node selection on the canvas or mobile list
  const handleNodeClick = useCallback((rawNodeId: string) => {
    if (!isValidNodeId(rawNodeId)) return;
    setActiveNodeId(rawNodeId);
    setIsPanelOpen(true);
  }, []);

  // Toggles completion state for a given node id and syncs with storage
  const handleToggleDone = useCallback(
    (nodeId: string) => {
      setDoneNodes((previousDoneNodes) => {
        const nextDoneNodes = new Set(previousDoneNodes);
        if (nextDoneNodes.has(nodeId)) {
          nextDoneNodes.delete(nodeId);
        } else {
          nextDoneNodes.add(nodeId);
        }
        localStorage.setItem(
          getStorageKey(roadmap.id),
          JSON.stringify([...nextDoneNodes])
        );
        return nextDoneNodes;
      });
    },
    [roadmap.id]
  );

  const activeTopic = activeNodeId ? topicMap.get(activeNodeId) : null;
  const activeNode = activeNodeId ? roadmap.nodes.find((node) => node.id === activeNodeId) : null;

  const totalTopicsCount = roadmap.nodes.filter((node) => node.type !== 'root').length;
  const completedTopicsCount = [...doneNodes].filter((id) =>
    roadmap.nodes.some((node) => node.id === id)
  ).length;
  const progressPercentage =
    totalTopicsCount > 0 ? Math.round((completedTopicsCount / totalTopicsCount) * 100) : 0;
  const isRoadmapFullyCompleted = progressPercentage === 100;

  const handleExport = async (format: 'png' | 'pdf') => {
    if (!canvasRef.current) return;
    setIsExporting(true);
    setShowExportMenu(false);
    
    try {
      // Load export-only dependencies on demand so normal roadmap browsing stays light.
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      // Small delay to allow menu to hide
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(canvasRef.current, {
        backgroundColor: '#0B0C10',
        scale: Math.min(window.devicePixelRatio || 1, 1.5),
        useCORS: true,
        logging: false
      });
      
      if (format === 'png') {
        const link = document.createElement('a');
        link.download = `cosmic-${roadmap.id}-roadmap.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [canvas.width, canvas.height]
        });
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`cosmic-${roadmap.id}-roadmap.pdf`);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Render linear list view for small mobile viewports
  if (isMobileViewport) {
    return (
      <div className="mobile-roadmap-list" style={{ background: '#0B0C10', minHeight: '100%', padding: '16px' }}>
        {/* Progress Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: '0.75rem', color: '#525252', fontFamily: 'Space Mono, monospace' }}>
              Progress
            </span>
            <span style={{ fontSize: '0.75rem', color: '#F5A623', fontWeight: 700, fontFamily: 'Space Mono, monospace' }}>
              {progressPercentage}%
            </span>
          </div>
          <div style={{ height: 4, background: '#1E2333', borderRadius: 99 }}>
            <div
              style={{
                height: '100%',
                background: roadmap.color || '#F5A623',
                borderRadius: 99,
                width: `${progressPercentage}%`,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>

        {/* Topic List */}
        {roadmap.nodes
          .filter((node) => node.type !== 'root')
          .map((node) => {
            const isCompleted = doneNodes.has(node.id);
            const accentColor = roadmap.color || '#F5A623';
            return (
              <div key={node.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <button
                  onClick={() => handleNodeClick(node.id)}
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    padding: '12px 14px',
                    background: isCompleted ? `${accentColor}12` : '#141722',
                    border: `1.5px solid ${isCompleted ? accentColor : '#1E2333'}`,
                    borderRadius: 8,
                    color: isCompleted ? accentColor : '#A3A3A3',
                    fontSize: '0.88rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {node.label}
                </button>
                <button
                  onClick={() => handleToggleDone(node.id)}
                  title={isCompleted ? 'Mark as undone' : 'Mark as done'}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    flexShrink: 0,
                    border: `1.5px solid ${isCompleted ? accentColor : '#1E2333'}`,
                    background: isCompleted ? accentColor : 'transparent',
                    color: isCompleted ? '#0D0D0D' : '#525252',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ✓
                </button>
              </div>
            );
          })}

        <TopicPanel
          isOpen={isPanelOpen}
          onClose={() => setIsPanelOpen(false)}
          nodeLabel={activeNode?.label ?? ''}
          roadmapTitle={roadmap.title}
          markdownBody={activeTopic?.markdownBody ?? ''}
          resources={activeTopic?.resources ?? []}
          onMarkDone={activeNodeId ? () => handleToggleDone(activeNodeId) : undefined}
          isDone={activeNodeId ? doneNodes.has(activeNodeId) : false}
        />
      </div>
    );
  }

  // Desktop interactive canvas view
  return (
    <div
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        backgroundImage: `radial-gradient(circle at center, rgba(11, 12, 16, 0.75) 0%, rgba(11, 12, 16, 0.92) 75%, #0B0C10 100%), url('/roadmap-bg.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
      }}
    >
      {/* Top Progress Track */}
      {completedTopicsCount > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            zIndex: 5,
            background: '#1E2333',
          }}
        >
          <div
            style={{
              height: '100%',
              background: roadmap.color || '#F5A623',
              width: `${progressPercentage}%`,
              transition: 'width 0.5s ease',
            }}
          />
        </div>
      )}

      <Suspense fallback={<div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#737373', fontFamily: 'Space Mono, monospace', fontSize: '0.72rem' }}>Preparing roadmap canvas…</div>}>
        <RoadmapFlow
          roadmap={roadmap}
          progress={{}}
          onNodeClick={handleNodeClick}
          doneNodes={doneNodes}
        />
      </Suspense>

      {/* Export Button */}
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 10 }}>
        <button
          onClick={() => setShowExportMenu(!showExportMenu)}
          disabled={isExporting}
          style={{
            background: 'rgba(20,23,34,0.9)',
            border: '1px solid #2A3147',
            color: '#E5E5E5',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: isExporting ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.2s ease'
          }}
        >
          {isExporting ? 'Exporting...' : 'Export'} 
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
        </button>
        
        {showExportMenu && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            background: '#141722',
            border: '1px solid #2A3147',
            borderRadius: '8px',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            minWidth: '140px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            <button
              onClick={() => handleExport('png')}
              style={{
                background: 'transparent', border: 'none', color: '#A3A3A3',
                padding: '8px 12px', textAlign: 'left', fontSize: '0.85rem',
                cursor: 'pointer', borderRadius: '4px', transition: 'all 0.2s'
              }}
              onMouseOver={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#fff'; }}
              onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#A3A3A3'; }}
            >
              Download PNG
            </button>
            <button
              onClick={() => handleExport('pdf')}
              style={{
                background: 'transparent', border: 'none', color: '#A3A3A3',
                padding: '8px 12px', textAlign: 'left', fontSize: '0.85rem',
                cursor: 'pointer', borderRadius: '4px', transition: 'all 0.2s'
              }}
              onMouseOver={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#fff'; }}
              onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#A3A3A3'; }}
            >
              Download PDF
            </button>
          </div>
        )}
      </div>

      {/* Completion Banner Trigger */}
      {isRoadmapFullyCompleted && !showCompletionBadge && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            background: 'rgba(11,12,16,0.95)',
            border: `1px solid ${roadmap.color || '#F5A623'}`,
            borderRadius: 12,
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: `0 0 40px ${roadmap.color || '#F5A623'}33`,
            animation: 'fadeUp 0.4s ease both',
          }}
        >
          <span style={{ fontSize: '1.5rem', lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}>🎉</span>
          <div>
            <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#F5F5F5' }}>
              Roadmap Complete!
            </p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#737373' }}>
              You have completed all {totalTopicsCount} topics
            </p>
          </div>
          <button
            onClick={() => setShowCompletionBadge(true)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: roadmap.color || '#F5A623',
              color: '#0D0D0D',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            Get Badge ✦
          </button>
        </div>
      )}

      {/* Completion Certificate Modal */}
      {showCompletionBadge && (
        <div
          onClick={() => setShowCompletionBadge(false)}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            id="completion-badge"
            style={{
              background: '#141722',
              border: `2px solid ${roadmap.color || '#F5A623'}`,
              borderRadius: 20,
              padding: '40px 48px',
              textAlign: 'center',
              maxWidth: 400,
              width: '90%',
              boxShadow: `0 0 80px ${roadmap.color || '#F5A623'}44`,
            }}
          >
            <div style={{ fontSize: '3.5rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>{roadmap.icon}</div>
            <div
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: roadmap.color || '#F5A623',
                letterSpacing: '0.15em',
                marginBottom: 10,
                fontFamily: 'Space Mono, monospace',
                textTransform: 'uppercase',
              }}
            >
              Certificate of Completion
            </div>
            <h2
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: '#F5F5F5',
                margin: '0 0 8px',
                letterSpacing: '-0.03em',
              }}
            >
              {roadmap.title}
            </h2>
            <p style={{ color: '#737373', fontSize: '0.85rem', margin: '0 0 24px', lineHeight: 1.6 }}>
              Completed all <strong style={{ color: '#F5F5F5' }}>{totalTopicsCount} topics</strong> in this roadmap on Cosmic
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => {
                  const shareText = `I just completed the ${roadmap.title} roadmap on Cosmic! 🎉\n\n${window.location.href}`;
                  navigator.clipboard.writeText(shareText).catch(() => {});
                  window.open(
                    `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                      `I just completed the ${roadmap.title} roadmap on Cosmic! 🎉 ${window.location.href}`
                    )}`,
                    '_blank'
                  );
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: 9,
                  border: 'none',
                  background: roadmap.color || '#F5A623',
                  color: '#0D0D0D',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Share on X ↗
              </button>
              <button
                onClick={() => setShowCompletionBadge(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: 9,
                  border: '1px solid #2A3147',
                  background: 'transparent',
                  color: '#737373',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <TopicPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        nodeLabel={activeNode?.label ?? ''}
        roadmapTitle={roadmap.title}
        markdownBody={activeTopic?.markdownBody ?? ''}
        resources={activeTopic?.resources ?? []}
        onMarkDone={activeNodeId ? () => handleToggleDone(activeNodeId) : undefined}
        isDone={activeNodeId ? doneNodes.has(activeNodeId) : false}
      />
    </div>
  );
}
