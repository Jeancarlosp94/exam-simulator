# Quizen — Security Posture

Última auditoría: 2026-06-08.

Este documento lista las defensas que tiene la app en producción. Si
agregás una ruta nueva, asegurate que cumpla la checklist del final.

---

## Defensas activas

### Autenticación

- **Google OAuth únicamente** vía Supabase Auth (`supabase.auth.signInWithOAuth`)
- **PKCE flow** (Proof Key for Code Exchange) — el server-side handler en
  `/auth/callback` intercambia el code con el verifier guardado en cookie
  (HttpOnly, SameSite=Lax)
- **Server Action en /login** — el botón Google funciona sin JS, sin
  depender de hidratación. Mitigación importante para iPhone Safari y
  redes lentas
- **OAuth consent screen publicado** (no más en "Testing" mode)
- **No magic-link**: eliminamos email auth + Resend para reducir
  superficie de ataque
- **`safeNext()` en /auth/callback** — el parámetro `next` se valida
  contra open redirects (rechaza `//evil.com`, URLs absolutas, etc.)

### Autorización (per-resource ownership)

Cada ruta autenticada que toca un recurso verifica ownership server-side
con `service.from(...).select(...).eq("user_id", user.id)`:

| Ruta                              | Verifica ownership de |
| --------------------------------- | --------------------- |
| `/api/documents/extract`          | document.user_id      |
| `/api/flashcards/generate`        | document.user_id      |
| `/api/quiz/generate`              | document.user_id      |
| `/api/quiz/grade`                 | attempt.user_id       |
| `/api/quiz/regenerate-question`   | quiz.user_id          |
| `/api/quiz/share`                 | quiz.user_id          |
| `/api/review/answer`              | card.user_id          |
| `/api/study/start`                | document.user_id      |
| `/api/study/session/[id]/advance` | session.user_id       |
| `/api/tutor/chat`                 | quiz.user_id          |

No se confía en RLS como única defensa — las RPC calls que usan el
service client bypassean RLS, así que la ownership check es explícita.

### Rate limiting (todas las rutas)

`src/lib/rate-limit.ts` con **fallback in-memory garantizado** cuando
Upstash no está configurado. Antes el modo sin Upstash era permisivo
(unbounded); ahora siempre limita.

| Ruta                                      | Límite            |
| ----------------------------------------- | ----------------- |
| `/api/quiz/generate`                      | 5 / hour / user   |
| `/api/flashcards/generate`                | 5 / hour / user   |
| `/api/study/start`                        | 10 / hour / user  |
| `/api/quiz/regenerate-question`           | 15 / hour / user  |
| `/api/documents/extract`                  | 10 / hour / user  |
| `/api/tutor/chat`                         | 30 / hour / user  |
| `/api/quiz/share`                         | 30 / hour / user  |
| `/api/study/session/[id]/advance`         | 300 / hour / user |
| `/api/review/answer`                      | 200 / hour / user |
| `/api/quiz/grade`                         | 60 / hour / user  |
| `/api/profile/theme`                      | 60 / hour / user  |
| `/api/account/push-subscription` (POST)   | 20 / hour / user  |
| `/api/account/push-subscription` (DELETE) | 20 / hour / user  |
| `/api/stripe/checkout`                    | 10 / hour / user  |
| `/api/stripe/portal`                      | 10 / hour / user  |

Webhook (Stripe) y cron no necesitan user-level rate limit — están
gated por signature / shared secret.

**Recomendación de producción**: setear `UPSTASH_REDIS_REST_URL` y
`UPSTASH_REDIS_REST_TOKEN` en Vercel para tener rate limiting
distribuido cross-instance. Free tier de Upstash es suficiente.

### Input validation

- **Zod schemas** en cada body de POST (uuid checks, enum checks, length
  bounds)
- **Body size cap helper** disponible en `src/lib/guard.ts` →
  `readJsonBody(request, maxBytes)`. Default 32 KB. Aplicar a rutas
  futuras que acepten payloads grandes
- **PDF magic bytes** verificados antes de extract (`src/lib/documents/parsers/pdf.ts`)
- **File size cap server-side** (25 MB) en `/api/documents/extract`
- **Page count cap** (200) antes de extractText, evita PDFs bombing
- **Extract timeout** (45s) por unpdf race
- **Sanity ceiling** (1M chars) sobre texto extraído

### Prompt injection

- **System prompts versionados** y endurecidos contra jailbreak
  (`src/lib/quiz/prompts.ts`, `tutor-prompts.ts`, `study/prompts.ts`,
  `flashcard-prompts.ts`)
- **`<document>`, `<chunk>`, `<student_message>` tags** delimitan input
  no confiable
