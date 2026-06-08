"use client";

import { useState } from "react";
import { toast } from "sonner";

import { applyThemeToDom } from "@/components/layout/theme-script";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BRIGHTNESS_OPTIONS, MODES, PALETTES } from "@/lib/theme";
import type {
  ThemeBrightness,
  ThemeMode,
  ThemePalette,
  ThemeSettings,
} from "@/lib/supabase/types";

type Props = {
  initial: ThemeSettings;
};

/**
 * Theme picker — three independent dimensions. Changes apply instantly
 * to <html> via data-attrs + class, and the cookie updates so the next
 * page nav (SSR) keeps the choice. The server mirror happens in the
 * background via POST /api/profile/theme.
 */
export function ThemePicker({ initial }: Props) {
  const [theme, setTheme] = useState<ThemeSettings>(initial);
  const [pending, setPending] = useState(false);

  async function commit(next: ThemeSettings) {
    setTheme(next);
    applyThemeToDom(next);
    setPending(true);
    try {
      const res = await fetch("/api/profile/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        // The migration adds the theme_settings column; if it isn't
        // applied, the update fails with a Postgres "column does not
        // exist" error. Surface that so the dev knows what to do.
        const detail = payload.detail ?? payload.error ?? "";
        if (/theme_settings|column|relation/i.test(detail)) {
          toast.error(
            "Falta aplicar la migración 0007 en Supabase. El tema se ve igual pero no persiste entre dispositivos.",
            { duration: 6000 },
          );
        } else {
          toast.error(
            "No pudimos guardar en el servidor. Igual la ves aplicada localmente.",
          );
        }
      }
    } catch {
      // Cookie + DOM already updated; persistence is best-effort.
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PickerSection title="Paleta">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {PALETTES.map((p) => (
            <SwatchButton
              key={p.id}
              active={theme.palette === p.id}
              disabled={pending}
              onClick={() => void commit({ ...theme, palette: p.id })}
              palette={p.id}
              brightness={theme.brightness}
              mode={theme.mode}
              label={`${p.emoji} ${p.name}`}
              description={p.description}
            />
          ))}
        </div>
      </PickerSection>

      <PickerSection title="Modo">
        <div className="grid grid-cols-2 gap-2">
          {MODES.map((m) => (
            <ModeButton
              key={m.id}
              active={theme.mode === m.id}
              disabled={pending}
              onClick={() => void commit({ ...theme, mode: m.id })}
              label={`${m.emoji} ${m.name}`}
              description={m.description}
            />
          ))}
        </div>
      </PickerSection>

      <PickerSection title="Brillo">
        <div className="grid grid-cols-2 gap-2">
          {BRIGHTNESS_OPTIONS.map((b) => (
            <button
              key={b.id}
              type="button"
              disabled={pending}
              onClick={() => void commit({ ...theme, brightness: b.id })}
              className={cn(
                "rounded-lg border p-3 text-sm font-medium transition-colors",
                theme.brightness === b.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card/40 hover:border-primary/40",
              )}
            >
              {b.name}
            </button>
          ))}
        </div>
      </PickerSection>
    </div>
  );
}

function PickerSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * Renders a small swatch using the target palette's CSS so the user
 * previews the actual color before committing.
 */
function SwatchButton({
  palette,
  brightness,
  mode,
  active,
  disabled,
  onClick,
  label,
  description,
}: {
  palette: ThemePalette;
  brightness: ThemeBrightness;
  mode: ThemeMode;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-palette={palette}
      data-mode={mode}
      className={cn(
        "group flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors",
        active
          ? "border-primary bg-primary/10"
          : "border-border bg-card/40 hover:border-primary/40",
        brightness === "dark" ? "dark" : "light",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-5 rounded-full border border-border"
          style={{
            background:
              "linear-gradient(135deg, var(--primary), var(--accent))",
          }}
        />
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </button>
  );
}

function ModeButton({
  active,
  disabled,
  onClick,
  label,
  description,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
        active
          ? "border-primary bg-primary/10"
          : "border-border bg-card/40 hover:border-primary/40",
      )}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  );
}
