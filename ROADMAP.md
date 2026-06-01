# Quizen — Roadmap post-v1

Estado al **2026-06-01**: producto deployed en Vercel + Gemini + Supabase + PWA + security hardening. Auth, upload, generación, quiz player, SRS, tutor, Stripe (billing) y observabilidad ya están **en master**.

Este documento es la lista de sprints **pendientes** con prompts listos para copiar y pegar cuando quieras avanzar uno. Cada sprint es ~1 semana solo dev (20-30 horas) salvo donde marca otra cosa. No hagas más de uno a la vez — terminá, validá con usuarios reales, después seguí.

---

## Estado actual (qué ya está en master)

- ✅ Sprint 0-8: scaffold, branding, auth, upload PDF, generación con Gemini, quiz player, SRS, tutor, Stripe, CI/CD
- ✅ PWA instalable (manifest + service worker + offline page + iconos)
- ✅ Provider AI switcheable (Gemini default, Anthropic opt-in vía `AI_PROVIDER=anthropic`)
- ✅ Security hardening: page cap, extract timeout, anti-injection heuristic, PDF magic bytes, security headers (CSP, HSTS, X-Frame-Options), Turnstile opcional, RLS en todas las tablas

### Lo que falta para "producto realmente útil"

Tier S (siguiente paso obvio): Sprint 9 + Sprint 10.
Después: Sprint 11 + 12.
Resto: cuando tengas tracción.

---

## 🚀 FASE 1 — Pre-launch hardening

### Sprint 9 — Universal document input (1 sem)

**Goal**: aceptar `.docx`, `.txt`, `.md` además de PDF, más OCR para PDFs escaneados. Esto solo te abre ~60% del mercado real (apuntes universitarios suelen ser escaneados o Word).

**Acceptance**:

- Subir `.docx` genera quiz
- Subir `.txt` o `.md` genera quiz
- Subir un PDF escaneado (sin texto extraíble) corre OCR y genera quiz
- `/upload` UI valida los 4 formatos

**Prompt para arrancar** (cópialo y pégalo cuando quieras ejecutar):

```
Procede con el Sprint 9 — Universal document input.

Implementa:

1. Instalar `mammoth` (parser de .docx) y `tesseract.js` (OCR cliente-side, gratis, ~6MB).

2. Refactorizar el route handler `/api/pdf/extract` a `/api/documents/extract`:
   - Detectar tipo por extensión del `storage_path` (.pdf, .docx, .txt, .md)
   - Router que delega a 4 parsers:
     - `.pdf` → unpdf (existente), si retorna texto vacío → OCR fallback con tesseract
     - `.docx` → mammoth.extractRawText
     - `.txt` y `.md` → buffer.toString("utf-8")
   - Mantener todo el resto del flujo (page cap, timeout, sanity ceiling, anti-injection heuristic, chunk insert) compartido

3. Actualizar `/upload/page.tsx`:
   - accept="application/pdf,.pdf,.docx,.txt,.md"
   - Validación cliente por extensión + 25MB
   - Hint actualizado: "PDF, Word, texto o markdown"

4. Actualizar `/library/page.tsx` para que el badge muestre el tipo de archivo (extensión).

5. Mantener compat con `/api/pdf/extract` (alias) por si hay clientes viejos:
   - Crear un alias `/api/pdf/extract` que re-exporte POST de `/api/documents/extract`

Acceptance: subir cada uno de los 4 formatos genera un quiz. Subir un PDF escaneado (sin texto) automáticamente corre OCR.

Tests: agregar tests unitarios para el router de parser y para detección de extensión.

Commitea con mensaje feat(documents): multi-format input (docx, txt, md) + OCR fallback.
```

---

### Sprint 10 — Crecimiento viral (1 sem)

**Goal**: convertir cada quiz en mecanismo de adquisición. Tipo Kahoot/Quizlet.

**Acceptance**:

- Botón "Compartir" en `/quiz/[id]/results` y `/library` genera link público `/q/<slug>`
- Cualquiera puede abrir el link sin login y completar el quiz (modo demo, sin guardar)
- Al terminar, CTA "Crea cuenta gratis para guardar tu progreso"
- Botón "Regenerar pregunta" en `/results` regenera una sola pregunta
- OG card dinámico con preview en WhatsApp/Twitter

**Prompt para arrancar**:

````
Procede con el Sprint 10 — Crecimiento viral.

Implementa:

