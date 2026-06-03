/**
 * Study-guide generator backed by Gemini. Separate from the quiz/flashcard
 * generators because the prompts and structured outputs are different —
 * but the same retry-with-backoff pattern applies. The route handlers
 * consume these via the StudyGuideGenerator interface.
 */

import { GoogleGenAI, Type } from "@google/genai";

import { optionalEnv, requireEnv } from "@/lib/env";
import {
  buildAdvanceOrganizerPrompt,
  buildChunkPromptsPrompt,
  buildConceptMapNodesPrompt,
  buildExplanationGraderPrompt,
  buildKeyTermsPrompt,
  STUDY_GUIDE_SYSTEM_PROMPT,
} from "./prompts";
import { OPTION_LABELS } from "@/lib/quiz/schemas";
import type {
  ConceptMapNode,
  KeyTerm,
  RetrievalQuestion,
} from "@/lib/supabase/types";

const DEFAULT_MODEL = "gemini-2.5-flash";

const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1500;

function isTransient(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message ?? "";
  for (const code of TRANSIENT_STATUS_CODES) {
    if (msg.includes(`"code":${code}`)) return true;
  }
  if (/UNAVAILABLE|RESOURCE_EXHAUSTED|DEADLINE_EXCEEDED/i.test(msg))
    return true;
  return false;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export class StudyGuideGenerationError extends Error {
  constructor(message: string) {
    super(`[study-guide] ${message}`);
    this.name = "StudyGuideGenerationError";
  }
}

function getClient() {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const model = optionalEnv("GEMINI_MODEL", DEFAULT_MODEL);
  return { client: new GoogleGenAI({ apiKey }), model };
}

async function generateJson<T>(
  model: string,
  client: GoogleGenAI,
  systemPrompt: string,
  userPrompt: string,
  responseSchema: object,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "user", parts: [{ text: userPrompt }] },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.5,
        },
      });
      const text = response.text;
      if (!text) {
        throw new StudyGuideGenerationError("empty response");
      }
      return JSON.parse(text) as T;
    } catch (err) {
      lastError = err;
      if (err instanceof StudyGuideGenerationError) throw err;
      if (!isTransient(err) || attempt === MAX_RETRIES) {
        const message =
          err instanceof Error ? err.message : "unknown_gemini_error";
        throw new StudyGuideGenerationError(message);
      }
      await sleep(BASE_BACKOFF_MS * 2 ** attempt);
    }
  }
  const message =
    lastError instanceof Error ? lastError.message : "unknown_gemini_error";
  throw new StudyGuideGenerationError(message);
}

export async function generateKeyTerms(
  documentText: string,
): Promise<KeyTerm[]> {
  const { client, model } = getClient();
  const result = await generateJson<{ key_terms: KeyTerm[] }>(
    model,
    client,
    STUDY_GUIDE_SYSTEM_PROMPT,
    buildKeyTermsPrompt(documentText),
    {
      type: Type.OBJECT,
      properties: {
        key_terms: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              term: { type: Type.STRING },
              definition: { type: Type.STRING },
              why_it_matters: { type: Type.STRING },
            },
            required: ["term", "definition", "why_it_matters"],
          },
        },
      },
      required: ["key_terms"],
    },
  );
  return result.key_terms;
}

export async function generateAdvanceOrganizer(
  documentText: string,
): Promise<string> {
  const { client, model } = getClient();
  const result = await generateJson<{ advance_organizer: string }>(
    model,
    client,
    STUDY_GUIDE_SYSTEM_PROMPT,
    buildAdvanceOrganizerPrompt(documentText),
    {
      type: Type.OBJECT,
      properties: { advance_organizer: { type: Type.STRING } },
      required: ["advance_organizer"],
    },
  );
  return result.advance_organizer;
}

export type ChunkPrompts = {
  elaborative_question?: string;
  retrieval_question?: RetrievalQuestion;
};

export async function generateChunkPrompts(
  chunkText: string,
  needs: { elaborativeInterrogation: boolean; retrievalCheck: boolean },
): Promise<ChunkPrompts> {
  if (!needs.elaborativeInterrogation && !needs.retrievalCheck) {
    return {};
  }
  const { client, model } = getClient();
  // Build response schema dynamically based on what was requested.
  const properties: Record<string, object> = {};
  const required: string[] = [];
  if (needs.elaborativeInterrogation) {
    properties.elaborative_question = { type: Type.STRING };
    required.push("elaborative_question");
  }
  if (needs.retrievalCheck) {
    properties.retrieval_question = {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING },
        options: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING, enum: [...OPTION_LABELS] },
              text: { type: Type.STRING },
            },
            required: ["label", "text"],
          },
        },
        correct_label: { type: Type.STRING, enum: [...OPTION_LABELS] },
        explanation: { type: Type.STRING },
      },
      required: ["prompt", "options", "correct_label", "explanation"],
    };
    required.push("retrieval_question");
  }
  return generateJson<ChunkPrompts>(
    model,
    client,
    STUDY_GUIDE_SYSTEM_PROMPT,
    buildChunkPromptsPrompt(chunkText, needs),
    { type: Type.OBJECT, properties, required },
  );
}

export type ExplanationGrade = {
  score: number;
  feedback: string;
};

export async function gradeExplanation(
  chunkText: string,
  studentExplanation: string,
): Promise<ExplanationGrade> {
  const { client, model } = getClient();
  return generateJson<ExplanationGrade>(
    model,
    client,
    STUDY_GUIDE_SYSTEM_PROMPT,
    buildExplanationGraderPrompt(chunkText, studentExplanation),
    {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.INTEGER },
        feedback: { type: Type.STRING },
      },
      required: ["score", "feedback"],
    },
  );
}

export async function generateConceptMapNodes(
  documentText: string,
): Promise<ConceptMapNode[]> {
  const { client, model } = getClient();
  const result = await generateJson<{ nodes: ConceptMapNode[] }>(
    model,
    client,
    STUDY_GUIDE_SYSTEM_PROMPT,
    buildConceptMapNodesPrompt(documentText),
    {
      type: Type.OBJECT,
      properties: {
        nodes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
            },
            required: ["id", "label"],
          },
        },
      },
      required: ["nodes"],
    },
  );
  return result.nodes;
}
