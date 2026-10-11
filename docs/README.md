# docs/ — Project documentation

This directory is the long-form reference for the portfolio. Start here if
you are onboarding an agent or contributing to the codebase.

| Doc                          | Scope                                                              |
| ---------------------------- | ------------------------------------------------------------------ |
| [architecture.md](./architecture.md) | Directory layout, data flow, server vs client boundaries. |
| [design-system.md](./design-system.md) | "Terminal de campo" palette, type, motion, a11y.     |
| [map.md](./map.md)                   | MapLibre style, basemap, fallback, data swap.          |
| [assets.md](./assets.md)             | `sync-assets.mjs` and the `AssetImage` placeholder.   |
| [AGENTS.md](./AGENTS.md)             | Conventions for AI agents editing this project.        |

## TL;DR for the AI agent

- **Read `node_modules/next/dist/docs/`** before touching any framework-level
  code (it's Next.js 16, breaking changes are real).
- **Copy lives in `src/data/*.ts`.** Never hard-code bio / metric / project
  text in JSX.
- **MapLibre canvas is client-only and mount-gated** in
  `src/components/map/map-sandbox.tsx` — do not change this to
  `next/dynamic({ ssr:false })` from a server boundary.
- **Two ESLint rules are the long poll**: text-node comments must be
  `{"// foo"}` (not bare `// foo`), and `setState` inside effects must come
  from an external-system callback rather than synchronously.
- **Asset placeholders are not nice-to-have**: they keep the page legible
  while the real CV / project previews / OG card are still missing. Drop the
  file, run `npm run dev`, and the placeholder disappears.
