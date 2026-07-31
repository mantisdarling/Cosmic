/**
 * src/pages/api/ai.ts
 * Serverless endpoint — proxies Gemini 1.5 Flash using the GEMINI_API_KEY
 * environment variable set in Vercel. The key is NEVER exposed to the browser.
 *
 * POST /api/ai
 * Body: { topic: string, roadmap: string }
 * Returns: { html: string } (markdown rendered server-side)
 */

import type { APIRoute } from 'astro';

export const prerender = false;   // this route is server-rendered

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export const POST: APIRoute = async ({ request }) => {
  // ── Validate API key is configured ──────────────────────────────────────
  const apiKey = import.meta.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'AI Tutor is not configured. Set GEMINI_API_KEY in Vercel.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let topic = '';
  let roadmap = '';
  try {
    const body = await request.json();
    topic   = String(body?.topic   ?? '').slice(0, 200);
    roadmap = String(body?.roadmap ?? '').slice(0, 100);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!topic) {
    return new Response(JSON.stringify({ error: 'topic is required.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Build prompt ─────────────────────────────────────────────────────────
  const prompt = `You are an expert developer mentor. A student is learning "${topic}" as part of their ${roadmap} learning path.

Explain this topic clearly with the following sections using markdown:

## What is ${topic}?
A simple, jargon-free definition (2-3 sentences).

## Why does it matter?
Real-world importance and where it is used.

## Key concepts to master
Bullet list of the 4–6 most important things to understand.

## How to get started
3–4 concrete first steps a beginner can take today.

## Common mistakes to avoid
2–3 pitfalls beginners often hit, and how to avoid them.

Be friendly, practical, and motivating. Use markdown formatting. Around 400–550 words total.`;

  // ── Call Gemini ──────────────────────────────────────────────────────────
  try {
    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 900, temperature: 0.7 },
      }),
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const msg = data?.error?.message ?? 'Gemini API error';
      return new Response(JSON.stringify({ error: msg }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }

    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!text) {
      return new Response(JSON.stringify({ error: 'Empty response from Gemini.' }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to reach Gemini API.' }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    });
  }
};
