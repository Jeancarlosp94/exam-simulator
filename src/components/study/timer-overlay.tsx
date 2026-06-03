"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Phase = "work" | "break";

type Props = {
  workMinutes: number;
  breakMinutes: number;
};

/**
 * Floating Pomodoro / Deep Work timer. Sits above the bottom nav so the
 * student always sees how much time is left in the current block. Local
 * state only — we don't persist across reloads (yet) because session
 * resume already restores the bigger picture and a reset is one click.
 *
 * Phase transitions happen inside the tick callback so we avoid the
 * cascading-render pattern of reacting to derived state in a second
 * effect.
 */
export function TimerOverlay({ workMinutes, breakMinutes }: Props) {
  const [phase, setPhase] = useState<Phase>("work");
  const [secondsLeft, setSecondsLeft] = useState(workMinutes * 60);
  const [running, setRunning] = useState(true);
  const [completedWorkBlocks, setCompletedWorkBlocks] = useState(0);

  useEffect(() => {
    if (!running) return;
    const handle = setInterval(() => {
      setSecondsLeft((s) => {
        if (s > 1) return s - 1;
        // Tick that ends the block. Flip phase atomically alongside the
        // countdown reset so we only commit one new state per second.
        if (phase === "work") {
          setCompletedWorkBlocks((n) => n + 1);
          setPhase("break");
          return breakMinutes * 60;
        }
        setPhase("work");
        return workMinutes * 60;
      });
    }, 1000);
    return () => clearInterval(handle);
  }, [running, phase, workMinutes, breakMinutes]);

  const minutes = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (secondsLeft % 60).toString().padStart(2, "0");

  return (
    <div
      role="region"
      aria-label="Temporizador"
      className={cn(
        "fixed bottom-20 right-3 z-30 flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-sm shadow-lg backdrop-blur sm:bottom-4",
        phase === "break"
          ? "border-emerald-500/40 text-emerald-300"
          : "border-primary/40 text-primary",
      )}
    >
      <span className="text-xs uppercase tracking-wide">
        {phase === "work" ? "Foco" : "Descanso"}
      </span>
      <span className="font-mono tabular-nums">
        {minutes}:{seconds}
      </span>
      <span className="text-xs text-muted-foreground">
        · {completedWorkBlocks}
      </span>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => setRunning((r) => !r)}
        aria-label={running ? "Pausar" : "Reanudar"}
      >
        {running ? <Pause /> : <Play />}
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => {
          setPhase("work");
          setSecondsLeft(workMinutes * 60);
        }}
        aria-label="Reiniciar bloque"
      >
        <RotateCcw />
      </Button>
    </div>
  );
}
