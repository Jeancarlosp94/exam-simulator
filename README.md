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

## Estado actual: Sprint 6 — Tutor adaptativo + repetición espaciada

- [x] Sprint 0: Scaffold Next.js 16 + TS estricto + Tailwind v4 + ESLint
- [x] Sprint 0: Prettier + Husky pre-commit + lint-staged
- [x] Sprint 1: Branding Quizen + shadcn/ui + componentes porteados
- [x] Sprint 2: Auth Supabase (magic link + Google) + schema + RLS + Storage
- [x] Sprint 3: Upload PDF + `/api/pdf/extract`
- [x] Sprint 4: `POST /api/quiz/generate` (claude-opus-4-7 + adaptive thinking + caching)
- [x] Sprint 5: Quiz player + `/api/quiz/grade` + página de resultados
- [x] Sprint 6: SM-2 puro en `lib/srs/sm2.ts` + tests-friendly (recibe `now`)
- [x] Sprint 6: `/api/quiz/grade` ahora upserta cards SRS (correct→quality 5, incorrect→1)
- [x] Sprint 6: `POST /api/tutor/chat` streaming socrático con prompt caching del contexto
- [x] Sprint 6: `TutorDialog` con chat streaming en `/quiz/[id]/results` (preguntas incorrectas)
- [x] Sprint 6: `/review` con cola de cards due + `ReviewPlayer` + `POST /api/review/answer`
- [x] Sprint 6: Callout "Repaso pendiente" en `/library` con count de cards due

El producto tiene el **loop completo de retención**: estudias, fallas, repasas, retienes. Próximo: Stripe (Sprint 7).

## Setup Supabase

1. Crea un proyecto en [supabase.com/dashboard](https://supabase.com/dashboard).
2. Copia `.env.example` a `.env.local` y completa:
   - `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API)
   - `SUPABASE_SERVICE_ROLE_KEY` (mismo lugar; NUNCA expongas esto al cliente)
3. Aplica las migraciones de [supabase/migrations/](supabase/migrations/). Dos opciones:
   - **Dashboard**: pega el contenido de cada archivo en SQL Editor en orden numérico
   - **Supabase CLI**: `supabase link --project-ref <ref> && supabase db push`
4. **Habilita el provider de Google** en Authentication → Providers → Google
   (necesitas un OAuth client ID/secret en Google Cloud Console; redirect URI:
   `https://<tu-proyecto>.supabase.co/auth/v1/callback`).
5. **Configura el SMTP de magic links** en Authentication → SMTP Settings.
   Recomendado: Resend (`smtp.resend.com:587`, usuario `resend`, password = API key).
   El email default de Supabase tiene rate limit estricto y no sirve en producción.
6. Verifica RLS con el inspector de Supabase (Database → Policies).
   Cada tabla debe mostrar "Row Level Security: enabled" y al menos una policy por operación.

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

| Sprint | Entregable                                                 |
| ------ | ---------------------------------------------------------- |
| 0      | Fundación (Next.js + TS + Tailwind + Prettier + Husky) ✅  |
| 1      | Branding Quizen + componentes shadcn reutilizables ✅      |
| 2      | Auth Supabase + schema Postgres + RLS ✅                   |
| 3      | Upload PDF + extracción de texto (`/api/pdf/extract`) ✅   |
| 4      | Generación de quizzes con Claude (`/api/quiz/generate`) ✅ |
| 5      | Quiz player + grading (`/api/quiz/grade`) ✅               |
| 6      | Tutor adaptativo + repetición espaciada ✅                 |
| 7      | Monetización Stripe                                        |
| 8      | E2E tests + observabilidad + lanzamiento                   |

## Historia

Este repo nació como **simulador del examen CACES médico** ([v1.0.0-caces-legacy](https://github.com/Jeancarlosp94/exam-simulator/releases/tag/v1.0.0-caces-legacy)). En mayo 2026 se pivoteó a Quizen, una app de estudio genérica basada en IA. La versión legacy se conserva en el tag y en la rama `master` hasta el lanzamiento de Quizen v1.
