"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

/**
 * Submit button that shows a pending label while the form action is in
 * flight. Tiny client island — the parent form + server action handle
 * the auth logic. If JS hasn't hydrated, the button still submits the
 * form (just without the "Redirigiendo..." label).
 */
export function GoogleSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Redirigiendo..." : "Continuar con Google"}
    </Button>
  );
}