- **Detección heurística** de patrones de jailbreak + invisible chars en
  PDFs (`src/lib/pdf/suspicious.ts`) — chunks sospechosos llevan un
  banner `SUSPICIOUS_CONTENT_WARNING` que el LLM ve en cada call
- **`wrapStudentMessage()`** en tutor: trunca a 2000 chars + envuelve en
  `<student_message>` con re-anchor instructions

### Pago / Stripe

- **Webhook signature verification** con `stripe.webhooks.constructEvent`
  contra el raw body (no parseado primero)
- **Service-role writes** en `subscriptions` — RLS solo permite SELECT al
  owner, INSERT/UPDATE solo via webhook
- **`user_id` en `subscription_data.metadata` Y `client_reference_id`**
  para que el webhook nunca pierda el link al user de Quizen
- **Log de invalid_signature** cuando alguien intenta forjar webhook

### Push notifications

- **VAPID keys** (auto-generadas con `npx web-push generate-vapid-keys`)
  — public expuesta al cliente, private solo server-side
- **Subscription endpoint con auth + rate limit** (20/h cada uno)
- **Auto-cleanup** de subscriptions muertas (404/410) en cada cron run

### Cron job

- **CRON_SECRET** verificación: `Authorization: Bearer <secret>`.
  Vercel Cron lo envía automáticamente cuando la env var está set
- **Log de unauthorized** + log de WARN si CRON_SECRET no está
  configurado (ruta pública)
- **MAX_SENDS_PER_RUN = 500** para evitar runaway

### HTTP / network

- **CSP estricto** (`next.config.ts`): default-src 'self', whitelist por
  servicio (Supabase, Anthropic, Gemini, Stripe, Sentry, PostHog)
- **HSTS**: max-age 2 años + includeSubDomains + preload
- **X-Frame-Options: DENY** — no embedding en iframes
- **X-Content-Type-Options: nosniff**
- **Referrer-Policy: strict-origin-when-cross-origin**
- **Permissions-Policy** denegando camera/microphone/geolocation/FLoC

### Storage (Supabase)

- **Storage path prefix = `user.id`** (enforzado por Storage policy y
  por la insert en /upload)
- **Service role** desde /api/documents/extract para download —
  igualmente verifica ownership del document row antes de bajar el file

### Database (Supabase RLS)

- **RLS enabled** en todas las tablas (`0002_rls_policies.sql`)
- **Default-deny** + policies explícitas per (select, insert, update,
  delete)
- **Joins via parent ownership** (document_chunks → documents,
  questions → quizzes, answers → attempts)
- **Server-only tables** (subscriptions, daily_activity) sin policy de
  insert/update — solo service role escribe

---

## Security event logging

`src/lib/guard.ts` exporta `logSecurityEvent()` que escribe un JSON
estructurado a stdout (visible en Vercel Logs). Eventos:

- `rate_limit_hit` — alguien pegó el límite
- `auth_failed` — request sin auth válida a ruta autenticada
- `ownership_failed` — user intentó acceder a recurso ajeno
- `body_too_large` — body superó el cap configurado
- `invalid_signature` — webhook con firma rota (probable forge attempt)
- `suspicious_input` — input que disparó heurísticas anti-injection

Cuando wires Sentry o PostHog en el futuro, hookealos en esta función.

---

## Checklist para rutas nuevas

Antes de mergear una nueva `/api/.../route.ts`:

1. [ ] `await supabase.auth.getUser()` — si la ruta no es pública
2. [ ] `checkRateLimit({ prefix, requests, window }, user.id)` — siempre
3. [ ] Body validado con Zod schema (no aceptar `any` o `unknown`
       directo en la lógica)
4. [ ] Si toca un recurso, ownership check explícita
       (`if (resource.user_id !== user.id) return 403`)
5. [ ] Writes solo con `getSupabaseServiceClient()` cuando sea necesario
       (preferir el client server normal si RLS lo permite)
6. [ ] `logSecurityEvent` en los fallos de seguridad (auth, ownership,
       firma)
7. [ ] Considerá body-size cap con `readJsonBody(request, maxBytes)` si
       el payload puede ser grande

---

## Reportar una vulnerabilidad

Si encontrás una vuln, NO la abras como issue público. Email directo a
[tu-email].

---

**Recomendaciones pendientes** (no críticas):

- [ ] Configurar Upstash Redis (rate limit distribuido)
- [ ] Configurar Sentry para alertas de errores
- [ ] Tener Privacy + Terms públicos
- [ ] Custom domain con HTTPS (mejora trust + OAuth verification path)
- [ ] Penetration test antes de público >100 users
