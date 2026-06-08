# Quizen — Manual de marca

Versión 1 (2026-06-03). Sprint 12c.

Este documento es la fuente de verdad para identidad visual, voz, y
sistema de diseño de Quizen. Si cambiás colores, tipografía, o
componentes, actualizá este archivo en el mismo commit.

---

## 1. Filosofía

Quizen no compite con un libro. Compite con **distraerte del libro**.
Todo el diseño tiene que respetar esa idea: el contenido del estudiante
es lo principal, la app es el marco.

Reglas no negociables:

1. **El contenido del PDF/quiz/tarjeta domina**. La UI nunca compite por
   atención con el material de estudio.
2. **Calmar, no excitar**. No usamos rojos saturados de notificación, ni
   gradientes vibrantes en el chrome. El rojo solo aparece en errores.
3. **Dark-first**. Estudiar de noche es la norma. Light mode es opcional.
4. **Accesibilidad antes que estética**. Contraste WCAG AA mínimo en
   todos los modos. AAA en `focus` para texto principal.
5. **Sin emoji decorativos**. Solo cuando aportan función (íconos en
   cards de paleta/modo, badges de estado).

---

## 2. Logo

El logo es un gradiente de `--primary` → `--accent` en un cuadrado
`rounded-lg`. Vive en [src/app/page.tsx](src/app/page.tsx) header y en
[src/components/study/theme-picker.tsx](src/components/account/theme-picker.tsx)
como muestra de paleta.

```html
<span
  className="size-7 rounded-lg"
  style={{
    background:
      "linear-gradient(135deg, var(--primary), var(--accent))",
  }}
/>
```

**Variantes**: mono (relleno en `--foreground`) para situaciones donde
no podemos garantizar color (favicon, OG card sin custom render).

**Tamaño mínimo**: 16×16px. Más chico que eso usar `/icons/icon.svg`.

**Clear space**: al menos `0.5×` el tamaño del logo de margen alrededor.

---

## 3. Tipografía

