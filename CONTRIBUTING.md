# Contributing to Cosmic

Thank you for your interest in contributing to **Cosmic**! We welcome community contributions including new developer roadmaps, topic additions, feature enhancements, and bug fixes.

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Development Setup](#development-setup)
- [Project Architecture](#project-architecture)
- [Adding a New Roadmap](#adding-a-new-roadmap)
- [Updating Topic Content](#updating-topic-content)
- [Coding Guidelines](#coding-guidelines)
- [Submitting a Pull Request](#submitting-a-pull-request)

---

## 📜 Code of Conduct

We aim to build an inclusive, welcoming community. Please treat all contributors with respect and maintain a constructive, encouraging tone in issue discussions and pull request reviews.

---

## 🛠️ Development Setup

### 1. Fork & Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/cosmic.git
cd cosmic
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

If you wish to test AI Tutor features locally, add your Groq API key:

```env
GROQ_API_KEY=your_groq_api_key_here
```

### 4. Start Development Server

```bash
npm run dev
```

Open `http://localhost:4321` in your browser to test your changes live.

---

## 🏗️ Project Architecture

- **`src/content/roadmaps/`**: Contains JSON definitions for each roadmap (e.g. `frontend.json`, `python.json`).
- **`src/components/`**: React island components for interactive graph layout, slide-in details drawer, search, and progress tracking.
- **`src/pages/api/ai.ts`**: Serverless backend proxy endpoint for Groq Llama 3.1 AI Tutor inference.
- **`src/lib/security.ts`**: Input validation schemas (Zod), DOMPurify sanitization, and rate-limiting helpers.

---

## 🗺️ Adding a New Roadmap

To add a new roadmap to Cosmic:

1. Create a new JSON file in `src/content/roadmaps/<roadmap-slug>.json`.
2. Structure the JSON payload according to the following schema:

```json
{
  "id": "your-roadmap-slug",
  "title": "Your Roadmap Title",
  "description": "A concise one-sentence overview of this learning path.",
  "icon": "🚀",
  "color": "#F5A623",
  "nodes": [
    {
      "id": "your-roadmap-slug-root",
      "label": "Root Topic Title",
      "parentId": null,
      "status": "todo",
      "type": "root"
    },
    {
      "id": "your-roadmap-slug-topic-1",
      "label": "First Core Topic",
      "parentId": "your-roadmap-slug-root",
      "status": "todo",
      "type": "topic"
    }
  ]
}
```

### Guidelines for Roadmaps:
- **Node IDs**: Must be globally unique across all roadmaps. Prefix node IDs with your roadmap slug (e.g. `flutter-widgets`).
- **Hierarchy**: Exactly one node must be designated as `"type": "root"` with `"parentId": null`.
- **Connections**: All non-root nodes must reference a valid `parentId` in the same file.
- **Color**: Use a valid 6-digit hex color code (`#rrggbb`).

---

## 📝 Updating Topic Content

Topic explainers are written in Markdown. You can update topic markdown content inside `src/content/topics/` or directly within roadmap node structures.

### Content Best Practices:
- Keep explanations clear, practical, and beginner-friendly.
- Format sections logically using standard Markdown headings (`##`, `###`, bullet lists, code blocks).
- Ensure all resource links use secure `https://` URLs.

---

## 🎨 Coding Guidelines

1. **TypeScript Strictness**: Ensure all TypeScript types are explicitly defined. Avoid using `any` types.
2. **No Underscores in Variables**: Follow clean camelCase naming conventions for variables, functions, and properties.
3. **Professional Comments**: Include concise, meaningful developer comments explaining rationale rather than generic boilerplate.
4. **Validation**: Run `npx astro check` and `npm run build` before opening a pull request.

---

## 🚀 Submitting a Pull Request

1. Create a feature branch off `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Commit your changes with clear, descriptive commit messages:
   ```bash
   git commit -m "feat: add Go developer roadmap"
   ```
3. Push your branch to GitHub:
   ```bash
   git push origin feature/your-feature-name
   ```
4. Open a Pull Request against `mantisdarling/cosmic:main`. Include a clear description of changes made and verification steps performed.

Thank you for contributing to Cosmic!
