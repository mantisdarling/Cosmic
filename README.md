<div align="center">

![Cosmic — Developer Roadmaps](https://raw.githubusercontent.com/mantisdarling/cosmic/main/public/banner.png)

<br/>

**Interactive, visual learning roadmaps for developers.**  
Click any node to explore a topic. Sign in to track your progress.

<br/>

[![CI](https://github.com/mantisdarling/cosmic/actions/workflows/ci.yml/badge.svg)](https://github.com/mantisdarling/cosmic/actions/workflows/ci.yml)
[![Security Audit](https://github.com/mantisdarling/cosmic/actions/workflows/security.yml/badge.svg)](https://github.com/mantisdarling/cosmic/actions/workflows/security.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-7c3aed.svg)](./LICENSE)
[![Built with Astro](https://img.shields.io/badge/Built%20with-Astro%207-ff5d01?logo=astro&logoColor=white)](https://astro.build)
[![Deployed on Cloudflare Pages](https://img.shields.io/badge/Deployed%20on-Cloudflare%20Pages-f38020?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com)

</div>

---

## ✨ Features

| Feature | Details |
|---------|---------|
| 🗺️ **Interactive Diagrams** | Pan, zoom, click nodes — powered by React Flow + dagre tree layout |
| 🔍 **Fuzzy Search** | Find any topic instantly with Fuse.js across all roadmaps |
| 🔐 **Auth + Progress Tracking** | Google OAuth & email sign-in via Firebase Auth; progress synced to Firestore |
| 📖 **Rich Topic Content** | Every node has a markdown explainer + curated resource links |
| 🌗 **Dark / Light Mode** | System-aware theme with no flash of unstyled content |
| 🛡️ **Secure by Design** | Zod validation, DOMPurify sanitization, CSP headers, strict Firestore rules |
| ⚡ **Static-first** | Astro static output — deploys to Cloudflare Pages in seconds |
| ♿ **Accessible** | ARIA roles, keyboard navigation, focus management throughout |

---

## 🗺️ Roadmaps

| Roadmap | Nodes | Status |
|---------|-------|--------|
| 🌐 Full Stack Web Development | 15 | ✅ Available |
| 🤖 AI Engineering | — | 🚧 Coming soon |
| ⚙️ DevOps & Cloud | — | 🚧 Coming soon |
| 🎨 Frontend Mastery | — | 🚧 Coming soon |

---

## 🛠 Tech Stack

```
Framework     Astro 7          (static output, React islands)
UI            React 19 + TypeScript
Diagrams      @xyflow/react    (React Flow) + dagre layout
Styling       Tailwind CSS v4  (@tailwindcss/vite)
Markdown      marked + DOMPurify
Search        Fuse.js          (client-side fuzzy search)
Auth          Firebase Auth    (Google OAuth + email)
Database      Firestore        (user progress)
Animation     Framer Motion
Validation    Zod
Hosting       Cloudflare Pages
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm 10+

### Local development

```bash
# 1. Clone
git clone https://github.com/mantisdarling/cosmic.git
cd cosmic

# 2. Install
npm install

# 3. Configure environment
cp .env.example .env
# → Fill in your Firebase project values (or leave blank to run without auth)

# 4. Start dev server
npm run dev
# → http://localhost:4321
```

> **No Firebase?** The app runs fully without credentials. Auth features are gracefully disabled — all roadmaps, diagrams, and search still work.

### Commands

| Command | Action |
|---------|--------|
| `npm run dev` | Start dev server at `localhost:4321` |
| `npm run build` | Build static site to `./dist/` |
| `npm run preview` | Preview production build locally |
| `npx astro check` | TypeScript type-check |

---

## 📁 Project Structure

```
cosmic/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml          # Build + type-check on every push
│   │   └── security.yml    # Weekly npm audit
│   ├── ISSUE_TEMPLATE/     # Bug, feature, and content templates
│   └── PULL_REQUEST_TEMPLATE.md
├── public/
│   └── _headers            # Cloudflare Pages security headers (CSP, HSTS…)
├── src/
│   ├── components/
│   │   ├── AuthButton.tsx      # Firebase Auth modal (Google + email)
│   │   ├── RoadmapCanvas.tsx   # Main React island — orchestrates everything
│   │   ├── RoadmapFlow.tsx     # React Flow diagram + dagre layout
│   │   ├── SearchBar.tsx       # Fuse.js fuzzy search with ARIA combobox
│   │   ├── TopicPanel.tsx      # Slide-in panel with markdown content
│   │   ├── ProgressBar.tsx     # SVG ring progress indicator
│   │   └── Nav.astro           # Navigation + theme toggle
│   ├── content/
│   │   ├── roadmaps/           # Roadmap JSON files (one per path)
│   │   └── topics/             # Topic JSON files (one per node)
│   ├── layouts/
│   │   └── BaseLayout.astro    # HTML shell with CSP meta + theme script
│   ├── lib/
│   │   ├── security.ts         # Zod schemas, rate limiter, DOMPurify, safe errors
│   │   ├── firebase.ts         # Firebase client (Zod-validated config)
│   │   ├── firestore.ts        # Firestore helpers (path traversal prevention)
│   │   └── search.ts           # Fuse.js index builder
│   ├── pages/
│   │   ├── index.astro         # Landing page
│   │   ├── 404.astro
│   │   └── roadmap/[slug].astro # Dynamic roadmap page
│   └── styles/
│       └── global.css          # Tailwind v4 design tokens + global styles
├── firestore.rules             # Firestore security rules (deny-all default)
├── .env.example                # Environment variable template
├── astro.config.mjs
└── tsconfig.json               # Strict TypeScript
```

---

## 🔐 Security

Security is a first-class concern in this project. Key measures:

- **Input validation** — Every external value passes through a [Zod schema](./src/lib/security.ts) before use
- **Sanitization** — Markdown output is sanitized by DOMPurify with an allowlist of safe HTML tags
- **Rate limiting** — Auth attempts are rate-limited client-side (5 per minute per key)
- **Firestore rules** — Deny-all default; users can only read/write their own UID path; writes validated server-side
- **CSP headers** — Content-Security-Policy applied both via `<meta>` and Cloudflare Pages `_headers`
- **No stack traces** — Errors are mapped to safe generic messages via `toSafeError()` before reaching the UI
- **Safe external links** — All outbound links use `rel="noopener noreferrer"`
- **HTTPS-only resources** — Topic resource URLs must use `https://` (validated by Zod)

See [`SECURITY.md`](./SECURITY.md) for the vulnerability disclosure process.

---

## 🚢 Deploying to Cloudflare Pages

1. Push to GitHub
2. In Cloudflare Pages: **Create project → Connect to Git → Pick this repo**
3. Set build settings:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
4. Add environment variables (Settings → Environment variables):
   ```
   PUBLIC_FIREBASE_API_KEY
   PUBLIC_FIREBASE_AUTH_DOMAIN
   PUBLIC_FIREBASE_PROJECT_ID
   PUBLIC_FIREBASE_STORAGE_BUCKET
   PUBLIC_FIREBASE_MESSAGING_SENDER_ID
   PUBLIC_FIREBASE_APP_ID
   ```
5. Deploy Firestore rules: `firebase deploy --only firestore:rules`

> ℹ️ The `public/_headers` file automatically applies security headers on Cloudflare Pages — no extra configuration needed.

---

## ➕ Adding a Roadmap or Topic

See [**CONTRIBUTING.md**](./CONTRIBUTING.md) for the full guide including JSON schemas, style rules, and the PR process.

**Quick version:**

```bash
# Add a topic
touch src/content/topics/your-topic-id.json
# → { "id", "title", "description", "resources": [], "body": "## markdown..." }

# Add a node to a roadmap
# Edit src/content/roadmaps/fullstack.json → nodes[]
```

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first.

- 🐛 **Bug?** → [Open a bug report](https://github.com/mantisdarling/cosmic/issues/new?template=bug_report.md)
- 💡 **Feature idea?** → [Open a feature request](https://github.com/mantisdarling/cosmic/issues/new?template=feature_request.md)
- 📚 **Want to add a topic or roadmap?** → [Open a content request](https://github.com/mantisdarling/cosmic/issues/new?template=content_request.md)

---

## 📄 License

[MIT](./LICENSE) © 2026 [mantisdarling](https://github.com/mantisdarling)