**Sans (UI + texto general)**: [Geist](https://vercel.com/font/sans) —
cargada por `next/font/google` en [layout.tsx](src/app/layout.tsx).

**Mono (código, slugs, datos)**: Geist Mono.

**Heading = Sans**. No cargamos una fuente adicional para títulos. La
diferenciación viene del tamaño + peso, no del cambio de familia.

### Scale

| Token       | Tamaño | Uso                                                |
| ----------- | ------ | -------------------------------------------------- |
| `text-xs`   | 12px   | Metadata, captions, badges                         |
| `text-sm`   | 14px   | Body por defecto en UI compacta                    |
| `text-base` | 16px   | Body en texto largo (chunks de PDF, explicaciones) |
| `text-lg`   | 18px   | Subtítulos de sección, prompts de quiz             |
| `text-xl`   | 20px   | Títulos de tarjeta                                 |
| `text-2xl`  | 24px   | Título de página media                             |
| `text-3xl`  | 30px   | Título principal de página (h1)                    |

**Tracking**: `tracking-tight` en h1/h2. `tracking-wide` en uppercase
labels (`text-xs uppercase`).

**Line height**: `leading-relaxed` (1.625) en texto de estudio. Default
en UI.

---

## 4. Color tokens

### 4.1 Sistema modular

El theming se controla con 3 ejes independientes:

| Atributo HTML          | Valores                                             | Qué controla           |
| ---------------------- | --------------------------------------------------- | ---------------------- |
| `data-palette`         | `teal` (default) / `forest` / `sunset` / `lavender` | Hue principal          |
| `data-mode`            | `focus` (default) / `relax`                         | Saturación + warm tint |
| clase `dark` / `light` | —                                                   | Escala de lightness    |

Todos los color tokens (`--primary`, `--background`, etc.) se derivan
con `oklch(var(--L) var(--C) var(--H))` desde estos 3 ejes. Ver
[src/app/globals.css](src/app/globals.css).

**Por qué OKLCH**: espacio perceptualmente uniforme. Cambiar lightness
no cambia el hue aparente — crítico para que `focus`↔`relax` se sientan
como "el mismo color, distinta intensidad" y no como dos colores
distintos.

### 4.2 Paletas (hues)

| Paleta         | `--hue-primary` | `--hue-accent` | Personalidad                      |
| -------------- | --------------- | -------------- | --------------------------------- |
| Teal (default) | 188             | 145            | Fresco, neutral, profesional      |
| Forest         | 145             | 188            | Naturaleza, sostenido, sereno     |
| Sunset         | 35              | 280            | Cálido, energizante, cercano      |
| Lavender       | 280             | 188            | Calmo, sofisticado, contemplativo |

El accent siempre es el hue complementario "frío" del primary, salvo en
Teal que invierte. Esto da contraste visual sin pelearse con el primary.

### 4.3 Modos

**Focus** (default — para deep work, exámenes, sesiones cortas):

- Saturación alta (`--chroma-primary: 0.14`)
- Tint cool (`--hue-tint-cool: 240`, azul-gris)
- Contraste alto (`--L-fg: 0.97` en dark, `0.18` en light)
- Objetivo: working memory en alerta máxima

**Relax** (para lecturas largas, repasos pasivos):

- Saturación bajada ~35% (`--chroma-primary: 0.09`)
- Tint warm (`--hue-tint-warm: 75`, sepia-cálido)
- Contraste atenuado (`--L-fg: 0.92` en dark, `0.22` en light)
- Objetivo: reducir fatiga ocular en sesiones >30 min

Backed by Sheedy 2003 et al. — warm-biased low-sat surfaces reducen
reported eye strain en lectura prolongada. **Nunca uses relax para
tareas de detalle fino** (corrección de código, datos financieros). El
contraste bajado es deliberado y baja precisión visual.

### 4.4 Brillo

|              | Dark                        | Light                       |
| ------------ | --------------------------- | --------------------------- |
| Background L | 0.14 (focus) / 0.16 (relax) | 0.99 (focus) / 0.97 (relax) |
| Foreground L | 0.97 (focus) / 0.92 (relax) | 0.18 (focus) / 0.22 (relax) |
| Primary L    | 0.74                        | 0.62                        |

Dark es default. Light disponible pero menos pulida — usá dark salvo
preferencia explícita.

### 4.5 Tokens fijos (no cambian por theme)

- `--destructive`: rojo siempre (`oklch(0.7 0.19 22)` dark, `oklch(0.62 0.21 27)` light)
- `--chart-1..5`: hues fijos para que las visualizaciones se reconozcan
  entre sesiones
- Radius: `--radius: 0.625rem` base, escalado con multiplicadores

### 4.6 Contraste (WCAG)

| Combo                  | Texto principal     | Estado                  |
| ---------------------- | ------------------- | ----------------------- |
| Focus Dark             | fg/bg ratio ~14.5:1 | AAA ✓                   |
| Focus Light            | fg/bg ratio ~13:1   | AAA ✓                   |
| Relax Dark             | fg/bg ratio ~10.5:1 | AAA ✓                   |
| Relax Light            | fg/bg ratio ~9:1    | AA ✓ (no AAA)           |
| Primary on bg (todos)  | ~5.5:1+             | AA ✓                    |
| Muted-foreground on bg | ~4.5:1 (límite AA)  | usar solo para metadata |

**No bajar el contraste**. Si necesitás un componente más sutil, usá
opacidad o reducí el tamaño, no atenúes el color.

---

## 5. Spacing y radius

Tailwind 4 default scale. Tokens importantes:

```
gap-1   4px    iconos inline
gap-2   8px    UI compacta
gap-3   12px   default UI
gap-4   16px   secciones internas
gap-6   24px   secciones de página
gap-10  40px   secciones de marketing
```

**Radius**:

```
rounded-sm   = --radius * 0.6  (badges, inputs pequeños)
rounded-md   = --radius * 0.8  (inputs, buttons)
rounded-lg   = --radius        (cards, dialogs)  ← base
rounded-xl   = --radius * 1.4  (cards con énfasis)
rounded-2xl  = --radius * 1.8  (mockups, hero)
rounded-full = circular        (avatars, botones flotantes)
```

---

## 6. Componentes — guidelines

### Button

| Variant             | Cuándo                                                 |
| ------------------- | ------------------------------------------------------ |
| `default` (primary) | Acción principal de la pantalla. Máx 1 por vista.      |
| `outline`           | Acciones secundarias                                   |
| `ghost`             | Acciones terciarias, "cancelar", "volver"              |
| `destructive`       | Solo para eliminación irreversible — confirmar siempre |

### Card

Default container. `bg-card` + `border border-border`. Si necesitás
énfasis, agregá `border-primary/30 bg-primary/5`. Nunca rellenar con
`--primary` puro como background — saturás y cansás.

### Badge

Para metadata, estado, contadores. Nunca para acciones. Variants:

```
outline + border-border + bg-card/40 + text-muted-foreground  ← neutral
outline + border-primary/30 + bg-primary/10 + text-primary    ← activo
outline + border-amber-500/30 + bg-amber-500/10               ← warning
outline + border-destructive/30 + bg-destructive/10           ← error
```

### Dialog vs Bottom Sheet

- **Dialog**: confirmaciones, picker compacto, formularios cortos (<5 fields)
- **Bottom Sheet**: navegación dentro del quiz player (mobile), pickers
  largos

### Toaster (sonner)

Posición `top-right`. `richColors` activo. Usar:

- `toast.success` solo para acciones que valen la pena celebrar (quiz generado, share creado)
- `toast.error` para fallas que el usuario puede accionar
- **No** usar para info — usar inline en la UI

---

## 7. Iconos

[lucide-react](https://lucide.dev/) — único set permitido. Razones:

1. Línea consistente (2px stroke)
2. Cubre todo lo que necesitamos
3. Tree-shakeable
4. Misma altura que el texto en `flex items-center gap-2`

**Tamaños**:

- `size-3` (12px): inline en badges
- `size-4` (16px): default en buttons
- `size-5` (20px): nav items, headers
- `size-6` (24px): empty states, hero icons

**Nunca** mezclar dos sets de iconos. Si lucide no tiene lo que querés,
componé con dos (ej: `Sparkles` + número) o usá texto.

---

## 8. Voz y tono

### Reglas

1. **Segunda persona (vos)**: hablás directo al estudiante. "Generá tu
   quiz" no "el usuario puede generar un quiz".
2. **Imperativo amistoso**: "Empezá Bloque Profundo" no "iniciar sesión
   de estudio".
3. **Sin jerga académica**: "leer activamente" sí, "elaborative
   interrogation" no (eso queda en el código + BRAND.md).
4. **Sin promesas vacías**: nada de "transformá tu estudio para
   siempre". Decimos "este modo combina N técnicas con evidencia".
5. **Errores como copilot, no como sistema**: "No pudimos generar el
   quiz. Probá con un PDF más corto" en vez de "Error 500: generation
   failed".
6. **Confirmaciones cortas**: "Listo, 25 tarjetas generadas." en vez de
   "¡Excelente! Hemos generado exitosamente sus 25 nuevas tarjetas de
   estudio."

### Glosario interno

| Concepto técnico             | Cómo lo decimos           |
| ---------------------------- | ------------------------- |
| Document chunk               | Sección / fragmento       |
| Flashcard                    | Tarjeta                   |
| MCQ / quiz question          | Pregunta                  |
| SRS card / spaced repetition | Repaso (cola de repaso)   |
| Self-explanation             | Explicale a un compañero  |
| Elaborative interrogation    | Elaborar / "¿por qué...?" |
| Retrieval check              | Verificación rápida       |
| Bloom level                  | Nivel cognitivo           |
| Bloom: remember              | Recordar                  |
| Bloom: understand            | Comprender                |
| Bloom: apply                 | Aplicar                   |
| Bloom: analyze               | Analizar                  |
| Bloom: evaluate              | Evaluar                   |
| Bloom: create                | Crear                     |

---

## 9. Accesibilidad

### Mínimos no negociables

1. **Contraste**: WCAG AA (4.5:1 texto normal, 3:1 large) en todos los
   themes. AAA en focus modes.
2. **Foco visible**: `outline-ring/50` por default (configurado en
   `globals.css` base layer). Nunca `outline: none` sin reemplazo.
3. **Touch targets**: mínimo 44×44px en mobile. Opciones de quiz tienen
   `min-h-[56px]` (Sprint 11).
4. **ARIA**: labels en todos los iconos-only buttons (`aria-label`).
   Dialogs con `DialogTitle` y `DialogDescription`. Forms con `<Label>`.
5. **Reduced motion**: `prefers-reduced-motion` respetado por
   `tw-animate-css` defaults. No agregar animaciones que excedan 300ms.
6. **Keyboard**: todo lo clickeable debe ser tabbable. Modales atrapan
   foco (Dialog primitive lo hace).

### Lo que NO hacemos

- Color como único portador de información (errores siempre tienen
  texto + ícono también)
- Texto sobre imagen sin overlay
- Tooltips como única fuente de info crítica
- Fuentes < 14px en UI (12px solo para metadata que se puede ignorar)

---

## 10. Anti-patterns (revisar PRs contra esta lista)

1. ❌ Hardcodear hex colors (`bg-[#14b8a6]`). Usar siempre tokens
   (`bg-primary`).
2. ❌ Agregar otra fuente. La scale actual cubre todo.
3. ❌ Mezclar 2+ paletas en una misma pantalla.
4. ❌ Gradientes en backgrounds extensos (cansa). Solo en el logo y
   ocasionales acentos pequeños (`size-7` máx).
5. ❌ Animations > 300ms en interacciones rutinarias.
6. ❌ Emoji en texto del producto (CTAs, headers). OK en cards del
   theme picker porque son funcionales.
7. ❌ Iconos solo decorativos sin función. Si no aporta, sacalo.
8. ❌ "Confirmá tu acción" modals innecesarios. Solo para destructivos
   o irreversibles.

---

## 11. Cómo agregar un theme nuevo

Si querés agregar una paleta (ej: "Crimson"):

1. Elegí un hue OKLCH (0-360). Probá en
   [oklch.com](https://oklch.com) antes de commitear.
2. En [globals.css](src/app/globals.css), agregá:
   ```css
   [data-palette="crimson"] {
     --hue-primary: 12;
     --hue-accent: 188;
   }
   ```
3. En [src/lib/supabase/types.ts](src/lib/supabase/types.ts), extendé
   `ThemePalette = "teal" | "forest" | "sunset" | "lavender" | "crimson"`
4. En [src/lib/theme.ts](src/lib/theme.ts), agregá la entrada en
   `PALETTES` con nombre, emoji, descripción.
5. Migration: actualizá el CHECK constraint en
   `0007_profile_theme.sql` (crea una nueva migration `0008_*`).
6. Verificá contraste en los 4 combos (focus-dark, focus-light,
   relax-dark, relax-light) con
   [contrast-ratio.com](https://contrast-ratio.com/).
7. Update este archivo (sección 4.2).

---

**Última actualización**: 2026-06-03 (Sprint 12c — sistema de temas
modular OKLCH con 4 paletas × 2 modos × 2 brillos).
