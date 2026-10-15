<p align="center">
  <img src="public/assets/readme-banner.svg" alt="ReceiptRecall — Your receipts. A better memory." width="800" />
</p>

# ReceiptRecall

**Your receipts. A better memory.**

Turn photographed grocery receipts into a corrected, saved purchase history with unit-price comparison. Private, local-first, open weights.

<p align="center">
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js 16" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 5" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4" /></a>
  <a href="https://www.sqlite.org/"><img src="https://img.shields.io/badge/SQLite-better--sqlite3-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" /></a>
  <a href="https://github.com/ollama/ollama"><img src="https://img.shields.io/badge/Ollama-gemma3%3A1b-000000?style=for-the-badge&logo=ollama&logoColor=white" alt="Ollama" /></a>
  <a href="https://zod.dev/"><img src="https://img.shields.io/badge/Zod_4-3E67B1?style=for-the-badge&logo=zod&logoColor=white" alt="Zod" /></a>
  <a href="https://sharp.pixelplumbing.com/"><img src="https://img.shields.io/badge/sharp-0.35-000000?style=for-the-badge&logo=sharp&logoColor=white" alt="sharp" /></a>
  <a href="https://vitest.dev/"><img src="https://img.shields.io/badge/Vitest_5-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest" /></a>
  <a href="https://playwright.dev/"><img src="https://img.shields.io/badge/Playwright_1.64-2EAD33?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright" /></a>
</p>

---

## Quick Start

```bash
# Install dependencies
npm install

# Copy env and adjust if needed
cp .env.example .env.local

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript compiler check |
| `npm test` | Run Vitest unit tests |
| `npm run test:e2e` | Run Playwright E2E tests |

## Architecture

```
Phone/browser ──HTTPS──> Caddy (TLS + basic auth) ──> Next.js :3000 ──> Tesseract CLI (OCR)
                                                             │
                                                             ├──> SQLite file  (data/receipts.sqlite)
                                                             ├──> images       (data/images/<uuid>.png)
                                                             └──> Ollama :11434 (gemma3:1b)   [server-only]
```

- One Linux VPS runs all of it via Docker Compose.
- Nothing but Caddy exposes a host port.
- Receipt images live **outside** `public/`, served only through the protected image route.
- `data/` and `.env*` are git-ignored.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages & API routes
├── components/             # React components
├── lib/                    # Server-only utilities (DB, OCR, calculations, extraction)
└── ...
data/
├── images/                 # Normalized receipt PNGs (git-ignored)
└── receipts.sqlite         # SQLite database (git-ignored)
public/
├── assets/                 # Brand assets (readme-banner.svg)
├── favicon.ico
├── icon.svg
├── apple-icon.png
├── icon-192.png
├── icon-512.png
└── site.webmanifest
tests/
├── fixtures/               # Test fixtures
└── ...                     # Vitest & Playwright tests
```

## Deployment

Production deployment config (Phase 6) — `Dockerfile`, `compose.yaml`, `Caddyfile` not yet added.

## License

MIT — see `LICENSE` for details.