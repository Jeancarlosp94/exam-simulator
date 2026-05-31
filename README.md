# Quizen

> Sube tu PDF. Estudia con calma.

App web que toma cualquier PDF, lo procesa con Claude y genera cuestionarios de estudio con preguntas de distintos niveles de Bloom, calificación automática y feedback formativo.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** estricto
- **Tailwind CSS v4** + shadcn/ui (Sprint 1)
- **Zustand** para estado de sesión activa (Sprint 1)
- **Supabase** — Postgres, Auth (magic link + Google), Storage para PDFs (Sprint 2)
- **Anthropic Claude API** (`claude-opus-4-7`) con prompt caching agresivo (Sprint 4)
- **Stripe** suscripción (Sprint 7)
- **Vercel** hosting

## Estado actual: Sprint 0 — Fundación

- [x] Scaffold Next.js 16 + TS estricto + Tailwind v4 + ESLint flat config
- [x] Prettier + Husky pre-commit + lint-staged
- [x] `.env.example` con todas las claves esperadas
- [x] Estructura base lista para Sprint 1 (branding + componentes reutilizables)

El producto **aún no funciona** — esto es solo el cimiento.

## Desarrollo

```bash
npm install
cp .env.example .env.local   # completar con tus claves
npm run dev                  # http://localhost:3000
```

Scripts disponibles:

- `npm run dev` — servidor de desarrollo con Turbopack
- `npm run build` — build de producción
- `npm run start` — servir build de producción
- `npm run lint` — ESLint
- `npm run format` — Prettier
- `npm run typecheck` — `tsc --noEmit`

## Roadmap

| Sprint | Entregable                                                |
| ------ | --------------------------------------------------------- |
| 0      | Fundación (Next.js + TS + Tailwind + Prettier + Husky) ✅ |
| 1      | Branding Quizen + componentes shadcn reutilizables        |
| 2      | Auth Supabase + schema Postgres + RLS                     |
| 3      | Upload PDF + extracción de texto (`/api/pdf/extract`)     |
| 4      | Generación de quizzes con Claude (`/api/quiz/generate`)   |
| 5      | Quiz player + grading (`/api/quiz/grade`)                 |
| 6      | Tutor adaptativo + repetición espaciada                   |
| 7      | Monetización Stripe                                       |
| 8      | E2E tests + observabilidad + lanzamiento                  |

## Historia

Este repo nació como **simulador del examen CACES médico** ([v1.0.0-caces-legacy](https://github.com/Jeancarlosp94/exam-simulator/releases/tag/v1.0.0-caces-legacy)). En mayo 2026 se pivoteó a Quizen, una app de estudio genérica basada en IA. La versión legacy se conserva en el tag y en la rama `master` hasta el lanzamiento de Quizen v1.
