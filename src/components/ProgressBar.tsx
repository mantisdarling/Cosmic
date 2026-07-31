/**
 * src/components/ProgressBar.tsx
 *
 * Progress ring/bar showing % complete for signed-in users.
 *
 * Security: reads only from validated ProgressMap — no raw Firestore data touches UI.
 */

import { useMemo, memo } from 'react';
import type { ProgressMap } from '../lib/firestore';
import type { Roadmap } from '../lib/security';

interface ProgressBarProps {
  roadmap: Roadmap;
  progress: ProgressMap;
}

const ProgressBar = memo(function ProgressBar({ roadmap, progress }: ProgressBarProps) {
  const { done, total, pct } = useMemo(() => {
    const total = roadmap.nodes.length;
    const done = roadmap.nodes.filter((n) => progress[n.id]?.status === 'done').length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { done, total, pct };
  }, [roadmap.nodes, progress]);

  // SVG circle ring constants
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (pct / 100) * circumference;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-default)]"
      role="status"
      aria-label={`Progress: ${done} of ${total} topics completed (${pct}%)`}
    >
      {/* SVG ring */}
      <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
        {/* Background ring */}
        <circle
          cx="22" cy="22" r={radius}
          fill="none"
          stroke="var(--border-default)"
          strokeWidth="3"
        />
        {/* Progress ring */}
        <circle
          cx="22" cy="22" r={radius}
          fill="none"
          stroke={pct === 100 ? '#10b981' : '#7c3aed'}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 22 22)"
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }}
        />
        {/* Percentage text */}
        <text
          x="22" y="22"
          textAnchor="middle"
          dominantBaseline="central"
          fill={pct === 100 ? '#10b981' : '#a78bfa'}
          fontSize="9"
          fontFamily="Space Mono, monospace"
          fontWeight="700"
        >
          {pct}%
        </text>
      </svg>

      {/* Text */}
      <div>
        <p className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider leading-none mb-0.5">
          Progress
        </p>
        <p className="font-sans text-sm font-semibold text-[var(--text-primary)] leading-none">
          {done} <span className="text-[var(--text-muted)] font-normal">/ {total} done</span>
        </p>
      </div>
    </div>
  );
});

export default ProgressBar;
