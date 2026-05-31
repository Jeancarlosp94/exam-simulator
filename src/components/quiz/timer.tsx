import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";

type TimerProps = {
  timeLeft: number;
  className?: string;
};

function formatTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

export function Timer({ timeLeft, className }: TimerProps) {
  const color =
    timeLeft < 300
      ? "text-destructive"
      : timeLeft < 600
        ? "text-amber-400"
        : "text-foreground";

  return (
    <div
      className={cn("flex items-center gap-2", color, className)}
      role="timer"
      aria-live="polite"
    >
      <Clock className="size-5" />
      <span className="font-mono text-2xl font-semibold tabular-nums">
        {formatTime(timeLeft)}
      </span>
    </div>
  );
}
