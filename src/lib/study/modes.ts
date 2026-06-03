/**
 * Study mode configuration. Each mode bundles:
 *   - a time discipline (Pomodoro / Deep Work / no-timer / quick)
 *   - which evidence-based pedagogical steps run
 *
 * Pre-training of key terms (Mayer pre-training principle, d≈0.85) is
 * universal — every mode does it. The optional steps are:
 *   - elaborative interrogation per chunk (d≈0.56)
 *   - self-explanation per chunk + AI grader (g≈0.55)
 *   - retrieval check per chunk
 *   - constructed concept map at the end (g≈0.72)
 *
 * Effect sizes from Dunlosky 2013, Bisra 2018, Schroeder 2018.
 * See research synthesis in the Sprint 12b commit message.
 */

export type StudyMode = "pomodoro" | "deep_work" | "feynman" | "quick_review";

export type StudyModeConfig = {
  id: StudyMode;
  name: string;
  emoji: string;
  description: string;
  audience: string;
  estimatedMinutes: number;
  /** Why this mode works — shown on the picker card to teach the why */
  evidenceNote: string;
  timer: { workMinutes: number; breakMinutes: number } | null;
  steps: {
    preStudy: boolean;
    chunkLoop: boolean;
    elaborativeInterrogation: boolean;
    selfExplanation: boolean;
    retrievalCheck: boolean;
    conceptMap: boolean;
  };
};

export const STUDY_MODES: Record<StudyMode, StudyModeConfig> = {
  pomodoro: {
    id: "pomodoro",
    name: "Pomodoro Clásico",
    emoji: "🍅",
    description: "25 min de foco, 5 min de descanso, en ciclos.",
    audience: "Sesiones de 1 hora, dificultad media, mantener foco.",
    estimatedMinutes: 50,
    evidenceNote:
      "Los bloques cortos con pausas combaten la caída de atención (Cirillo, validado en estudios de productividad).",
    timer: { workMinutes: 25, breakMinutes: 5 },
    steps: {
      preStudy: true,
      chunkLoop: true,
      elaborativeInterrogation: false,
      selfExplanation: false,
      retrievalCheck: true,
      conceptMap: false,
    },
  },
  deep_work: {
    id: "deep_work",
    name: "Bloque Profundo",
    emoji: "🧠",
    description: "50 min sin interrupciones, máximo nivel de procesamiento.",
    audience: "Examen importante, querés dominio real, semana intensa.",
    estimatedMinutes: 75,
    evidenceNote:
      "Combina las técnicas con más evidencia: pre-training (d=0.85), self-explanation (g=0.55) y concept map construido (g=0.72).",
    timer: { workMinutes: 50, breakMinutes: 10 },
    steps: {
      preStudy: true,
      chunkLoop: true,
      elaborativeInterrogation: true,
      selfExplanation: true,
      retrievalCheck: true,
      conceptMap: true,
    },
  },
  feynman: {
    id: "feynman",
    name: "Técnica Feynman",
    emoji: "📝",
    description: "Sin timer. Explicás cada concepto como a un compañero.",
    audience: "Temas conceptuales difíciles, querés profundizar.",
    estimatedMinutes: 45,
    evidenceNote:
      "Self-explanation tiene tamaño de efecto g=0.55 (Bisra 2018). Si no podés explicarlo simple, no lo entendiste.",
    timer: null,
    steps: {
      preStudy: true,
      chunkLoop: true,
      elaborativeInterrogation: false,
      selfExplanation: true,
      retrievalCheck: true,
      conceptMap: false,
    },
  },
  quick_review: {
    id: "quick_review",
    name: "Repaso Rápido",
    emoji: "⚡",
    description: "15-20 min. Solo lo esencial antes de un quiz.",
    audience: "Ya estudiaste antes, querés refrescar.",
    estimatedMinutes: 18,
    evidenceNote:
      "Activar esquema previo (pre-training + advance organizer) mejora la comprensión incluso en sesiones cortas.",
    timer: null,
    steps: {
      preStudy: true,
      chunkLoop: false,
      elaborativeInterrogation: false,
      selfExplanation: false,
      retrievalCheck: false,
      conceptMap: false,
    },
  },
};

export const STUDY_MODE_LIST: StudyModeConfig[] = [
  STUDY_MODES.pomodoro,
  STUDY_MODES.deep_work,
  STUDY_MODES.feynman,
  STUDY_MODES.quick_review,
];
