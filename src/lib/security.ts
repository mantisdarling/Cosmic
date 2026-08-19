import { z } from 'zod';

// Input Validation Schemas
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
  .email('Invalid email address')
  .max(254)
  .transform((email) => email.toLowerCase().trim());

export const NodeStatusSchema = z.enum(['todo', 'in-progress', 'done', 'bookmarked']);

export const SearchQuerySchema = z
  .string()
  .max(100)
  .transform((query) => query.trim());

export const ResourceSchema = z.object({
  label: z.string().min(1).max(120),
  url: z.url().startsWith('https://', 'Resource URLs must use HTTPS'),
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

// Sanitizes raw text string inputs by stripping HTML tags
export function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.replace(/<[^>]*>/g, '').trim().slice(0, 1000);
}

// Sanitizes Markdown-rendered HTML output via client-side DOMPurify
export async function sanitizeHtml(htmlContent: string): Promise<string> {
  if (typeof window === 'undefined') return '';
  const { default: DOMPurify } = await import('dompurify');

  return DOMPurify.sanitize(htmlContent, {
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

// In-Memory Rate Limiting
interface RateLimitEntry {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_LOCKOUT_MS = 300000;
const rateLimitStore = new Map<string, RateLimitEntry>();

export function checkRateLimit(key: string): { allowed: boolean; retryAfterMs?: number } {
  const safeKey = key.replace(/[^a-zA-Z0-9:@.-]/g, '').slice(0, 200);
  const currentTime = Date.now();
  const entry = rateLimitStore.get(safeKey);

  if (!entry) {
    rateLimitStore.set(safeKey, { count: 1, firstAttemptAt: currentTime, lockedUntil: null });
    return { allowed: true };
  }

  if (entry.lockedUntil !== null) {
    if (currentTime < entry.lockedUntil) {
      return { allowed: false, retryAfterMs: entry.lockedUntil - currentTime };
    }
    rateLimitStore.set(safeKey, { count: 1, firstAttemptAt: currentTime, lockedUntil: null });
    return { allowed: true };
  }

  if (currentTime - entry.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(safeKey, { count: 1, firstAttemptAt: currentTime, lockedUntil: null });
    return { allowed: true };
  }

  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX_ATTEMPTS) {
    entry.lockedUntil = currentTime + RATE_LIMIT_LOCKOUT_MS;
    rateLimitStore.set(safeKey, entry);
    return { allowed: false, retryAfterMs: RATE_LIMIT_LOCKOUT_MS };
  }

  rateLimitStore.set(safeKey, entry);
  return { allowed: true };
}

// Error Standardizing Helper Functions
type SafeErrorCode =
  | 'AUTH_FAILED'
  | 'RATE_LIMITED'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

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
    console.error('[Development Error Log]:', error);
  }
  return { code, message: SAFE_ERROR_MESSAGES[code] };
}

export function mapFirebaseError(errorCode: string): SafeErrorCode {
  const firebaseErrorMap: Record<string, SafeErrorCode> = {
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
  return firebaseErrorMap[errorCode] ?? 'UNKNOWN';
}

/**
 * Robustly parses a JSON string generated by AI, removing any conversational preambles/postambles,
 * cleaning trailing commas inside arrays or objects, and removing single/multi-line comments.
 */
export function cleanAndParseJSON(rawText: string): any {
  const firstBrace = rawText.indexOf('{');
  const firstBracket = rawText.indexOf('[');
  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = rawText.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = rawText.lastIndexOf(']');
  }

  if (startIdx === -1 || endIdx === -1) {
    throw new Error('No valid JSON structure found in AI response.');
  }

  let jsonStr = rawText.substring(startIdx, endIdx + 1);

  // Remove trailing commas from arrays and objects
  jsonStr = jsonStr.replace(/,(\s*[\]}])/g, '$1');

  // Remove single line and multi-line comments
  jsonStr = jsonStr.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');

  return JSON.parse(jsonStr);
}

