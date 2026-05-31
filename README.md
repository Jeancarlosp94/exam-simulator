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

## Estado actual: Sprint 8 — E2E tests + observabilidad + lanzamiento ✅

Todos los sprints del roadmap completados. Quizen está listo para lanzar.

- [x] Sprint 0-5: Fundación + auth + upload + generación + player + grading
- [x] Sprint 6: SM-2 SRS + tutor socrático streaming
- [x] Sprint 7: Stripe (checkout + portal + webhook) + plan gating
- [x] Sprint 8: Vitest config + tests para SM-2 y chunker (17 tests, todos verdes)
- [x] Sprint 8: Playwright config + smoke specs (landing/login/pricing + auth gates)
- [x] Sprint 8: GitHub Actions CI (format + lint + typecheck + unit tests + build)
- [x] Sprint 8: Sentry (browser + server + edge) con `instrumentation.ts`
- [x] Sprint 8: PostHog `analytics.ts` server-side con `track()` + `flushAnalytics()`
- [x] Sprint 8: SEO — `sitemap.ts`, `robots.ts`, OpenGraph + Twitter Cards

**Stack runtime**: ver checklist abajo.

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
   - `STRIPE_SECRET_KEY` (formato `sk_test_...` en test mode)
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (formato `pk_test_...` — reservado para futuras integraciones cliente)
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
- `npm test` — Vitest (unit tests, ~17 tests, <500ms)
- `npm run test:watch` — Vitest en watch mode
- `npm run test:e2e` — Playwright (requiere `npx playwright install chromium` y `npm run dev` corriendo)

## Despliegue a producción

### 1. Vercel

```bash
npm i -g vercel
vercel link            # vincula el repo al proyecto
vercel env pull        # opcional: trae las env vars del proyecto
vercel --prod          # deploy
```

Hosting recomendado por razones técnicas concretas:

- Soporte nativo de Next.js 16 + App Router + Turbopack.
- Edge functions para el `proxy.ts` de Supabase auth refresh.
- Body limits configurables para `/api/quiz/generate` (necesita ~30s).
- `maxDuration` por route handler honrado del plan Pro en adelante.

### 2. Variables de entorno en producción

Configura en Vercel → Project Settings → Environment Variables (todas como **Production** + **Preview**):

| Variable                             | Origen                                                              |
| ------------------------------------ | ------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`           | Supabase Project Settings → API                                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | Supabase Project Settings → API                                     |
| `SUPABASE_SERVICE_ROLE_KEY`          | Supabase Project Settings → API (server-only)                       |
| `ANTHROPIC_API_KEY`                  | console.anthropic.com/settings/keys                                 |
| `ANTHROPIC_MODEL`                    | `claude-opus-4-7` (override solo si quieres cambiar a Sonnet/Haiku) |
| `STRIPE_SECRET_KEY`                  | Stripe Dashboard → Developers → API keys (live mode)                |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe live publishable                                             |
| `STRIPE_WEBHOOK_SECRET`              | Generado al crear el endpoint en Stripe Dashboard                   |
| `STRIPE_PRICE_ID_PRO_MONTHLY`        | El `price_...` del producto Pro en live mode                        |
| `UPSTASH_REDIS_REST_URL`             | console.upstash.com — para rate limiting real                       |
| `UPSTASH_REDIS_REST_TOKEN`           | mismo lugar                                                         |
| `NEXT_PUBLIC_APP_URL`                | Tu dominio de producción (e.g. `https://quizen.app`)                |
| `RESEND_API_KEY`                     | Para SMTP de magic links de Supabase                                |
| `NEXT_PUBLIC_SENTRY_DSN`             | sentry.io — opcional, captura solo si está seteado                  |
| `SENTRY_DSN`                         | Sentry server DSN (puede ser el mismo que el browser)               |
| `POSTHOG_KEY`                        | posthog.com — opcional                                              |
| `NEXT_PUBLIC_POSTHOG_HOST`           | `https://us.i.posthog.com` (o `eu.i.posthog.com`)                   |

### 3. Stripe webhook en producción

1. Dashboard de Stripe → Developers → Webhooks → Add endpoint
2. URL: `https://<tu-dominio>/api/stripe/webhook`
3. Eventos a suscribir:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copia el `whsec_...` → `STRIPE_WEBHOOK_SECRET` en Vercel.

### 4. Pre-launch checklist

- [ ] Supabase: las 3 migraciones aplicadas en producción
- [ ] Supabase: Google OAuth configurado con redirect URI correcto
- [ ] Supabase: SMTP de Resend configurado en Auth → SMTP
- [ ] Supabase: verificar RLS habilitada en TODAS las tablas (`select * from pg_tables where rls_enabled = false and schemaname = 'public'` debe estar vacío)
- [ ] Supabase: bucket `documents` privado (Storage → documents → Settings → Public = OFF)
- [ ] Stripe: producto Pro creado en LIVE mode (no test)
- [ ] Stripe: webhook endpoint registrado con los 4 eventos
- [ ] Anthropic: saldo suficiente en la cuenta (~$50 cubre ~50 usuarios activos un mes)
- [ ] Vercel: dominio custom apuntando + SSL activo
- [ ] Vercel: todas las env vars en Production
- [ ] Sentry: proyecto creado, DSN configurado (opcional pero recomendado)
- [ ] PostHog: workspace creado, key configurada (opcional)
- [ ] DNS: redirect de `www.` a apex (o viceversa)
- [ ] Probar el flujo end-to-end con un usuario real
- [ ] Probar checkout con tarjeta real ($9 → cancelar inmediatamente desde portal)
- [ ] Verificar que el rate limit de `/api/pdf/extract` y `/api/quiz/generate` funciona (Upstash dashboard)
- [ ] Términos de uso + Política de privacidad publicados (no incluidos en este repo — son legales, no técnicos)

### 5. Observabilidad

- **Errores**: Sentry captura unhandled errors browser + server. Configurado con sample rate 10% para perf traces, 100% replays-on-error.
- **Eventos**: PostHog `track()` se llama desde route handlers (`signed_up`, `document.uploaded`, `quiz.generated`, etc.). Llama `flushAnalytics()` antes de retornar en route handlers críticos para no perder eventos.
- **Tokens Anthropic**: cada quiz guarda `generation_tokens_input/output/cached` en `public.quizzes`. Query para ver costo aproximado:
  ```sql
  SELECT
    date_trunc('day', created_at) AS day,
    SUM(generation_tokens_input) * 5.0 / 1e6 AS input_cost_usd,
    SUM(generation_tokens_output) * 25.0 / 1e6 AS output_cost_usd,
    SUM(generation_cached_tokens) * 0.5 / 1e6 AS cached_cost_usd
  FROM quizzes
  WHERE generation_model = 'claude-opus-4-7'
  GROUP BY 1 ORDER BY 1 DESC;
  ```

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
| 8      | E2E tests + observabilidad + lanzamiento ✅                |

## Historia

Este repo nació como **simulador del examen CACES médico** ([v1.0.0-caces-legacy](https://github.com/Jeancarlosp94/exam-simulator/releases/tag/v1.0.0-caces-legacy)). En mayo 2026 se pivoteó a Quizen, una app de estudio genérica basada en IA. La versión legacy se conserva en el tag y en la rama `master` hasta el lanzamiento de Quizen v1.
