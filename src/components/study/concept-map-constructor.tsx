"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ConceptMapEdge, ConceptMapNode } from "@/lib/supabase/types";

type Props = {
  nodes: ConceptMapNode[];
  initialEdges: ConceptMapEdge[];
  onSubmit: (edges: ConceptMapEdge[]) => Promise<void>;
  pending: boolean;
};

/**
 * Constructed concept map (g≈0.72). We deliberately do NOT render a
 * pretty SVG graph in v1 — students drag edges between nodes via a form
 * (pick from, pick to, type a label). The cognitive work — naming the
 * relationship — is the bit research credits, not the visual rendering.
 */
export function ConceptMapConstructor({
  nodes,
  initialEdges,
  onSubmit,
  pending,
}: Props) {
  const [edges, setEdges] = useState<ConceptMapEdge[]>(initialEdges);
  const [from, setFrom] = useState<string>(nodes[0]?.id ?? "");
  const [to, setTo] = useState<string>(nodes[1]?.id ?? nodes[0]?.id ?? "");
  const [label, setLabel] = useState("");

  function addEdge() {
    if (!from || !to || !label.trim()) return;
    if (from === to) return;
    setEdges((prev) => [...prev, { from, to, label: label.trim() }]);
    setLabel("");
  }

  function removeEdge(index: number) {
    setEdges((prev) => prev.filter((_, i) => i !== index));
  }

  function nodeLabel(id: string): string {
    return nodes.find((n) => n.id === id)?.label ?? id;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="space-y-3 py-5">
          <h3 className="text-sm font-semibold">Conceptos clave</h3>
          <ul className="flex flex-wrap gap-2">
            {nodes.map((n) => (
              <li
                key={n.id}
                className="rounded-full border border-border bg-card/60 px-3 py-1 text-sm"
              >
                {n.label}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 py-5">
          <h3 className="text-sm font-semibold">Conectá los conceptos</h3>
          <p className="text-xs text-muted-foreground">
            Construí relaciones entre conceptos. Etiquetá cada conexión con la
            relación que las une (ej: &quot;causa&quot;, &quot;ejemplo de&quot;,
            &quot;opuesto a&quot;). Mientras más conexiones con sentido, mejor
            el mapa.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_2fr_auto]">
            <div className="space-y-1">
              <Label htmlFor="from-node" className="text-xs">
                Desde
              </Label>
              <select
                id="from-node"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                disabled={pending}
              >
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="to-node" className="text-xs">
                Hacia
              </Label>
              <select
                id="to-node"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                disabled={pending}
              >
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edge-label" className="text-xs">
                Relación
              </Label>
              <Input
                id="edge-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="es causa de, ejemplo de…"
                disabled={pending}
                maxLength={60}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={addEdge}
                disabled={pending || !label.trim() || from === to}
              >
                <Plus />
                Agregar
              </Button>
            </div>
          </div>

          {edges.length > 0 && (
            <ul className="flex flex-col gap-2">
              {edges.map((e, i) => (
                <li
                  key={`${e.from}-${e.to}-${i}`}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card/40 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{nodeLabel(e.from)}</span>
                  <span className="text-muted-foreground">— {e.label} →</span>
                  <span className="font-medium">{nodeLabel(e.to)}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeEdge(i)}
                    className="ml-auto text-muted-foreground"
                    disabled={pending}
                    aria-label="Eliminar conexión"
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => void onSubmit(edges)}
              disabled={pending || edges.length === 0}
            >
              {pending
                ? "Guardando..."
                : edges.length === 0
                  ? "Agregá al menos una conexión"
                  : `Terminar (${edges.length} conexiones)`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