1. Nueva migración SQL `supabase/migrations/0004_public_quiz_shares.sql`:
   ```sql
   create table public.public_quiz_shares (
     slug text primary key,
     quiz_id uuid not null references public.quizzes(id) on delete cascade,
     created_by uuid not null references auth.users(id) on delete cascade,
     view_count integer not null default 0,
     expires_at timestamptz,
     created_at timestamptz not null default now()
   );
   create index public_quiz_shares_quiz_id_idx on public.public_quiz_shares(quiz_id);
   alter table public.public_quiz_shares enable row level security;
   -- Owner-only writes
   create policy public_shares_insert_own on public.public_quiz_shares
     for insert with check (auth.uid() = created_by);
   create policy public_shares_delete_own on public.public_quiz_shares
     for delete using (auth.uid() = created_by);
   -- Everyone reads (it's literally a public link)
   create policy public_shares_select_all on public.public_quiz_shares
     for select using (true);
   ```
   Aplicar manualmente en Supabase SQL Editor.

2. Actualizar `src/lib/supabase/types.ts` con la tabla nueva.

3. Endpoint `POST /api/quiz/share`:
   - Auth required
   - Body: { quiz_id }
   - Verifica ownership del quiz
   - Genera slug random 8 chars (nanoid)
   - Inserta row en public_quiz_shares
   - Retorna { slug, url }

4. Ruta pública `/q/[slug]/page.tsx`:
   - Server component, NO requiere auth
   - Carga share por slug (vía service client, no RLS para evitar problemas)
   - Renderiza el quiz en modo demo:
     - Sin auto-save de answers
     - Sin SRS card creation
     - Al terminar, modal "Crea cuenta para guardar"
   - Incrementa view_count en background

5. Componente `<ShareDialog />` para `/quiz/[id]/results`:
   - Botón "Compartir" → POST a /api/quiz/share → muestra link + botón "Copiar"

6. Botón "Regenerar pregunta" en cada pregunta de `/results`:
   - Endpoint `POST /api/quiz/regenerate-question` que recibe { question_id }
   - Llama Gemini con SOLO el chunk de origen + prompt simplificado
   - Reemplaza la pregunta en la BD (mantiene mismo id, cambia prompt/options/correct_label/explanation)
   - Re-renderiza la pregunta sin recargar

7. OG card dinámico en `/q/[slug]/page.tsx` vía `generateMetadata`:
   - Title: "Quiz: <quiz.title> en Quizen"
   - Description: "<question_count> preguntas sobre <document.title>"

Acceptance:
- Compartir → otro usuario abre el link sin login → completa quiz → ve resultados → CTA signup
- Regenerar pregunta → la misma posición ahora tiene contenido distinto
- Compartir el link en WhatsApp muestra el OG card

Commit: feat(viral): public quiz share links + question regeneration.
````

---

### Sprint 11 — Mobile-first overhaul (1 sem)

**Goal**: estudiantes viven en el celular. Hacer la app realmente mobile-first.

**Acceptance**:

- Lighthouse Mobile score >90 en `/`, `/login`, `/pricing`, `/library`
- QuestionGrid es bottom sheet en mobile, no sidebar
- Swipe entre preguntas
- Bottom navigation bar visible siempre (Library / Review / Account)
- App instalable como PWA con prompt nativo

**Prompt para arrancar**:

```
Procede con el Sprint 11 — Mobile-first overhaul.

Implementa:

1. Bottom navigation bar (`src/components/layout/bottom-nav.tsx`):
   - "use client" component
   - 3 items: Biblioteca (/library), Repaso (/review), Cuenta (/account)
   - Visible solo en mobile (sm:hidden)
   - Active state por pathname (useSelectedLayoutSegment)
   - Mount en layout.tsx después del Toaster, solo si el user está logueado (check via cookie en el layout)

2. `/quiz/[id]/quiz-player.tsx` refactor mobile:
   - QuestionGrid: convertir el sidebar de lg en un bottom sheet usando shadcn Sheet o componente custom
   - Botón flotante "📋 N respondidas" abajo a la derecha en mobile que abre el sheet
   - Touch targets de las options: mínimo 56px alto en mobile
   - Swipe horizontal entre preguntas (libreria `react-swipeable` — instalar)

3. `/library` mobile:
   - Cards más altas en mobile (py-5 en vez de py-4)
   - Stack vertical de actions (Jugar + Clock) en pantalla pequeña
   - Compactar plan strip a 1 línea

4. PWA install prompt:
   - Component `<InstallPrompt />` que escucha `beforeinstallprompt`
   - Muestra una pequeña banner abajo (encima del bottom nav) "Instalá Quizen" con botón
   - Persiste dismissal en localStorage (no molestar de nuevo por 14 días)

5. Layout adjustments:
   - layout.tsx: `body` con `pb-16 md:pb-0` para hacer espacio al bottom nav
   - Viewport `maximumScale: 1` ya está, agregar `interactiveWidget: "resizes-content"` para que el teclado no rompa el layout

6. Service worker update:
   - Bump CACHE_NAME a v3
   - Asegurar que precachee también el nuevo bottom nav assets

Acceptance:
- Abrir en celular: bottom nav visible, quiz player con swipe + sheet de navegación, install prompt aparece una vez
- Lighthouse Mobile en /, /login, /pricing, /library >90 en cada métrica

Commit: feat(mobile): bottom nav + sheet question grid + swipe + install prompt.
```

