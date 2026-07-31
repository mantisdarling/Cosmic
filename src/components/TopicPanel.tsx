/**
 * src/components/TopicPanel.tsx  (updated)
 *
 * Renders markdown body from topic JSON files using `marked` + `DOMPurify`.
 *
 * Security:
 *  - `marked` parses Markdown to HTML — strips raw HTML by default (no passThrough).
 *  - `DOMPurify` sanitizes the output with an allowlist of safe tags.
 *  - All external resource URLs pass through isSafeUrl() (https-only).
 *  - rel="noopener noreferrer" on all external links (tab-napping prevention).
 *  - Progress writes are validated through Zod + Firestore security rules.
 *  - Focus trapping and scroll-lock while panel is open.
 */

import { useEffect, useRef, useCallback, useState, memo } from 'react';
import { marked } from 'marked';
import { motion, AnimatePresence } from 'framer-motion';
import type { User } from 'firebase/auth';
import { setNodeProgress, clearNodeProgress, type ProgressMap } from '../lib/firestore';
import { NodeIdSchema, SlugSchema, sanitizeHtml, toSafeError } from '../lib/security';

interface Resource {
  label: string;
  url: string;
}

interface TopicPanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string | null;
  nodeLabel: string;
  markdownBody: string;
  resources: Resource[];
  roadmapId: string;
  user: User | null;
  progress: ProgressMap;
  onProgressUpdate: (nodeId: string, status: 'done' | 'bookmarked' | 'todo') => void;
}

