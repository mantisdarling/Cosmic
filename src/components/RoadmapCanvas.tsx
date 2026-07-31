/**
 * src/components/RoadmapCanvas.tsx
 *
 * The main orchestrator React island for the /roadmap/[slug] page.
 * Combines: RoadmapFlow + TopicPanel + AuthButton + ProgressBar
 *
 * Security:
 *  - Auth state managed by Firebase SDK (single source of truth).
 *  - Progress subscriptions cleaned up on unmount.
 *  - Node clicks validated through NodeIdSchema before any panel/Firestore operation.
 *  - All topic content for the panel is passed in as pre-built Astro props (not fetched at runtime).
 *  - No user-supplied data flows into the DOM without passing through Zod validation first.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import RoadmapFlow from './RoadmapFlow';
import TopicPanel from './TopicPanel';
import AuthButton from './AuthButton';
import ProgressBar from './ProgressBar';
import { auth, isFirebaseReady } from '../lib/firebase';
import { subscribeToProgress, type ProgressMap } from '../lib/firestore';
import { NodeIdSchema } from '../lib/security';
import type { Roadmap } from '../lib/security';

// ── Types ────────────────────────────────────────────────────────────────────
interface TopicContent {
  nodeId: string;
  markdownBody: string;
  resources: { label: string; url: string }[];
}

interface RoadmapCanvasProps {
  roadmap: Roadmap;
  topicContents: TopicContent[];
}

// ── Component ────────────────────────────────────────────────────────────────
export default function RoadmapCanvas({ roadmap, topicContents }: RoadmapCanvasProps) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // Build a lookup map for topic content
  const topicMap = useMemo(() => {
    const map = new Map<string, TopicContent>();
    topicContents.forEach((t) => {
      const safe = NodeIdSchema.safeParse(t.nodeId);
      if (safe.success) map.set(safe.data, t);
    });
    return map;
  }, [topicContents]);

  // ── Auth state ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isFirebaseReady()) {
      setAuthLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    }, () => setAuthLoading(false));
    return unsub;
  }, []);

  // ── Progress subscription ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setProgress({});
      return;
    }
    const unsub = subscribeToProgress(
      user,
      roadmap.id,
      (p) => setProgress(p),
      (err) => {
        if (import.meta.env.DEV) console.error('[Progress]', err);
        // Non-critical — progress just won't show, no crash
      },
    );
    return unsub; // Always clean up listener
  }, [user, roadmap.id]);

  // ── Node click handler ──────────────────────────────────────────────────
  const handleNodeClick = useCallback((rawNodeId: string) => {
    // Validate nodeId before using — prevents any injection through click events
    const safe = NodeIdSchema.safeParse(rawNodeId);
    if (!safe.success) return;

    setActiveNodeId(safe.data);
    setPanelOpen(true);
  }, []);

  const handleClosePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  const handleProgressUpdate = useCallback((nodeId: string, status: 'done' | 'bookmarked' | 'todo') => {
    setProgress((prev) => {
      if (status === 'todo') {
        const next = { ...prev };
        delete next[nodeId];
        return next;
      }
      return {
        ...prev,
        [nodeId]: { status, updatedAt: new Date() },
      };
    });
  }, []);

  // Active topic content (from pre-built map)
  const activeTopic = activeNodeId ? topicMap.get(activeNodeId) : null;
  const activeNode = activeNodeId ? roadmap.nodes.find((n) => n.id === activeNodeId) : null;

  return (
    <div className="flex flex-col h-full">
      {/* ── Top toolbar ────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)] bg-[var(--bg-primary)] gap-4">
        {/* Roadmap title */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl flex-shrink-0" aria-hidden="true">{roadmap.icon}</span>
          <div className="min-w-0">
            <h1 className="font-display text-xl tracking-wider text-[var(--text-primary)] truncate leading-none">
              {roadmap.title}
            </h1>
            <p className="font-mono text-xs text-[var(--text-muted)] mt-0.5 hidden sm:block">
              {roadmap.nodes.length} topics
            </p>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Progress bar (only when signed in) */}
          {user && !authLoading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <ProgressBar roadmap={roadmap} progress={progress} />
            </motion.div>
          )}

          {/* Auth button */}
          <AuthButton />
        </div>
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-4 px-4 py-2 border-b border-[var(--border-default)] bg-[var(--bg-secondary)] overflow-x-auto">
        {[
          { color: '#5a5a80', label: 'Not started' },
          { color: '#f59e0b', label: 'In progress' },
          { color: '#10b981', label: 'Completed' },
          { color: '#06b6d4', label: 'Bookmarked' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 flex-shrink-0">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: color }}
              aria-hidden="true"
            />
            <span className="font-mono text-xs text-[var(--text-muted)] whitespace-nowrap">{label}</span>
          </div>
        ))}
        <span className="font-mono text-xs text-[var(--text-muted)] ml-auto hidden md:block flex-shrink-0">
          Click any node to open topic
        </span>
      </div>

      {/* ── Flow canvas ─────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        <RoadmapFlow
          roadmap={roadmap}
          progress={progress}
          onNodeClick={handleNodeClick}
          accentColor={roadmap.color}
        />
      </div>

      {/* ── Topic panel ─────────────────────────────────────────────────── */}
      <TopicPanel
        isOpen={panelOpen}
        onClose={handleClosePanel}
        nodeId={activeNodeId}
        nodeLabel={activeNode?.label ?? ''}
        markdownBody={activeTopic?.markdownBody ?? ''}
        resources={activeTopic?.resources ?? []}
        roadmapId={roadmap.id}
        user={user}
        progress={progress}
        onProgressUpdate={handleProgressUpdate}
      />
    </div>
  );
}