---

## 🎯 FASE 2 — Engagement + monetización

### Sprint 12 — Modo estudio (flashcards) (1 sem)

**Goal**: separar "aprender" de "evaluar". Doblar el tiempo en app.

**Acceptance**:

- Generar ~25 flashcards desde un PDF en `/study/[document_id]`
- Cards integran con SRS (cola compartida con quiz questions)
- UI tipo Anki: voltear card, marcar fácil/medio/difícil

**Prompt para arrancar**:

````
Procede con el Sprint 12 — Modo estudio (flashcards).

Implementa:

1. Migración SQL `supabase/migrations/0005_flashcards.sql`:
   ```sql
   create table public.flashcards (
     id uuid primary key default uuid_generate_v4(),
     user_id uuid not null references auth.users(id) on delete cascade,
     document_id uuid not null references public.documents(id) on delete cascade,
     front text not null,
     back text not null,
     bloom_level text not null check (bloom_level in ('remember','understand','apply','analyze','evaluate','create')),
     source_chunk_id uuid references public.document_chunks(id) on delete set null,
     created_at timestamptz not null default now()
   );
   create index flashcards_user_doc_idx on public.flashcards(user_id, document_id);
   alter table public.flashcards enable row level security;
   create policy flashcards_select_own on public.flashcards
     for select using (auth.uid() = user_id);
   create policy flashcards_insert_own on public.flashcards
     for insert with check (auth.uid() = user_id);
   create policy flashcards_delete_own on public.flashcards
     for delete using (auth.uid() = user_id);

   -- srs_cards ahora soporta cards de quiz Y flashcards. Necesitamos
   -- una columna que diga de cuál tipo viene la card.
   alter table public.srs_cards add column source_type text not null default 'question'
     check (source_type in ('question','flashcard'));
   alter table public.srs_cards add column flashcard_id uuid references public.flashcards(id) on delete cascade;
   alter table public.srs_cards drop constraint if exists srs_cards_user_id_question_id_key;
   create unique index srs_cards_user_question_unique on public.srs_cards(user_id, question_id)
     where source_type = 'question';
   create unique index srs_cards_user_flashcard_unique on public.srs_cards(user_id, flashcard_id)
     where source_type = 'flashcard';
   ```

2. Schema Zod en `src/lib/quiz/schemas.ts`:
   - FlashcardGenerationSchema: { flashcards: [{ front, back, bloom_level, source_chunk_index }] }

3. Provider AI: nuevo método en `QuizGenerator` interface (rename a `AIProvider`?):
   - `generateFlashcards(input)` con prompt distinto (genera cards Q&A, no MCQs)
   - Implementar en Gemini provider, stub en Anthropic provider

4. Route handler `POST /api/flashcards/generate`:
   - Mismo patrón que quiz/generate (auth + rate limit + plan gate + chunk load + LLM call + insert)

5. Páginas:
   - `/study/[document_id]/page.tsx` — server component, lista las flashcards del doc
   - `/study/[document_id]/study-player.tsx` — client component:
     - Una card a la vez
     - Click para voltear (CSS 3D flip)
     - Botones "Otra vez / Difícil / Bien / Fácil" que mapean a SM-2 quality (1, 3, 4, 5)
     - POST /api/review/answer con source_type=flashcard
   - Agregar botón "Generar tarjetas" en `/library` junto al "Generar quiz"

