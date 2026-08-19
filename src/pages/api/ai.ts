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
  let action = '';

  try {
    const payload = await request.json();
    topic = String(payload?.topic ?? '').slice(0, 200);
    roadmap = String(payload?.roadmap ?? '').slice(0, 100);
    customPrompt = String(payload?.prompt ?? '').slice(0, 600);
    action = String(payload?.action ?? '');
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

  let promptText = customPrompt;

  if (action === 'generate') {
    promptText = `Generate a learning roadmap for the topic: "${topic}".
You MUST return ONLY a raw, valid JSON object (no markdown formatting, no code blocks, no text before or after).
The JSON object MUST EXACTLY match this schema:
{
  "id": "slug-for-topic",
  "title": "Human readable title",
  "description": "One sentence description",
  "icon": "emoji",
  "color": "#hexcolor",
  "nodes": [
    { "id": "unique-id", "label": "Label", "parentId": null, "status": "todo", "type": "root" },
    { "id": "unique-id-2", "label": "Subtopic", "parentId": "unique-id", "status": "todo", "type": "topic" }
  ]
}
Rules:
- EXACTLY ONE node MUST have "type": "root" and "parentId": null.
- All other nodes MUST have a valid "parentId" referencing another node in the array.
- "type" MUST be exactly one of: "root", "topic", or "optional".
- "status" MUST be "todo".
- Create between 15 and 25 nodes to ensure a detailed roadmap.
- Provide a coherent hierarchy.
- Prefix all node IDs with a short version of the topic to ensure uniqueness (e.g., if topic is "Web3", ids could be "web3-root", "web3-blockchain", etc).
DO NOT wrap the response in \`\`\`json. Return ONLY the raw JSON string.`;
  } else if (action === 'quiz') {
    promptText = `Generate a 3-question multiple-choice quiz about "${topic}" in the context of ${roadmap}.
Return ONLY a valid JSON array. Each object in the array must have:
- "question": string
- "options": array of 4 string options
- "answerIndex": number (0-3) indicating the correct option
- "explanation": string explaining why the answer is correct
DO NOT wrap the response in \`\`\`json. Return ONLY the raw JSON string.`;
  } else if (action === 'challenge') {
    promptText = `Create one practical JavaScript coding challenge for a learner studying "${topic}" in the "${roadmap}" roadmap.
Return ONLY one valid JSON object with exactly these fields:
{
  "title": "short challenge title",
  "brief": "2-3 sentence task description",
  "functionName": "solve",
  "starterCode": "valid JavaScript defining function solve(...args) with a TODO body",
  "tests": [
    { "input": ["JSON-compatible argument 1", 2], "expected": "JSON-compatible expected return value" }
  ],
  "hint": "one concise hint"
}
Rules:
- Use JavaScript only and make the solution runnable in a browser without imports.
- The function MUST be named solve and MUST return a JSON-compatible value.
- Include exactly 3 deterministic tests with small values.
- Keep the challenge solvable in 10–15 minutes and connected to the topic.
- Do not include markdown fences, HTML, or extra keys.
DO NOT wrap the response in \`\`\`json. Return ONLY the raw JSON string.`;
  } else if (topic.startsWith('next-after-')) {
    promptText = customPrompt; // Using the provided custom prompt for recommendations
  } else if (!promptText) {
    promptText = `You are an expert developer mentor. A student is learning "${topic}" as part of their ${roadmap} learning path.

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
  }

  try {
    const response = await fetch(GROQ_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
        body: JSON.stringify({
          model: import.meta.env.GROQ_MODEL || 'openai/gpt-oss-20b',
          messages: [{ role: 'user', content: promptText }],
          max_completion_tokens: action === 'generate' ? 2500 : action === 'challenge' ? 1400 : 900,
          temperature: action === 'challenge' ? 0.2 : 0.7,
          ...(action === 'challenge' ? {
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'coding_challenge',
                strict: true,
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    brief: { type: 'string' },
                    functionName: { type: 'string', enum: ['solve'] },
                    starterCode: { type: 'string' },
                    tests: {
                      type: 'array',
                      minItems: 3,
                      maxItems: 3,
                      items: {
                        type: 'object',
                        properties: { input: { type: 'array', items: {} }, expected: {} },
                        required: ['input', 'expected'],
                        additionalProperties: false,
                      },
                    },
                    hint: { type: 'string' },
                  },
                  required: ['title', 'brief', 'functionName', 'starterCode', 'tests', 'hint'],
                  additionalProperties: false,
                },
              },
            },
          } : {}),
          ...(String(import.meta.env.GROQ_MODEL || 'openai/gpt-oss-20b').startsWith('openai/gpt-oss/') ? { include_reasoning: false } : {}),
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
