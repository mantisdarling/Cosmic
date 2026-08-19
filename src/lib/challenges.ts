import { cleanAndParseJSON } from './clientSecurity';

export interface ChallengeTest {
  input: unknown[];
  expected: unknown;
}

export interface CodingChallenge {
  title: string;
  brief: string;
  functionName: 'solve';
  starterCode: string;
  tests: ChallengeTest[];
  hint: string;
}

export interface ChallengeRun {
  passed: number;
  total: number;
  outputs: { passed: boolean; expected: unknown; actual?: unknown; error?: string }[];
}

const CHALLENGE_CACHE_TTL_MS = 30 * 60 * 1000;
const inFlightChallenges = new Map<string, Promise<CodingChallenge>>();

type CachedChallenge = { savedAt: number; challenge: CodingChallenge };

const challengeCacheKey = (topic: string, roadmap: string) =>
  `cosmic-challenge-${roadmap.trim().toLowerCase()}-${topic.trim().toLowerCase()}`
    .replace(/[^a-z0-9-]+/g, '-')
    .slice(0, 180);

const readCachedChallenge = (topic: string, roadmap: string): CodingChallenge | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(challengeCacheKey(topic, roadmap));
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedChallenge;
    if (!cached || Date.now() - cached.savedAt > CHALLENGE_CACHE_TTL_MS) {
      window.localStorage.removeItem(challengeCacheKey(topic, roadmap));
      return null;
    }
    return cached.challenge;
  } catch {
    return null;
  }
};

const writeCachedChallenge = (topic: string, roadmap: string, challenge: CodingChallenge) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      challengeCacheKey(topic, roadmap),
      JSON.stringify({ savedAt: Date.now(), challenge } satisfies CachedChallenge),
    );
  } catch {
    // Storage may be unavailable or full; the live request still succeeds.
  }
};

const asText = (value: unknown, fallback: string, limit: number) => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.slice(0, limit) || fallback;
};

export function fallbackChallenge(topic: string, roadmap: string): CodingChallenge {
  return {
    title: `Build a ${topic} helper`,
    brief: `Write a small JavaScript function that removes duplicate values while preserving their original order. This is a practical warm-up for the ${roadmap} route and should be solved with a clean, readable data structure.`,
    functionName: 'solve',
    starterCode: `function solve(values) {\n  // Return values without duplicates, keeping the first occurrence.\n  return [];\n}`,
    tests: [
      { input: [[1, 2, 1, 3]], expected: [1, 2, 3] },
      { input: [['react', 'node', 'react']], expected: ['react', 'node'] },
      { input: [[]], expected: [] },
    ],
    hint: 'A Set remembers which values you have already seen. Build a new array as you walk through the input.',
  };
}

export function parseChallengePayload(raw: string, topic: string, roadmap: string): CodingChallenge {
  const value = cleanAndParseJSON(raw) as Partial<CodingChallenge>;
  const tests = Array.isArray(value.tests) ? value.tests.slice(0, 3).filter((test): test is ChallengeTest => Array.isArray(test?.input) && 'expected' in test) : [];
  if (!tests.length || typeof value.starterCode !== 'string') return fallbackChallenge(topic, roadmap);
  return {
    title: asText(value.title, `Practice ${topic}`, 100),
    brief: asText(value.brief, `Practice ${topic} with a small, focused coding task.`, 500),
    functionName: 'solve',
    starterCode: value.starterCode.slice(0, 12000),
    tests,
    hint: asText(value.hint, 'Break the task into one small transformation, then test the edge case.', 260),
  };
}

export async function requestCodingChallenge(topic: string, roadmap: string): Promise<CodingChallenge> {
  const cached = readCachedChallenge(topic, roadmap);
  if (cached) return cached;

  const key = challengeCacheKey(topic, roadmap);
  const existingRequest = inFlightChallenges.get(key);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, roadmap, action: 'challenge' }),
    });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error ?? 'AI challenge service is unavailable.');
    const challenge = parseChallengePayload(String(data.text ?? ''), topic, roadmap);
    writeCachedChallenge(topic, roadmap, challenge);
    return challenge;
  })();

  inFlightChallenges.set(key, request);
  try {
    return await request;
  } finally {
    inFlightChallenges.delete(key);
  }
}

const MAX_SOLUTION_LENGTH = 12000;
const MAX_TEST_PAYLOAD_LENGTH = 8000;
const blockedTokens = /\b(document|window|parent|top|self|globalThis|global|location|navigator|fetch|localStorage|sessionStorage|indexedDB|caches|XMLHttpRequest|WebSocket|Worker|SharedWorker|BroadcastChannel|MessageChannel|importScripts|import|eval|WebAssembly|Atomics|postMessage|setTimeout|setInterval|requestAnimationFrame)\b|\b(?:new\s+Function|Function\s*\()/i;

/**
 * Execute learner code as a real script inside a sandboxed iframe. This avoids
 * eval/new Function, which are blocked by the site's CSP, while keeping the
 * runner isolated from the parent document and network APIs.
 */
export async function runCodingChallenge(challenge: CodingChallenge, sourceCode: string): Promise<ChallengeRun> {
  if (!sourceCode.trim()) throw new Error('Write a solution before running the tests.');
  if (sourceCode.length > MAX_SOLUTION_LENGTH) throw new Error('Keep the solution under 12,000 characters.');
  if (JSON.stringify(challenge.tests).length > MAX_TEST_PAYLOAD_LENGTH) throw new Error('This challenge test payload is too large to run safely.');
  if (blockedTokens.test(sourceCode)) {
    throw new Error('This runner only supports pure JavaScript functions without browser or network access.');
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('The challenge runner is available in the browser only.');
  }

  const tests = JSON.stringify(challenge.tests);
  const escapedSource = sourceCode.replace(/<\/script/gi, '<\\/script');
  const runnerScript = `
    (() => {
      const tests = ${tests};
      const equal = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
      try {
        ${escapedSource}
        if (typeof solve !== 'function') throw new Error('Your code must define function solve(...args).');
        const outputs = tests.map((test) => {
          try {
            const actual = solve(...test.input);
            return { passed: equal(actual, test.expected), expected: test.expected, actual };
          } catch (error) {
            return { passed: false, expected: test.expected, error: error instanceof Error ? error.message : 'Test threw an error.' };
          }
        });
        parent.postMessage({ type: 'cosmic-challenge-result', outputs }, '*');
      } catch (error) {
        parent.postMessage({ type: 'cosmic-challenge-error', error: error instanceof Error ? error.message : 'Unable to execute this solution.' }, '*');
      }
    })();
  `;

  return new Promise<ChallengeRun>((resolve, reject) => {
    const frame = document.createElement('iframe');
    let settled = false;
    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      frame.remove();
    };
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      cleanup();
      callback();
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || !event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'cosmic-challenge-error') {
        finish(() => reject(new Error(String(event.data.error ?? 'Unable to execute this solution.'))));
        return;
      }
      if (event.data.type !== 'cosmic-challenge-result' || !Array.isArray(event.data.outputs)) return;
      const outputs = event.data.outputs as ChallengeRun['outputs'];
      finish(() => resolve({ passed: outputs.filter((result) => result.passed).length, total: outputs.length, outputs }));
    };
    const timeout = window.setTimeout(() => finish(() => reject(new Error('The solution took too long to finish.'))), 1500);
    window.addEventListener('message', onMessage);
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.display = 'none';
    frame.srcdoc = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; style-src 'none';" /></head><body><script>${runnerScript.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
    document.body.appendChild(frame);
  });
}