6. /review actualizado para mostrar AMBOS tipos de cards (questions y flashcards) en la misma cola, indicado por badge.

Acceptance:
- Generar 25 cards desde un PDF en <30s
- Estudiar cards → cada una entra a SRS
- /review muestra cards de quiz Y de flashcards mezclados

Commit: feat(study): flashcard mode with SRS integration.
````

---

### Sprint 13 — Retención (streak + email) (1 sem)

**Goal**: que vuelvan al día siguiente.

**Acceptance**:

- Racha visible en `/library` ("🔥 5 días")
- Email diario opcional con cards due
- Métricas DAU/WAU rastreables

**Prompt para arrancar**:

````
Procede con el Sprint 13 — Retención (streak + email reminders).

Implementa:

1. Migración SQL `supabase/migrations/0006_daily_activity.sql`:
   ```sql
   create table public.daily_activity (
     user_id uuid not null references auth.users(id) on delete cascade,
     activity_date date not null,
     reviews_completed integer not null default 0,
     quizzes_completed integer not null default 0,
     primary key (user_id, activity_date)
   );
   create index daily_activity_user_date_idx on public.daily_activity(user_id, activity_date desc);
   alter table public.daily_activity enable row level security;
   create policy daily_activity_select_own on public.daily_activity
     for select using (auth.uid() = user_id);
   -- writes via service role only

   -- Función para calcular streak
   create or replace function public.get_user_streak(p_user_id uuid)
   returns integer language sql stable as $$
     with consecutive_days as (
       select activity_date,
              activity_date - row_number() over (order by activity_date desc)::integer as group_key
       from public.daily_activity
       where user_id = p_user_id and activity_date <= current_date
     )
     select coalesce(count(*), 0)::integer
     from consecutive_days
     where group_key = current_date - row_number() over () + 1
       and activity_date >= current_date - count(*) over () + 1;
   $$;
   ```

2. Helper `src/lib/streak.ts`:
   - `recordActivity(userId, type)` — upsert daily_activity, incrementa contador
   - `getStreak(userId)` — llama a la función SQL

3. Llamar `recordActivity()` en:
   - `/api/quiz/grade` (después de marcar attempt completed)
   - `/api/review/answer` (después de update srs_card)

4. Componente `<StreakBadge />`:
   - Server component que llama a `getStreak(user.id)`
   - Si streak > 0: "🔥 N días"
   - Si streak === 0: nada (no shame)
   - Mount en `/library` header

5. Setting opt-in para email recordatorio:
   - Nueva columna `profiles.email_reminder_enabled boolean default false`
   - Migración: `alter table public.profiles add column email_reminder_enabled boolean not null default false;`
   - Página `/account/page.tsx` (crear) con switch para activar
   - Endpoint POST /api/account/preferences para guardar

6. Cron job en Vercel (vercel.json):
   ```json
   {
     "crons": [
       { "path": "/api/cron/daily-reminders", "schedule": "0 14 * * *" }
     ]
   }
   ```
   - `/api/cron/daily-reminders/route.ts`:
     - Verifica header `Authorization: Bearer <CRON_SECRET>` (env var)
     - Query: users con email_reminder_enabled=true + due cards count > 0
     - Manda email via Resend con count y CTA a /review
     - Truncar a 100 emails por run (Resend free limit)

7. Agregar var `CRON_SECRET` a .env.example.

Acceptance:
- Hacer 1 quiz hoy y 1 mañana → streak = 2
- Activar recordatorios → al día siguiente llega email con count de cards
- /library muestra el streak badge si > 0

Commit: feat(retention): streaks + daily email reminders.
````

---

### Sprint 14 — Monetización avanzada (1 sem)

**Goal**: subir ARPU + bajar churn.

**Acceptance**:

- Annual billing $79 visible en /pricing
- Plan grupal $15/mes para 5 cuentas
- Export quiz a Anki desde /results

**Prompt para arrancar**:

````
Procede con el Sprint 14 — Monetización avanzada.

Implementa:

1. Stripe annual billing:
   - Crear nuevo Price en Stripe Dashboard: $79/año recurring annual
   - Env var: `STRIPE_PRICE_ID_PRO_ANNUAL`
   - `/pricing/page.tsx`: agregar toggle Mensual/Anual encima del Pro card
   - El toggle controla qué price_id se pasa a /api/stripe/checkout
   - Endpoint /api/stripe/checkout: recibe `interval: 'month' | 'year'` y elige el price_id correspondiente