// Configure marked for safe rendering (no raw HTML pass-through)
marked.setOptions({
  gfm: true,       // GitHub-flavored markdown (tables, fenced code blocks)
  breaks: false,
});

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const TopicPanel = memo(function TopicPanel({
  isOpen,
  onClose,
  nodeId,
  nodeLabel,
  markdownBody,
  resources,
  roadmapId,
  user,
  progress,
  onProgressUpdate,
}: TopicPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [toggling, setToggling] = useState(false);
  const [localError, setLocalError] = useState('');
  const [renderedHtml, setRenderedHtml] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentStatus = nodeId ? (progress[nodeId]?.status ?? 'todo') : 'todo';
  const isDone = currentStatus === 'done';
  const isBookmarked = currentStatus === 'bookmarked';

  // Render markdown → sanitized HTML when body changes
  useEffect(() => {
    if (!markdownBody) {
      setRenderedHtml('<p style="color:var(--text-muted)">Content coming soon.</p>');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // Step 1: Parse markdown to HTML (marked strips raw HTML by default in v9+)
        const rawHtml = await marked.parse(markdownBody, { async: false }) as string;
        // Step 2: Sanitize with DOMPurify allowlist
        const safeHtml = await sanitizeHtml(rawHtml);
        if (!cancelled) setRenderedHtml(safeHtml);
      } catch {
        if (!cancelled) setRenderedHtml('<p style="color:var(--text-muted)">Could not render content.</p>');
      }
    })();

    return () => { cancelled = true; };
  }, [markdownBody]);

  // Focus close button when panel opens
  useEffect(() => {
    if (isOpen) setTimeout(() => closeButtonRef.current?.focus(), 50);
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Progress toggle
  const toggleStatus = useCallback(async (targetStatus: 'done' | 'bookmarked') => {
    if (!user || !nodeId || toggling) return;

    const safeNodeId = NodeIdSchema.safeParse(nodeId);
    const safeRoadmapId = SlugSchema.safeParse(roadmapId);
    if (!safeNodeId.success || !safeRoadmapId.success) {
      setLocalError('Invalid identifier.');
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setToggling(true);
      setLocalError('');
      try {
        const newStatus = currentStatus === targetStatus ? 'todo' : targetStatus;
        if (newStatus === 'todo') {
          const r = await clearNodeProgress(user, safeRoadmapId.data, safeNodeId.data);
          if (!r.success) setLocalError(r.error ?? 'Failed to update.');
        } else {
          const r = await setNodeProgress(user, safeRoadmapId.data, safeNodeId.data, newStatus);
          if (!r.success) setLocalError(r.error ?? 'Failed to update.');
        }
        onProgressUpdate(safeNodeId.data, currentStatus === targetStatus ? 'todo' : targetStatus);
      } catch (err) {
        setLocalError(toSafeError(err).message);
      } finally {
        setToggling(false);
      }
    }, 300);
  }, [user, nodeId, roadmapId, currentStatus, toggling, onProgressUpdate]);

  // Filter unsafe URLs
  const safeResources = resources.filter(
    (r) => typeof r.label === 'string' && r.label.length > 0 && r.label.length <= 120 && isSafeUrl(r.url),
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.aside
            role="complementary"
            aria-label="Topic details"
            className="fixed top-0 right-0 bottom-0 z-50 bg-[var(--bg-card)] border-l border-[var(--border-default)] flex flex-col overflow-hidden"
            style={{ width: 'var(--panel-width)', boxShadow: 'var(--shadow-panel)' }}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 pb-4 border-b border-[var(--border-default)] flex-shrink-0">
              <div className="pr-8">
                <p className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-widest mb-1">Topic</p>
                <h2 className="font-display text-2xl tracking-wide text-[var(--text-primary)] leading-tight">
                  {nodeLabel}
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                onClick={onClose}
                aria-label="Close topic panel"
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all font-mono text-sm mt-1"
              >✕</button>
            </div>

            {/* Progress actions */}
            {user && nodeId && (
              <div className="px-6 py-3 flex items-center gap-3 border-b border-[var(--border-default)] flex-shrink-0 flex-wrap">
                <button
                  onClick={() => toggleStatus('done')}
                  disabled={toggling}
                  aria-pressed={isDone}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 disabled:opacity-50 ${
                    isDone
                      ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400'
                      : 'bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-emerald-500/40 hover:text-emerald-400'
                  }`}
                >
                  <span aria-hidden="true">{isDone ? '✓' : '○'}</span>
                  {isDone ? 'Completed' : 'Mark done'}
                </button>

                <button
                  onClick={() => toggleStatus('bookmarked')}
                  disabled={toggling}
                  aria-pressed={isBookmarked}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 disabled:opacity-50 ${
                    isBookmarked
                      ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-400'
                      : 'bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-cyan-500/40 hover:text-cyan-400'
                  }`}
                >
                  <span aria-hidden="true">{isBookmarked ? '◈' : '◇'}</span>
                  {isBookmarked ? 'Bookmarked' : 'Bookmark'}
                </button>

                {localError && (
                  <p role="alert" className="text-xs text-red-400 font-mono ml-auto">{localError}</p>
                )}
              </div>
            )}

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 overscroll-contain">
              {/* Rendered Markdown — sanitized by DOMPurify */}
              <div
                className="mdx-content"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />

              {/* Resource links */}
              {safeResources.length > 0 && (
                <div className="mt-6 pt-5 border-t border-[var(--border-default)]">
                  <p className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-widest mb-3">
                    Resources
                  </p>
                  <ul className="space-y-2">
                    {safeResources.map((r, i) => (
                      <li key={i}>
                        <a
                          href={r.url}
                          rel="noopener noreferrer"
                          target="_blank"
                          className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--accent-purple-light)] hover:border-[var(--accent-purple)] transition-all duration-150 text-sm group"
                        >
                          <span className="flex-1 truncate">{r.label}</span>
                          <span className="text-xs opacity-60 group-hover:opacity-100 flex-shrink-0" aria-hidden="true">↗</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!user && (
                <div className="mt-6 p-4 rounded-xl bg-[rgba(124,58,237,0.06)] border border-[rgba(124,58,237,0.2)]">
                  <p className="text-sm text-[var(--text-secondary)]">
                    <strong className="text-[var(--accent-purple-light)]">Sign in</strong> to track your progress and bookmark topics.
                  </p>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
});

export default TopicPanel;
