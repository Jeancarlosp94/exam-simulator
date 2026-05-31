import { cn } from "@/lib/utils";

export type QuestionStatus = "answered" | "flagged" | "pending";

type QuestionGridProps = {
  totalQuestions: number;
  currentQuestion: number;
  getQuestionStatus: (index: number) => QuestionStatus;
  onQuestionClick: (index: number) => void;
  className?: string;
};

const statusStyles: Record<QuestionStatus, string> = {
  answered: "bg-primary text-primary-foreground",
  flagged: "bg-amber-400 text-neutral-950",
  pending: "bg-secondary text-secondary-foreground",
};

const legend: ReadonlyArray<{ status: QuestionStatus; label: string }> = [
  { status: "answered", label: "Respondida" },
  { status: "flagged", label: "Marcada" },
  { status: "pending", label: "Pendiente" },
];

export function QuestionGrid({
  totalQuestions,
  currentQuestion,
  getQuestionStatus,
  onQuestionClick,
  className,
}: QuestionGridProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-sm",
        className,
      )}
    >
      <h3 className="mb-4 text-lg font-semibold text-card-foreground">
        Navegación
      </h3>

      <div className="mb-4 space-y-2 text-xs">
        {legend.map(({ status, label }) => (
          <div key={status} className="flex items-center gap-2">
            <span
              className={cn(
                "size-3 rounded",
                statusStyles[status].split(" ")[0],
              )}
              aria-hidden
            />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      <div className="grid max-h-[60vh] grid-cols-5 gap-2 overflow-y-auto">
        {Array.from({ length: totalQuestions }, (_, i) => {
          const status = getQuestionStatus(i);
          const isCurrent = i === currentQuestion;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onQuestionClick(i)}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`Pregunta ${i + 1}, ${status}`}
              className={cn(
                "aspect-square rounded-lg text-sm font-semibold transition-all hover:scale-105 hover:shadow-md",
                statusStyles[status],
                isCurrent && "ring-2 ring-ring ring-offset-2 ring-offset-card",
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
