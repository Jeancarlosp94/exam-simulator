"use client";

import { Brain, Send, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ChatMessage = { role: "user" | "assistant"; content: string };

type Props = {
  questionId: string;
  attemptId: string;
  questionPrompt: string;
  trigger: React.ReactNode;
};

const SUGGESTED_OPENERS = [
  "¿Por qué mi respuesta es incorrecta?",
  "¿Qué concepto me falta entender?",
  "Dame una pista, no la respuesta.",
];

export function TutorDialog({
  questionId,
  attemptId,
  questionPrompt,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);

  async function sendMessage(content: string) {
    if (streaming || !content.trim()) return;

    const userMessage: ChatMessage = { role: "user", content: content.trim() };
    const nextHistory = [...messages, userMessage];
    setMessages([...nextHistory, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    const response = await fetch("/api/tutor/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_id: questionId,
        attempt_id: attemptId,
        history: nextHistory,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        retry_after_seconds?: number;
      };
      if (payload.error === "rate_limited") {
        const mins = Math.ceil((payload.retry_after_seconds ?? 60) / 60);
        toast.error(
          `Has alcanzado el límite del tutor. Vuelve en ~${mins} min.`,
        );
      } else {
        toast.error(`Tutor no disponible: ${payload.error ?? "error"}`);
      }
      // Roll back the empty assistant placeholder so the UI doesn't show it
      setMessages(nextHistory);
      setStreaming(false);
      return;
    }

    if (!response.body) {
      setMessages(nextHistory);
      setStreaming(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const delta = decoder.decode(value, { stream: true });
      // Append the delta inside the setState updater — keeps `buffer`
      // immutable for react-hooks/immutability and avoids stale-closure
      // races since prev is always the latest committed state.
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") {
          next[next.length - 1] = { ...last, content: last.content + delta };
        }
        return next;
      });
    }

    setStreaming(false);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!streaming) setOpen(next);
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="size-4 text-primary" />
            Pregúntale a Quizen
          </DialogTitle>
          <DialogDescription className="line-clamp-2">
            {questionPrompt}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-card/30 p-4">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <Sparkles className="size-8 text-primary" />
              <p className="text-sm text-muted-foreground">
                Soy un tutor socrático: no te doy la respuesta, te guío a
                encontrarla.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {SUGGESTED_OPENERS.map((opener) => (
                  <button
                    key={opener}
                    type="button"
                    onClick={() => void sendMessage(opener)}
                    className="rounded-full border border-border bg-card/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {opener}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "mr-auto bg-card/70 text-card-foreground",
                )}
              >
                {msg.content ||
                  (streaming && idx === messages.length - 1 ? (
                    <span className="inline-flex gap-1">
                      <span className="size-1.5 animate-bounce rounded-full bg-current" />
                      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:0.15s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:0.3s]" />
                    </span>
                  ) : (
                    ""
                  ))}
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              streaming ? "El tutor está pensando..." : "Escribe tu pregunta..."
            }
            disabled={streaming}
            autoFocus
          />
          <Button type="submit" disabled={streaming || !input.trim()}>
            <Send />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
