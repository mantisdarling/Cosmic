import type { APIRoute } from 'astro';

export const prerender = false;

// Groq API endpoint URL for Llama 3.1 inference
const GROQ_API_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.GROQ_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'AI Tutor service is not configured. GROQ_API_KEY environment variable is missing.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let topic = '';
  let roadmap = '';
  let customPrompt = '';

  try {
    const payload = await request.json();
    topic = String(payload?.topic ?? '').slice(0, 200);
    roadmap = String(payload?.roadmap ?? '').slice(0, 100);
    customPrompt = String(payload?.prompt ?? '').slice(0, 600);
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON request payload.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!topic) {
    return new Response(
      JSON.stringify({ error: 'The topic parameter is required.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Construct structured teaching prompt for the requested topic
  const defaultPrompt = `You are an expert developer mentor. A student is learning "${topic}" as part of their ${roadmap} learning path.

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

  const promptText = customPrompt || defaultPrompt;

  try {
    const response = await fetch(GROQ_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: promptText }],
        max_tokens: 900,
        temperature: 0.7,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      const errorMessage = responseData?.error?.message ?? 'Upstream Groq API error.';
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const generatedText: string = responseData?.choices?.[0]?.message?.content ?? '';

    if (!generatedText) {
      return new Response(
        JSON.stringify({ error: 'Empty response returned from AI provider.' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ text: generatedText }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: 'Failed to communicate with AI provider backend.' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
