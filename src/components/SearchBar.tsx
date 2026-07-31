/**
 * src/components/SearchBar.tsx
 *
 * Global fuzzy search using Fuse.js.
 *
 * Security:
 *  - All query input passes through SearchQuerySchema (max 100 chars, trimmed).
 *  - Results are strictly typed — no arbitrary object shapes reach the DOM.
 *  - Result labels/titles come from validated roadmap JSON (Zod schema), never user input.
 *  - Keyboard navigation uses whitelist (ArrowUp/Down/Enter/Escape).
 *  - Debounced to 200ms to prevent excessive computation.
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import Fuse from 'fuse.js';
import { motion, AnimatePresence } from 'framer-motion';
import { buildSearchIndex, search, type SearchResult } from '../lib/search';
import { SearchQuerySchema } from '../lib/security';
import type { Roadmap } from '../lib/security';

interface SearchBarProps {
  roadmaps: Roadmap[];
}

const SearchBar = memo(function SearchBar({ roadmaps }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [fuse, setFuse] = useState<Fuse<any> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build search index once on mount
  useEffect(() => {
    setFuse(buildSearchIndex(roadmaps));
  }, [roadmaps]);

  // Run search with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (!fuse || query.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }
      // Input validated inside search() via SearchQuerySchema
      const res = search(fuse, query);
      setResults(res);
      setIsOpen(res.length > 0);
      setActiveIndex(-1);
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fuse]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Whitelist-only key handling
      const ALLOWED_KEYS = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'];
      if (!ALLOWED_KEYS.includes(e.key)) return;

      if (e.key === 'Escape') {
        setIsOpen(false);
        setActiveIndex(-1);
        inputRef.current?.blur();
        return;
      }
      if (!isOpen || results.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        navigateToResult(results[activeIndex]);
      } else if (e.key === 'Tab') {
        setIsOpen(false);
      }
    },
    [isOpen, results, activeIndex],
  );

  function navigateToResult(result: SearchResult) {
    if (result.type === 'roadmap') {
      window.location.href = `/roadmap/${result.roadmapId}`;
    } else {
      window.location.href = `/roadmap/${result.roadmapId}#${result.nodeId}`;
    }
    setIsOpen(false);
    setQuery('');
  }

  // Validate input before storing in state
  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const result = SearchQuerySchema.safeParse(raw);
    // Accept raw input (validated on search, not on keystroke for UX)
    // but enforce the max length hard limit
    if (raw.length <= 100) {
      setQuery(raw);
    }
  }, []);

  // Keyboard shortcut: / to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-sm" role="search">
      <div className="relative">
        <span
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm pointer-events-none"
          aria-hidden="true"
        >
          ⌕
        </span>
        <input
          ref={inputRef}
          id="global-search"
          type="search"
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={100}
          placeholder="Search roadmaps… ( / )"
          aria-label="Search roadmaps and topics"
          aria-autocomplete="list"
          aria-controls={isOpen ? 'search-results' : undefined}
          aria-activedescendant={activeIndex >= 0 ? `search-result-${activeIndex}` : undefined}
          aria-expanded={isOpen}
          role="combobox"
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm focus:outline-none focus:border-[var(--accent-purple)] transition-colors font-sans"
        />
        {query.length > 0 && (
          <button
            onClick={() => { setQuery(''); setIsOpen(false); inputRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] font-mono text-xs transition-colors"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Results dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.ul
            ref={listRef}
            id="search-results"
            role="listbox"
            aria-label="Search results"
            className="absolute top-full left-0 right-0 mt-2 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl shadow-[var(--shadow-panel)] overflow-hidden z-50 max-h-80 overflow-y-auto"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {results.map((result, i) => (
              <li
                key={`${result.roadmapId}-${result.nodeId ?? 'root'}`}
                id={`search-result-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                  i === activeIndex
                    ? 'bg-[rgba(124,58,237,0.12)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent input blur
                  navigateToResult(result);
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <span
                  className="flex-shrink-0 font-mono text-xs px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                  aria-hidden="true"
                >
                  {result.type === 'roadmap' ? '⊞' : '◎'}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {result.nodeLabel ?? result.roadmapTitle}
                  </p>
                  {result.type === 'node' && (
                    <p className="font-mono text-xs text-[var(--text-muted)] truncate">
                      {result.roadmapTitle}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
});

export default SearchBar;
