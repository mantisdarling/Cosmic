/**
 * src/lib/security.ts  (updated)
 *
 * Central security utility module — Zod schemas, sanitization, rate limiting, safe errors.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// SECTION 1: ZOD VALIDATION SCHEMAS
// ─────────────────────────────────────────────────────────────

export const NodeIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/, 'Node ID must be lowercase alphanumeric with hyphens only');

export const SlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens only');

export const EmailSchema = z
  .string()
  .email('Invalid email address')
  .max(254)
  .transform((e) => e.toLowerCase().trim());

export const NodeStatusSchema = z.enum(['todo', 'in-progress', 'done', 'bookmarked']);

export const SearchQuerySchema = z
  .string()
  .max(100)
  .transform((s) => s.trim());

export const ResourceSchema = z.object({
  label: z.string().min(1).max(120),
  url: z.string().url().startsWith('https://', 'Resource URLs must use HTTPS'),
});

export const RoadmapNodeSchema = z.object({
  id: NodeIdSchema,
  label: z.string().min(1).max(80),
  parentId: NodeIdSchema.nullable(),
  status: NodeStatusSchema,
  type: z.enum(['root', 'topic', 'optional']),
});

export const RoadmapSchema = z.object({
  id: SlugSchema,
  title: z.string().min(1).max(80),
  description: z.string().min(1).max(300),
  icon: z.string().max(4),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  nodes: z.array(RoadmapNodeSchema).min(1).max(200),
});

/** Schema for topic JSON files in /src/content/topics/ */
export const TopicSchema = z.object({
  id: NodeIdSchema,
  title: z.string().min(1).max(80),
  description: z.string().min(1).max(300),
  resources: z.array(ResourceSchema).max(10).default([]),
  body: z.string().max(10000).default(''),
});

export type RoadmapNode = z.infer<typeof RoadmapNodeSchema>;
export type Roadmap = z.infer<typeof RoadmapSchema>;
export type NodeStatus = z.infer<typeof NodeStatusSchema>;
export type Topic = z.infer<typeof TopicSchema>;
export type Resource = z.infer<typeof ResourceSchema>;

// ─────────────────────────────────────────────────────────────
// SECTION 2: SANITIZATION
// ─────────────────────────────────────────────────────────────

export function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.replace(/<[^>]*>/g, '').trim().slice(0, 1000);
}

/**
 * Sanitize HTML for safe rendering.
 * Uses DOMPurify — call only client-side (needs window).
 * 
 * SECURITY NOTE: This is applied to Markdown-rendered output from
 * developer-authored content files — NOT user-generated content.
 * DOMPurify provides defense-in-depth.
 */
export async function sanitizeHtml(html: string): Promise<string> {
  if (typeof window === 'undefined') return '';
  const { default: DOMPurify } = await import('dompurify');

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'strong', 'em',
      'code', 'pre', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'blockquote', 'hr', 'br', 'span',
    ],
    ALLOWED_ATTR: ['href', 'class', 'id', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    FORCE_BODY: false,
  } as Parameters<typeof DOMPurify.sanitize>[1]);
}

// ─────────────────────────────────────────────────────────────
// SECTION 3: RATE LIMITER
// ─────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_LOCKOUT_MS = 5 * 60_000;
const rateLimitStore = new Map<string, RateLimitEntry>();

export function checkRateLimit(key: string): { allowed: boolean; retryAfterMs?: number } {
  const safeKey = key.replace(/[^a-zA-Z0-9:@._-]/g, '').slice(0, 200);
  const now = Date.now();
  const entry = rateLimitStore.get(safeKey);

  if (!entry) {
    rateLimitStore.set(safeKey, { count: 1, firstAttemptAt: now, lockedUntil: null });
    return { allowed: true };
  }

  if (entry.lockedUntil !== null) {
    if (now < entry.lockedUntil) {
      return { allowed: false, retryAfterMs: entry.lockedUntil - now };
    }
    rateLimitStore.set(safeKey, { count: 1, firstAttemptAt: now, lockedUntil: null });
    return { allowed: true };
  }

  if (now - entry.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(safeKey, { count: 1, firstAttemptAt: now, lockedUntil: null });
    return { allowed: true };
  }

  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX_ATTEMPTS) {
    entry.lockedUntil = now + RATE_LIMIT_LOCKOUT_MS;
    rateLimitStore.set(safeKey, entry);
    return { allowed: false, retryAfterMs: RATE_LIMIT_LOCKOUT_MS };
  }

  rateLimitStore.set(safeKey, entry);
  return { allowed: true };
}

// ─────────────────────────────────────────────────────────────
// SECTION 4: SAFE ERROR HANDLER
// ─────────────────────────────────────────────────────────────

type SafeErrorCode =
  | 'AUTH_FAILED' | 'RATE_LIMITED' | 'INVALID_INPUT'
  | 'NOT_FOUND' | 'PERMISSION_DENIED' | 'NETWORK_ERROR' | 'UNKNOWN';

const SAFE_ERROR_MESSAGES: Record<SafeErrorCode, string> = {
  AUTH_FAILED: 'Authentication failed. Please check your credentials.',
  RATE_LIMITED: 'Too many attempts. Please wait a few minutes and try again.',
  INVALID_INPUT: 'The provided data is invalid. Please check your input.',
  NOT_FOUND: 'The requested resource was not found.',
  PERMISSION_DENIED: 'You do not have permission to perform this action.',
  NETWORK_ERROR: 'A network error occurred. Please check your connection.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

export function toSafeError(error: unknown, code: SafeErrorCode = 'UNKNOWN') {
  if (import.meta.env.DEV) {
    console.error('[DEV ONLY] Full error:', error);
  }
  return { code, message: SAFE_ERROR_MESSAGES[code] };
}

export function mapFirebaseError(errorCode: string): SafeErrorCode {
  const map: Record<string, SafeErrorCode> = {
    'auth/user-not-found': 'AUTH_FAILED',
    'auth/wrong-password': 'AUTH_FAILED',
    'auth/invalid-email': 'INVALID_INPUT',
    'auth/user-disabled': 'PERMISSION_DENIED',
    'auth/too-many-requests': 'RATE_LIMITED',
    'auth/email-already-in-use': 'INVALID_INPUT',
    'auth/weak-password': 'INVALID_INPUT',
    'auth/popup-closed-by-user': 'AUTH_FAILED',
    'auth/network-request-failed': 'NETWORK_ERROR',
    'auth/invalid-credential': 'AUTH_FAILED',
  };
  return map[errorCode] ?? 'UNKNOWN';
}
