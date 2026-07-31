/**
 * src/pages/api/ai.ts
 * Serverless endpoint — proxies Groq (llama-3.1-8b-instant, free tier)
 * Uses GROQ_API_KEY env variable set in Vercel. Never exposed to browser.
 *
 * POST /api/ai
 * Body: { topic: string, roadmap: string }
 * Returns: { text: string }
 */

import type { APIRoute } from 'astro';

export const prerender = false;

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'AI Tutor not configured. Set GROQ_API_KEY in Vercel.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let topic = '', roadmap = '', customPrompt = '';
  try {
    const body = await request.json();
    topic       = String(body?.topic   ?? '').slice(0, 200);
    roadmap     = String(body?.roadmap ?? '').slice(0, 100);
    customPrompt = String(body?.prompt ?? '').slice(0, 600);
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

  const prompt = customPrompt || `You are an expert developer mentor. A student is learning "${topic}" as part of their ${roadmap} learning path.

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

Be friendly, practical, and motivating. Use markdown. Around 400–500 words total.`;

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 900,
        temperature: 0.7,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data?.error?.message ?? 'Groq API error';
      return new Response(JSON.stringify({ error: msg }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }

    const text: string = data?.choices?.[0]?.message?.content ?? '';
    if (!text) {
      return new Response(JSON.stringify({ error: 'Empty response from AI.' }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to reach AI service.' }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    });
  }
};
