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

## Estado actual: Sprint 7 — Monetización Stripe

- [x] Sprint 0-5: Fundación + auth + upload + generación + player + grading
- [x] Sprint 6: SM-2 SRS + tutor socrático streaming
- [x] Sprint 7: `lib/billing/plan.ts` con definiciones Free/Pro y `getUserPlan`
- [x] Sprint 7: `POST /api/stripe/checkout` con `client_reference_id` + metadata
- [x] Sprint 7: `POST /api/stripe/portal` para gestión self-service
- [x] Sprint 7: `POST /api/stripe/webhook` con verificación de firma + sync a `subscriptions`
- [x] Sprint 7: Plan gating en `/api/pdf/extract` (docs/mes) y `/api/quiz/generate` (count cap)
- [x] Sprint 7: `/pricing` con tiers Free/Pro + `/library` con plan strip y portal

El producto es **monetizable end-to-end**. Solo falta observabilidad + lanzamiento (Sprint 8).

### Planes

| Plan | Precio | PDFs/mes | Preguntas/quiz |
| ---- | ------ | -------- | -------------- |
| Free | $0     | 3        | 20             |
| Pro  | $9/mes | 30       | 30             |

Free es el default implícito — un usuario sin row en `public.subscriptions` se trata como Free. La row solo se crea cuando el webhook confirma el checkout.

## Setup Stripe

1. Crea un proyecto en [dashboard.stripe.com](https://dashboard.stripe.com) (test mode primero).
2. Crea un Producto "Quizen Pro" con un Price recurring mensual ($9 USD o lo que decidas). Copia el `price_...` ID.
3. Completa en `.env.local`:
   - `STRIPE_SECRET_KEY` (sk*test*... para test)
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk*test*... — reservado para futuras integraciones cliente)
   - `STRIPE_PRICE_ID_PRO_MONTHLY=<price_id>`
4. Para webhooks en local: instala [Stripe CLI](https://stripe.com/docs/stripe-cli) y corre:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Copia el `whsec_...` que imprime a `STRIPE_WEBHOOK_SECRET` en `.env.local`.
5. En producción: agrega el endpoint `<tu-dominio>/api/stripe/webhook` en Stripe Dashboard → Developers → Webhooks, suscríbete a `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`, copia el signing secret.

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
| 7      | Monetización Stripe ✅                                     |
| 8      | E2E tests + observabilidad + lanzamiento                   |

## Historia

Este repo nació como **simulador del examen CACES médico** ([v1.0.0-caces-legacy](https://github.com/Jeancarlosp94/exam-simulator/releases/tag/v1.0.0-caces-legacy)). En mayo 2026 se pivoteó a Quizen, una app de estudio genérica basada en IA. La versión legacy se conserva en el tag y en la rama `master` hasta el lanzamiento de Quizen v1.
