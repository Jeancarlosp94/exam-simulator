import { Flame } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getStreak } from "@/lib/streak";

type Props = {
  userId: string;
};

/**
 * "🔥 N días" — visible only when the streak is alive (>0). Hidden on
 * zero by design: never shame a returning user with a "you broke your
 * streak" reminder. The flame icon is animated on multi-day streaks for
 * the dopamine hit (Duolingo school).
 */
export async function StreakBadge({ userId }: Props) {
  const streak = await getStreak(userId);
  if (streak <= 0) return null;

  return (
    <Badge
      variant="outline"
      title={`Llevás ${streak} ${streak === 1 ? "día" : "días"} seguidos estudiando`}
      className={cn(
        "border-amber-500/40 bg-amber-500/10 text-amber-300 transition-transform",
        streak >= 7 && "animate-pulse",
      )}
    >
      <Flame className="size-3" />
      {streak} {streak === 1 ? "día" : "días"}
    </Badge>
  );
}
