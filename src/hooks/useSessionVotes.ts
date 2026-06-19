"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Vote } from "@/lib/vote/types";
import { createBrowserSupabase } from "@/lib/supabase/browser";

interface State {
  votes: Vote[];
  status: "open" | "closed";
  winnerOptionId: string | null;
}

function mapVoteRow(r: Record<string, unknown>): Vote {
  return {
    id: r.id as string, sessionId: r.session_id as string, optionId: r.option_id as string,
    voterName: r.voter_name as string, type: r.type as "up" | "veto", createdAt: (r.created_at as string) ?? "",
  };
}

export function useSessionVotes(
  sessionId: string,
  initial: State,
  makeClient: () => SupabaseClient = createBrowserSupabase,
): State {
  const [state, setState] = useState<State>(initial);

  useEffect(() => {
    const client = makeClient();
    const channel = client
      .channel(`session-${sessionId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "votes", filter: `session_id=eq.${sessionId}` },
        (payload: { new: Record<string, unknown> }) => {
          const v = mapVoteRow(payload.new);
          setState((s) => (s.votes.some((x) => x.id === v.id) ? s : { ...s, votes: [...s.votes, v] }));
        })
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
        (payload: { new: Record<string, unknown> }) => {
          setState((s) => ({
            ...s,
            status: (payload.new.status as "open" | "closed") ?? s.status,
            winnerOptionId: (payload.new.winner_option_id as string | null) ?? s.winnerOptionId,
          }));
        })
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [sessionId, makeClient]);

  return state;
}
