<div align="center">

# ✦ Cosmic — Developer Roadmaps

**Interactive, visual learning roadmaps for modern developers powered by AI.**

Explore 50+ curated developer learning paths, visualize topic hierarchies in clean left-to-right graphs, track your completion progress, and learn anything instantly with the integrated AI Tutor.

[![License: MIT](https://img.shields.io/badge/License-MIT-F5A623.svg)](./LICENSE)
[![Built with Astro](https://img.shields.io/badge/Built%20with-Astro-FF5D01?logo=astro&logoColor=white)](https://astro.build)
[![Powered by React Flow](https://img.shields.io/badge/Diagrams-React%20Flow-00E5FF?logo=react&logoColor=white)](https://reactflow.dev)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com)

</div>

---

## ⚡ Highlights

- **50+ Comprehensive Roadmaps**: Covers Frontend, Backend, Full Stack, DevOps, AI/ML Engineering, Systems Programming, Databases, Cloud, Cyber Security, Mobile, and more.
- **Interactive Graph Canvas**: Powered by `@xyflow/react` and `dagre` tree layout with automated left-to-right node hierarchy.
- **✦ AI Tutor**: Instant, jargon-free topic explanations powered by Llama 3.1 (via Groq serverless proxy) along with automated follow-up topic recommendations.
- **Progress & Completion Tracking**: Persistent progress tracking saved locally per roadmap, featuring celebratory completion badges and one-click shareable achievement cards.
- **Instant Search**: Real-time client-side search across all 50+ role-based and skill-based roadmaps.
- **Cyberpunk Obsidian Design System**: Deep obsidian `#0B0C10` background, electric cyan and amber accents, dynamic wallpaper support, and high-contrast accessibility.

---

## 🛠️ Tech Stack

| Component | Technology | Description |
|-----------|------------|-------------|
| **Core Framework** | Astro 5 | High-performance static site generator with serverless API route capabilities |
| **UI Library** | React 19 + TypeScript | Interactive islands for canvas graph diagrams, drawers, and modal dialogs |
| **Diagram Engine** | `@xyflow/react` (React Flow) + `dagre` | Automatic left-to-right directed graph layout calculations |
| **AI Backend** | Groq API (`llama-3.1-8b-instant`) | Serverless proxy endpoint in `src/pages/api/ai.ts` |
| **Styling** | Tailwind CSS v4 + Vanilla CSS | Custom Cyberpunk Obsidian design tokens and dark mode styling |
| **Markdown Parsing** | `marked` + DOMPurify | Client-side safe markdown rendering with HTML sanitization |
| **Validation** | Zod | Runtime schema validation for data models and API payloads |
| **Deployment** | Vercel | Automatic CI/CD build deployment with serverless route handling |

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js `20.x` or higher
- npm `10.x` or higher

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/mantisdarling/cosmic.git
cd cosmic

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
```

### 3. Environment Setup

To enable the AI Tutor feature in local development, add your Groq API key to `.env`:

```env
GROQ_API_KEY=your_groq_api_key_here
```

> **Note**: The app operates smoothly even without an API key — all 50+ roadmap canvas diagrams, progress tracking, and search remain fully functional.

### 4. Running Development Server

```bash
npm run dev
# → Local development server running at http://localhost:4321
```

---

## 💻 CLI Commands

| Command | Action |
|---------|--------|
| `npm run dev` | Starts local development server at `http://localhost:4321` |
| `npm run build` | Builds optimized production assets to `./dist/` |
| `npm run preview` | Runs local server preview of the `./dist/` build output |
| `npx astro check` | Executes TypeScript type checking across all project files |

---

## 📁 Repository Structure

```
cosmic/
├── public/
│   ├── zenitsu-hero.jpg      # Homepage hero section wallpaper
│   └── roadmap-bg.jpg        # Individual roadmap canvas background wallpaper
├── src/
│   ├── components/
│   │   ├── RoadmapCanvas.tsx # Primary React island orchestrating graph & drawer state
│   │   ├── RoadmapFlow.tsx   # React Flow canvas renderer with Dagre auto-layout
│   │   ├── TopicPanel.tsx    # Slide-in details drawer & AI Tutor interface
│   │   ├── AuthButton.tsx    # User authentication modal component
│   │   ├── SearchBar.tsx     # Client-side roadmap filter search
│   │   └── ProgressBar.tsx   # Visual progress indicator
│   ├── content/
│   │   └── roadmaps/         # 50+ JSON roadmap definition schemas
│   ├── layouts/
│   │   └── BaseLayout.astro  # Base HTML document shell with security headers
│   ├── lib/
│   │   ├── security.ts       # Zod schemas, rate limiters, HTML sanitizers
│   │   ├── firebase.ts       # Firebase initialization helper
│   │   └── firestore.ts      # Data persistence utilities
│   ├── pages/
│   │   ├── api/
│   │   │   └── ai.ts         # Serverless AI proxy endpoint for Groq Llama 3.1
│   │   ├── index.astro       # Cosmic homepage with search and catalog grid
│   │   ├── 404.astro         # Custom 404 error page
│   │   └── roadmap/[slug].astro # Dynamic roadmap canvas route
│   └── styles/
│       └── global.css        # Global CSS variables and design tokens
├── astro.config.mjs          # Astro integration configuration
├── package.json
└── tsconfig.json             # Strict TypeScript configuration
```

---

## 🔐 Security & Best Practices

- **Zero API Key Leakage**: All AI requests are securely proxied through the serverless `/api/ai` endpoint; API keys are never exposed to the client.
- **Input Validation**: All payloads, node IDs, and slugs are parsed using strict [Zod schemas](./src/lib/security.ts).
- **DOM Sanitization**: Rendered markdown content is sanitized using DOMPurify with strict HTML element allowlists.
- **Security Headers**: Production output enforces strict Content-Security-Policy (CSP), X-Content-Type-Options, and Frame Options.
- **Rate Limiting**: Serverless and client authentication requests are rate-limited to protect against abuse.

---

## 🤝 Contributing

We welcome contributions of new roadmaps, content updates, and feature enhancements! Please read our [**Contributing Guide**](./CONTRIBUTING.md) to get started.

---

## 📜 License

This project is open source and available under the [MIT License](./LICENSE).