2. Plan grupal:
   - Migración `0007_groups.sql`:
     ```sql
     create table public.groups (
       id uuid primary key default uuid_generate_v4(),
       owner_user_id uuid not null references auth.users(id) on delete cascade,
       name text not null,
       stripe_subscription_id text unique,
       max_members integer not null default 5,
       created_at timestamptz not null default now()
     );
     create table public.group_members (
       group_id uuid not null references public.groups(id) on delete cascade,
       user_id uuid not null references auth.users(id) on delete cascade,
       role text not null default 'member' check (role in ('owner','member')),
       joined_at timestamptz not null default now(),
       primary key (group_id, user_id)
     );
     -- RLS: dueños del grupo pueden todo, miembros pueden leer su grupo
     alter table public.groups enable row level security;
     create policy groups_select_own on public.groups
       for select using (
         auth.uid() = owner_user_id
         or exists (select 1 from public.group_members where group_id = groups.id and user_id = auth.uid())
       );
     -- ...etc
     ```
   - Stripe: crear Price $15/mes con metadata `plan: group`
   - `/api/stripe/checkout`: detectar el tipo de price y crear group si es grupal
   - `getUserPlan()`: ampliar para detectar membresía en grupo activo → plan='pro'
   - UI: sección "Grupo" en /account con lista de miembros + invitar (email)
   - Endpoint /api/groups/invite — envía email vía Resend con link de aceptación
   - Endpoint /api/groups/accept/[token] — agrega user al grupo si cabe

3. Anki export:
   - Botón "Exportar a Anki (.apkg)" en `/quiz/[id]/results` (visible solo si auth)
   - Endpoint `GET /api/quiz/[id]/export-anki`:
     - Verifica ownership
     - Genera un .apkg con cada question como una card (front=prompt, back=correct option + explanation)
     - Librería: `genanki-js` (instalar) o construir manual (es un sqlite zip)
     - Retorna `Content-Type: application/octet-stream`

Acceptance:
- /pricing toggle Mensual/Anual cambia el botón y el price_id
- Crear grupo → invitar 4 → todas pasan a plan pro
- Exportar quiz → .apkg que importa correctamente en Anki Desktop

Commit: feat(billing): annual + group plan + Anki export.
````

---

## 🏗️ FASE 3 — Production-grade

### Sprint 15 — Quality + observabilidad (1 sem)

**Goal**: dejar de operar a ciegas.

**Acceptance**:

- PostHog `track()` real en todas las routes críticas
- Sentry captura errores en producción
- Quality grader baja la tasa de preguntas malas >50%
- `/admin` dashboard básico

**Prompt para arrancar**:

```
Procede con el Sprint 15 — Quality + observabilidad.

Implementa:

1. PostHog tracking real (las helpers ya existen en src/lib/analytics.ts):
   En cada uno de los route handlers, llamar `track()` con properties útiles:
   - `/api/pdf/extract` éxito → track("document.extracted", userId, { file_type, page_count, chunk_count, duration_ms, suspicious })
   - `/api/quiz/generate` éxito → track("quiz.generated", userId, { provider, model, count, difficulty, duration_ms, tokens_input, tokens_output, cached_tokens })
   - `/api/quiz/grade` → track("quiz.completed", userId, { score_pct, time_spent_s, mode })
   - `/api/review/answer` → track("review.completed", userId, { is_correct, ease_after })
   - `/api/stripe/webhook` checkout.completed → track("subscription.activated", userId, { plan })
   - `/api/stripe/webhook` subscription.deleted → track("subscription.canceled", userId)
   - Antes de cada `return NextResponse.json(...)` poner `await flushAnalytics()`.

2. Sentry en route handlers:
   - Crear helper `src/lib/sentry.ts` con `captureRouteError(error, context)` que envuelve `Sentry.captureException`
   - En cada catch block de los route handlers, llamar `captureRouteError(error, { route, userId })`

3. Quality grader (`src/lib/ai/quality-grader.ts`):
   - Función que toma una `GeneratedQuestion` y la evalúa con Gemini Flash (modelo barato)
   - Returns: { quality: 'good' | 'mediocre' | 'bad', reasons: string[] }
   - Prompt: "Evalúa si esta pregunta de quiz tiene distractores plausibles, explicación clara, y bloom_level coherente. Retorna JSON {quality, reasons}."
   - Llamar en /api/quiz/generate DESPUÉS de obtener preguntas de Gemini
   - Filtrar las "bad" antes de persistir (o re-generar ese slot)
   - Métrica: track("question.quality_filter", { kept_count, filtered_count })

4. Admin dashboard `/admin/page.tsx`:
   - Gated por email allowlist: env var `ADMIN_EMAILS=tu@email.com,otro@email.com`
   - Server component que verifica `user.email` está en la lista
   - Métricas básicas (queries directas a Supabase):
     - Signups último 7d, 30d
     - Documents uploaded último 7d
     - Quizzes generated último 7d (con breakdown por provider/model)
     - Avg cost per quiz (calcular desde quizzes.generation_tokens_*)
     - Top usuarios por activity
   - Sin gráficos complicados, tablas simples

5. Página /admin/[user_email]/page.tsx: ver activity de un user específico (debugging).

Acceptance:
- PostHog dashboard muestra el funnel signup → upload → generate → complete
- Trigger un error a propósito → aparece en Sentry
- Quality grader baja "preguntas malas" en >50% (medir antes/después)
- /admin accesible solo para emails en la allowlist

Commit: feat(observability): full event tracking + quality grader + admin dashboard.
```

