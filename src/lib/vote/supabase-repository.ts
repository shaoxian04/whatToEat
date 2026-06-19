import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  VoteRepository, CreateSessionInput, CastVoteInput, SessionState, CastVoteResult, CloseResult,
} from "@/lib/vote/repository";
import type { VoteSession, VoteOption, Vote } from "@/lib/vote/types";
import { computeWinner } from "@/lib/vote/winner";

function mapSession(r: Record<string, unknown>): VoteSession {
  return {
    id: r.id as string, hostName: r.host_name as string,
    status: r.status as "open" | "closed",
    winnerOptionId: (r.winner_option_id as string | null) ?? null,
    expiresAt: r.expires_at as string,
  };
}
function mapOption(r: Record<string, unknown>): VoteOption {
  return {
    id: r.id as string, sessionId: r.session_id as string,
    placeId: (r.place_id as string | null) ?? null, name: r.name as string, snapshot: r.snapshot ?? null,
  };
}
function mapVote(r: Record<string, unknown>): Vote {
  return {
    id: r.id as string, sessionId: r.session_id as string, optionId: r.option_id as string,
    voterName: r.voter_name as string, type: r.type as "up" | "veto", createdAt: r.created_at as string,
  };
}

export function createSupabaseVoteRepository(client: SupabaseClient): VoteRepository {
  return {
    async createSession(input: CreateSessionInput) {
      const { data: session, error } = await client
        .from("sessions").insert({ host_name: input.hostName }).select().single();
      if (error || !session) throw new Error("create session failed");
      const rows = input.options.map((o) => ({
        session_id: session.id, name: o.name, place_id: o.placeId ?? null, snapshot: o.snapshot ?? null,
      }));
      const { error: optErr } = await client.from("session_options").insert(rows);
      if (optErr) throw new Error("create options failed");
      const { data: secret, error: secretErr } = await client
        .from("session_secrets")
        .insert({ session_id: session.id })
        .select("host_token")
        .single();
      if (secretErr || !secret) throw new Error("create session secret failed");
      return { sessionId: session.id as string, hostToken: (secret as Record<string, unknown>).host_token as string };
    },
    async getSession(sessionId: string): Promise<SessionState | null> {
      const { data: s } = await client.from("sessions").select().eq("id", sessionId).maybeSingle();
      if (!s) return null;
      const { data: opts } = await client.from("session_options").select().eq("session_id", sessionId);
      const { data: vts } = await client.from("votes").select().eq("session_id", sessionId);
      return {
        session: mapSession(s),
        options: (opts ?? []).map(mapOption),
        votes: (vts ?? []).map(mapVote),
      };
    },
    async castVote(sessionId: string, input: CastVoteInput): Promise<CastVoteResult> {
      const { data: s } = await client.from("sessions").select("status").eq("id", sessionId).maybeSingle();
      if (!s) return { ok: false, reason: "not_found" };
      if (s.status === "closed") return { ok: false, reason: "closed" };
      const { data: opt } = await client.from("session_options")
        .select("id").eq("id", input.optionId).eq("session_id", sessionId).maybeSingle();
      if (!opt) return { ok: false, reason: "bad_option" };
      const { error } = await client.from("votes").insert({
        session_id: sessionId, option_id: input.optionId, voter_name: input.voterName, type: input.type,
      });
      if (error) {
        // 23505 = unique_violation -> duplicate vote
        if ((error as { code?: string }).code === "23505") return { ok: false, reason: "duplicate" };
        throw new Error("cast vote failed");
      }
      return { ok: true };
    },
    async closeSession(sessionId: string, hostToken: string): Promise<CloseResult> {
      const { data: s } = await client.from("sessions").select("status").eq("id", sessionId).maybeSingle();
      if (!s) return { error: "not_found" };
      const { data: secret } = await client
        .from("session_secrets")
        .select("host_token")
        .eq("session_id", sessionId)
        .maybeSingle();
      if (!secret || (secret as Record<string, unknown>).host_token !== hostToken) {
        return { error: "forbidden" };
      }
      if (s.status === "closed") return { error: "already_closed" };
      const state = await this.getSession(sessionId);
      if (!state) return { error: "not_found" };
      const winnerId = computeWinner(state.options, state.votes);
      const { error } = await client.from("sessions")
        .update({ status: "closed", winner_option_id: winnerId }).eq("id", sessionId);
      if (error) throw new Error("close failed");
      return { winnerId };
    },
  };
}
