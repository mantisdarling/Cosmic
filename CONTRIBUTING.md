# Contributing to Cosmic

Thank you for your interest in contributing! This guide will get you set up quickly.

## Table of Contents
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Adding a Topic](#adding-a-topic)
- [Adding a Roadmap](#adding-a-roadmap)
- [Code Style](#code-style)
- [Security Rules](#security-rules)
- [Pull Request Process](#pull-request-process)

---

## Getting Started

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/cosmic.git
cd cosmic

# 2. Install dependencies
npm install

# 3. Copy env template
cp .env.example .env
# (Fill in your Firebase credentials, or leave as-is to run without auth)

# 4. Start the dev server
npm run dev
# → http://localhost:4321
```

> **No Firebase?** The app runs in offline mode without credentials — auth and progress tracking are disabled, but all roadmaps and diagrams still work.

---

## Project Structure

```
src/
├── components/         # React islands + Astro components
│   ├── AuthButton.tsx  # Firebase Auth UI
│   ├── RoadmapFlow.tsx # React Flow diagram canvas
│   ├── RoadmapCanvas.tsx # Orchestrator island
│   ├── SearchBar.tsx   # Fuse.js search
│   ├── TopicPanel.tsx  # Side panel with markdown content
│   └── Nav.astro       # Navigation
├── content/
│   ├── roadmaps/       # Roadmap JSON files (one per roadmap)
│   └── topics/         # Topic JSON files (one per node)
├── layouts/
│   └── BaseLayout.astro # Shell with security headers
├── lib/
│   ├── security.ts     # Zod schemas, rate limiter, sanitizer
│   ├── firebase.ts     # Firebase client init
│   ├── firestore.ts    # Firestore helpers
│   └── search.ts       # Fuse.js index builder
├── pages/
│   ├── index.astro     # Landing page
│   ├── 404.astro
│   └── roadmap/
│       └── [slug].astro # Dynamic roadmap page
└── styles/
    └── global.css      # Tailwind v4 design system
```

---

## Adding a Topic

1. **Create** `src/content/topics/<node-id>.json`:

```json
{
  "id": "your-topic-id",
  "title": "Your Topic Title",
  "description": "One sentence description (max 300 chars).",
  "resources": [
    { "label": "Official Docs", "url": "https://example.com" }
  ],
  "body": "## What is it?\n\nMarkdown content here...\n\n## Why it matters\n\n..."
}
```

**Rules for `body`:**
- Use standard Markdown (`## h2`, `### h3`, lists, backtick code, tables)
- No raw HTML (it will be stripped by DOMPurify)
- Max 10,000 characters
- Keep code examples practical and concise

2. **Add the node** to the relevant roadmap JSON in `src/content/roadmaps/`:

```json
{
  "id": "your-topic-id",
  "label": "Your Topic",
  "parentId": "parent-node-id",
  "status": "todo",
  "type": "topic"
}
```

3. Run `npm run build` to confirm no errors.

---

## Adding a Roadmap

1. **Create** `src/content/roadmaps/<slug>.json`:

```json
{
  "id": "your-roadmap-slug",
  "title": "Your Roadmap Title",
  "description": "Short description (max 300 chars).",
  "icon": "🚀",
  "color": "#7c3aed",
  "nodes": [
    {
      "id": "root-node",
      "label": "Root Label",
      "parentId": null,
      "status": "todo",
      "type": "root"
    }
  ]
}
```

- `id` must match the filename (e.g. `devops.json` → `"id": "devops"`)
- `color` must be a 6-digit hex color (`#rrggbb`)
- The first node must have `"parentId": null` and `"type": "root"`

2. Create topic JSON files for each node.
3. The landing page and nav will automatically include your new roadmap.

---

## Code Style

- **TypeScript**: Strict mode is enforced. No `any` unless `// eslint-disable` with reason.
- **Security**: All new user-facing inputs must be validated through a Zod schema in `src/lib/security.ts`.
- **External links**: Must use `rel="noopener noreferrer"` and `target="_blank"`.
- **Errors**: Use `toSafeError()` — never expose raw error messages or stack traces to the UI.
- **No secrets**: Never hardcode API keys. Use `.env` variables prefixed `PUBLIC_`.

---

## Security Rules

> ⚠️ **Critical:** If your PR modifies `firestore.rules`, it must be reviewed by a maintainer before merge. Rules must never become _less restrictive_ than the current version.

Firestore rules changes require:
- A clear explanation of why the change is needed
- Confirmation the deny-all default is maintained
- Running `firebase emulators:start` and verifying rules locally

---

## Pull Request Process

1. Branch off `main`: `git checkout -b feat/your-feature`
2. Make your changes and run `npm run build` (must pass ✅)
3. Open a PR — use the PR template
4. A maintainer will review within a few days

For large changes, open an issue first to discuss the approach.