---

### Sprint 16 — Scale prep (1 sem)

**Goal**: aguantar 1000 usuarios concurrentes.

**Acceptance**:

- `/api/quiz/generate` responde <2s (job en cola)
- Quiz idéntico regenerado retorna instantáneo (cache hit)
- Load test 100 req/s sostenidos sin degradación

**Prompt para arrancar**:

```
Procede con el Sprint 16 — Scale prep.

Implementa:

1. Background jobs con Inngest:
   - Sign up en https://www.inngest.com (free tier)
   - npm install inngest
   - Crear cliente Inngest en src/lib/inngest.ts
   - Definir function `quizGenerationJob`:
     - Trigger: event "quiz.generation.requested"
     - Ejecuta la lógica de generación (mover desde /api/quiz/generate)
   - `/api/quiz/generate`: ahora solo encolea el job y retorna { job_id, status: 'queued' } en <500ms
   - `/library` UI: para quizzes en status "generating", mostrar spinner + polling cada 2s al endpoint /api/quiz/[id]/status
   - Tabla quizzes nueva columna `generation_status text default 'completed'` para nuevos quizzes que arrancan como 'generating'

2. Caching de generación:
   - Migración: tabla `quiz_generation_cache (document_id, params_hash, quiz_id)`
   - En el job, antes de llamar a Gemini, hash de (document_id + count + difficulty + provider + prompt_version)
   - Si ya existe en cache → retornar el quiz cacheado en vez de generar
   - Beneficio: si dos users del mismo grupo regeneran el mismo quiz, segunda vez instantánea

3. DB index audit:
   - Identificar queries N+1 con EXPLAIN ANALYZE en queries de /library, /review
   - Agregar índices compuestos donde haga falta
   - Vacuum + analyze

4. Load test:
   - Instalar k6 (`brew install k6` o equivalente Windows)
   - Script `tests/load/quiz-generation.js` — 100 RPS sostenido por 60s contra el endpoint de generación
   - Documentar resultados en README

Acceptance:
- /api/quiz/generate retorna <500ms (job encolado)
- Job procesa en <90s y marca quiz como completed
- Regenerar quiz idéntico (mismo doc + params) retorna instantáneo
- k6 100 RPS por 60s sin errores

Commit: feat(scale): background jobs + generation cache + load test baseline.
```

---

## 🌍 FASE 4 — Growth plays

Estos son sprints largos (2 semanas cada uno). NO los hagas hasta tener $2k+ MRR y datos reales que justifiquen.

### Sprint 17 — Apps nativas vía Capacitor (2 sem)

**Prompt**:

```
Procede con el Sprint 17 — Apps nativas vía Capacitor.

Implementa:
1. npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
2. npx cap init Quizen com.quizen.app
3. Configurar webDir apuntando al output estático de Next (necesita ajustes — Next.js no es 100% estático, ver https://capacitorjs.com/solution/nextjs)
4. iOS: agregar GoogleService-Info para push notifs si querés notifs nativas
5. Build pipeline en GitHub Actions: workflow que construye .ipa (macOS runner) y .aab (linux + Android SDK)
6. Listings en App Store Connect y Google Play Console
7. Push notifications nativas para SRS daily reminders (en vez de email)
8. Deep linking: tap notif → abre /review

Acceptance: app en TestFlight + Google Play Internal Track. Push notif funciona.
Commit: feat(mobile): native iOS + Android apps via Capacitor.
```

