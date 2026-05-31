---
name: exam-simulator
description: Skill para trabajar sobre el simulador de exámenes médicos CACES (React + Vite + Tailwind + Zustand). Úsalo cuando el usuario diga "exam simulator", "simulador CACES", "banco de preguntas", o pida tocar pantallas de upload/config/exam/results, el cronómetro, el shuffler de preguntas/opciones, el store Zustand, o el formato del JSON de preguntas clínicas (caso_clinico, signos_vitales, laboratorio, imagen_descrita, opciones con label/text, explicacion estructurada con razonamiento/diferencial/por_que_no_las_otras/conducta_según_guias).
---

# Simulador de Exámenes CACES — Guía operativa

App SPA de práctica para el examen **CACES** (Consejo de Aseguramiento de la Calidad de la Educación Superior, Ecuador) en su modalidad médica. Carga un banco JSON local, arma un quiz aleatorio, lo corre con cronómetro y muestra resultados con explicaciones clínicas.

## Stack
- **React 18** + JSX (sin TypeScript)
- **Vite 5** (dev server en `http://localhost:5173`)
- **Tailwind CSS 3** (utility-first, sin componentes propios todavía)
- **Zustand 5** (store global plano, sin slices)
- **gh-pages** para deploy a `https://jeancarlosp94.github.io/exam-simulator/`
- Node scripts: `npm run dev | build | preview | deploy`

## Arquitectura de pantallas (state machine en App.jsx)

Estado `step` en [src/App.jsx](src/App.jsx):
```
upload → config → exam → results
   ↑                        │
   └──── handleRestart ─────┘ (limpia bankQuestions)
              │
       handleRetakeExam → config (limpia selectedQuestions/userAnswers/results)
```

Cada paso es un componente top-level en [src/components/](src/components/):
- [FileUpload.jsx](src/components/FileUpload.jsx) — drag&drop de JSON, valida y guarda en `bankQuestions`
- [ExamConfig.jsx](src/components/ExamConfig.jsx) — 3 modos: `caces` (100 pregs / 160 min), `practice50` (50 / 80), `custom` (N × 1.6 min)
- [ExamSimulator.jsx](src/components/ExamSimulator.jsx) — orquesta Timer + QuestionCard + QuestionGrid, maneja flagged, confirm submit, finalización por tiempo o manual
- [Results.jsx](src/components/Results.jsx) — stats + revisión filtrable (todas/correctas/incorrectas) con explicación clínica estructurada

## Estado global (Zustand)

[src/store/useExamStore.js](src/store/useExamStore.js) — store **plano** (no slices). Acciones:
- `setBankQuestions(qs)` — resetea TODO el estado downstream
- `setSelectedQuestions`, `setConfig`, `setUserAnswer(idx, ans)`, `setResults`
- `resetUserAnswers()`, `resetExamProgress()` — preserva `bankQuestions`

Convención clave: `userAnswers` se indexa por **posición en `selectedQuestions`**, no por `id` de la pregunta. Esto rompe si se reordena después de iniciar el examen.

## Motor de quiz

[src/utils/quizEngine.js](src/utils/quizEngine.js):
- `buildQuiz(bank, count)` — Fisher-Yates sobre el banco + Fisher-Yates sobre `opciones` de cada pregunta seleccionada.
- **OJO**: el shuffle de opciones rompe si `opciones` es array de strings y `correcta` es string que debe coincidir exacto (formato viejo de `example-questions.json`). El código actual de [QuestionCard.jsx](src/components/QuestionCard.jsx) ya asume el formato nuevo `{label, text}` (ver más abajo).

## Cronómetro

[src/hooks/useTimer.js](src/hooks/useTimer.js) — `setInterval` 1s, callbacks vía `useRef` para no recrear el intervalo. Al llegar a 0 dispara `onFinish(0)`. Soporta `stop()` manual. [ExamSimulator.jsx:31-66](src/components/ExamSimulator.jsx#L31-L66) usa un `hasSubmittedRef` para idempotencia (evita doble submit cuando timer + click coinciden).

## Formato del banco JSON (DOS formatos en uso, ojo a la deuda)

### Formato "legacy" — el que está en [example-questions.json](example-questions.json)
```json
{
  "id": 1,
  "tema": "Cardiología",
  "pregunta": "...",
  "opciones": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "correcta": "C) ...",
  "explicacion": "texto plano"
}
```

### Formato "clínico extendido" — el que los componentes **realmente esperan**
Visible en [QuestionCard.jsx](src/components/QuestionCard.jsx) y [Results.jsx](src/components/Results.jsx):
```json
{
  "id": 1,
  "tema": "Cardiología",
  "dificultad": "Alta",
  "caso_clinico": "Paciente de 58 años con ...",
  "signos_vitales": { "PA": "160/95", "FC": "92", "T": "37.1" },
  "laboratorio": "Cr 1.3, K 4.8 ...",
  "imagen_descrita": "ECG con HVI ...",
  "pregunta": "¿Cuál es la conducta inicial?",
  "opciones": [
    { "label": "A", "text": "Iniciar IECA" },
    { "label": "B", "text": "..." }
  ],
  "correcta": "A",
  "explicacion": {
    "razonamiento": "...",
    "diferencial": "...",
    "por_que_no_las_otras": "...",
    "conducta_según_guias": "..."
  }
}
```

**Discrepancia documentada**: el README, `example-questions.json` y FileUpload validan el formato legacy, pero QuestionCard/Results renderizan el formato extendido. **Antes de tocar cualquier flujo de preguntas, confirmar con el usuario qué banco real está usando.** Hay un trabajo pendiente de unificación.

## Comandos frecuentes
```bash
npm run dev       # arranca Vite en :5173
npm run build     # genera dist/
npm run preview   # sirve dist/ local
npm run deploy    # build + gh-pages -d dist (publica a GH Pages)
```

## Cosas a evitar / errores frecuentes
- **No reordenar `selectedQuestions` después de iniciar examen** — `userAnswers` rompe porque indexa por posición, no por `id`.
- **No hacer `setBankQuestions` durante un examen activo** — limpia todo el estado downstream sin confirmación.
- **No asumir un solo formato de pregunta** — siempre validar `Array.isArray(question.opciones[0])` vs `typeof === 'object'` o leer `opcion.label` con defensa.
- **Build a Vite con base correcta** — el deploy a `jeancarlosp94.github.io/exam-simulator/` requiere `base: '/exam-simulator/'` en [vite.config.js](vite.config.js); verificar al cambiar repo o user de GH.
- **No mockear `useTimer` en tests** sin replicar el cleanup del `setInterval`; usa fake timers de Vitest.

## Convenciones de código
- Indentación: 2 espacios (los componentes) / 3 espacios (store y hooks — sí, inconsistente, el repo es así).
- JSX con comillas dobles, JS con comillas simples.
- Tailwind: clases sueltas, sin `clsx`/`cn`. Estados con ternarios largos — no extraerlos a helpers a menos que el componente crezca >300 líneas.
- Iconos: SVG inline (sin lucide-react ni librerías). Si vas a agregar muchos, propón primero usar `lucide-react`.
- Sin tests configurados todavía (no hay Vitest/Jest instalado).

## Despliegue
- GitHub Pages vía `gh-pages` branch. `homepage` en [package.json](package.json) define la base URL.
- No hay backend. Todo es estático. El JSON se carga desde el navegador del usuario, nunca toca un servidor.
