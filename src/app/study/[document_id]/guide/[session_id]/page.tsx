import { notFound, redirect } from "next/navigation";

import { GuidedSessionPlayer } from "@/components/study/guided-session-player";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

type Params = { document_id: string; session_id: string };

/**
 * Loads the persisted study session and hands it to the guided player.
 * The player drives the multi-step flow via the /api/study/session/[id]/advance
 * endpoint and renders the current step.
 */
export default async function GuidedSessionPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { document_id, session_id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/study/${document_id}/guide/${session_id}`);
  }

  const service = getSupabaseServiceClient();
  const { data: session } = await service
    .from("study_sessions")
    .select(
      "id, user_id, document_id, mode, status, current_step, current_chunk_index, key_terms, advance_organizer, schema_activation_answer, concept_map_nodes, concept_map_edges",
    )
    .eq("id", session_id)
    .single();
  if (!session || session.user_id !== user.id) notFound();
  if (session.document_id !== document_id) notFound();

  const { data: document } = await service
    .from("documents")
    .select("id, title")
    .eq("id", document_id)
    .single();
  if (!document) notFound();

  // Total chunks — used by player to show progress.
  const { count: totalChunks } = await service
    .from("document_chunks")
    .select("id", { count: "exact", head: true })
    .eq("document_id", document_id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <GuidedSessionPlayer
        documentId={document_id}
        documentTitle={document.title}
        sessionId={session_id}
        mode={session.mode}
        initialState={{
          currentStep: session.current_step,
          currentChunkIndex: session.current_chunk_index,
          keyTerms: session.key_terms ?? [],
          advanceOrganizer: session.advance_organizer ?? "",
          schemaActivationAnswer: session.schema_activation_answer ?? "",
          conceptMapNodes: session.concept_map_nodes ?? [],
          conceptMapEdges: session.concept_map_edges ?? [],
          totalChunks: totalChunks ?? 0,
        }}
      />
    </main>
  );
}
