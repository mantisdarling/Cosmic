/**
 * src/lib/search.ts
 *
 * Fuse.js fuzzy search setup.
 *
 * Security:
 *  - All search input passes through SearchQuerySchema (max 100 chars, trimmed).
 *  - Results are typed — no arbitrary object shapes reach the UI.
 *  - No server-side search: all data is pre-loaded from static JSON (no injection vectors).
 */

import Fuse from 'fuse.js';
import { SearchQuerySchema, type Roadmap } from './security';

export interface SearchResult {
  type: 'roadmap' | 'node';
  roadmapId: string;
  roadmapTitle: string;
  nodeId?: string;
  nodeLabel?: string;
  score: number;
}

interface SearchIndex {
  type: 'roadmap' | 'node';
  roadmapId: string;
  roadmapTitle: string;
  nodeId?: string;
  nodeLabel?: string;
  searchText: string;
}

/**
 * Build a Fuse.js search index from loaded roadmaps.
 * Call once at page load; results are pure static data.
 */
export function buildSearchIndex(roadmaps: Roadmap[]): Fuse<SearchIndex> {
  const items: SearchIndex[] = [];

  for (const roadmap of roadmaps) {
    // Add the roadmap itself as a searchable item
    items.push({
      type: 'roadmap',
      roadmapId: roadmap.id,
      roadmapTitle: roadmap.title,
      searchText: `${roadmap.title} ${roadmap.description}`,
    });

    // Add each node
    for (const node of roadmap.nodes) {
      items.push({
        type: 'node',
        roadmapId: roadmap.id,
        roadmapTitle: roadmap.title,
        nodeId: node.id,
        nodeLabel: node.label,
        searchText: node.label,
      });
    }
  }

  return new Fuse(items, {
    keys: ['searchText'],
    threshold: 0.35,        // Fuzzy match sensitivity (lower = stricter)
    distance: 100,
    includeScore: true,
    minMatchCharLength: 2,
    shouldSort: true,
    findAllMatches: false,
    ignoreLocation: true,
  });
}

/**
 * Execute a fuzzy search with input validation.
 * Returns an empty array for invalid or empty queries.
 */
export function search(fuse: Fuse<SearchIndex>, rawQuery: string): SearchResult[] {
  // Validate and sanitize the query — strip HTML tags, enforce length limit
  const queryResult = SearchQuerySchema.safeParse(rawQuery);
  if (!queryResult.success || queryResult.data.length < 2) return [];

  const results = fuse.search(queryResult.data, { limit: 12 });

  return results.map((r) => ({
    type: r.item.type,
    roadmapId: r.item.roadmapId,
    roadmapTitle: r.item.roadmapTitle,
    nodeId: r.item.nodeId,
    nodeLabel: r.item.nodeLabel,
    score: r.score ?? 1,
  }));
}