### Sprint 18 — Multiplayer live mode (2 sem)

```
Procede con el Sprint 18 — Multiplayer live mode (Kahoot-style).

Implementa:
1. Supabase Realtime para sync de eventos en tiempo real
2. Tablas: live_sessions, live_participants, live_answers (con realtime enabled)
3. Profesor crea sesión sobre un quiz → genera PIN de 6 dígitos
4. Página `/live/[pin]` para que estudiantes entren sin cuenta (modo demo)
5. Profesor controla el avance (next question)
6. Leaderboard en vivo después de cada pregunta
7. Resultado final con ranking
8. Plan "Instituciones" $200/mes en Stripe para clases >30 personas

Acceptance: 5+ estudiantes entran con PIN, quiz corre sincronizado, leaderboard al final.
Commit: feat(live): real-time multiplayer quiz mode.
```

### Sprint 19 — Plan de estudio AI (2 sem)

```
Procede con el Sprint 19 — Plan de estudio AI generado.

Implementa:
1. Nueva ruta /plan con chat-style intake
2. User: "Tengo examen X el día Y, aquí 3 PDFs + sílabo"
3. Sistema en background:
   - Splitea documentos por capítulo
   - Genera quizzes por capítulo
   - Distribuye revisiones siguiendo SM-2 + curva de Ebbinghaus
   - Crea schedule de 4-6 semanas con tasks diarias
4. Tablas study_plans, study_plan_items
5. Calendario interactivo en /plan/[id]
6. Notificaciones diarias "Hoy: 30 min Bioquímica + 20 min repaso Anatomía"
7. Auto-reprograma si user falla un día

Acceptance: plan de 4 semanas desde 3 PDFs en <60s. Schedule sigue curva de olvido óptima.
Commit: feat(planning): AI-generated study plan with adaptive scheduling.
```

### Sprint 20 — LMS integration (1-2 meses)

```
Procede con el Sprint 20 — LMS integration.

Esto es B2B serio. Antes de empezar, conseguí al menos 1 universidad piloto comprometida.

Implementa:
1. Plugin Canvas LTI 1.3 (estándar de la industria)
2. Plugin Moodle (similar pero diferente API)
3. White-label opcional (custom domain + branding por institución)
4. Pricing institucional: $500-2000/mes según tamaño de la institución
5. Dashboard para profesores: ver progreso de su clase
6. Bulk user provisioning vía API
7. SAML SSO opcional

Acceptance: una universidad piloto usando Quizen integrado a su Canvas/Moodle con 100+ estudiantes.
Commit: feat(institutional): LMS plugins (Canvas + Moodle) with white-label.
```

---

## 🚦 Cómo usar este documento

1. Cuando quieras avanzar un sprint, abrí ROADMAP.md
2. Buscá el sprint que toca
3. **Copiá el prompt completo** entre los triple backticks
4. Pegáselo a Claude (o a mí) en una conversación nueva o continuá esta
5. Yo ejecuto el sprint completo: código + tests + commits
6. Vos verificás en local, después push a Vercel

### Reglas:

- **NO hacer más de 1 sprint a la vez**. Termina, deploya, validá con usuarios reales (aunque sea con 5), después seguís.
- **Cada sprint debe terminar con commit + push a master + redeploy automático en Vercel**.
- Si un sprint introduce migración SQL, **aplicala manualmente en Supabase** antes de probar la feature.
- Después de cada sprint, actualizar la sección "Estado actual" de este archivo marcando lo done.

### Orden recomendado:

1. **Sprint 9** (multi-format + OCR) — sin esto, perdés 60% del mercado
2. **Sprint 10** (share + regen) — sin esto, no crece solo
3. **Sprint 11** (mobile polish) — sin esto, la PWA se siente mediocre
4. Después medí en PostHog qué está pasando real → decidí entre 12 (engagement), 13 (retention), 14 (monetización) basado en data, no en orden de este doc.
5. 15 y 16 cuando tengas tracción real (>100 usuarios activos).
6. 17-20 son grandes apuestas — solo cuando MRR justifique.

---

**Última actualización**: 2026-06-01 (después del deploy a Vercel + security hardening + PWA)
