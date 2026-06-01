import { NextResponse } from "next/server";

/**
 * TEMPORARY debug endpoint — borrar después de diagnosticar el problema
 * de carga de .env. Solo dice si la var está PRESENTE o no, nunca expone
 * el valor (a excepción de los primeros caracteres del URL público).
 */
export const runtime = "nodejs";

export async function GET() {
  const keys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_MODEL",
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_APP_NAME",
  ];

  const result: Record<
    string,
    { present: boolean; length: number; preview: string }
  > = {};

  for (const key of keys) {
    const value = process.env[key];
    result[key] = {
      present: !!value && value.trim().length > 0,
      length: value?.length ?? 0,
      preview: value
        ? key.startsWith("NEXT_PUBLIC_")
          ? value.slice(0, 30) + (value.length > 30 ? "..." : "")
          : `<${value.length} chars hidden>`
        : "<unset>",
    };
  }

  return NextResponse.json(result, { status: 200 });
}
