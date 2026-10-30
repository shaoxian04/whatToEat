import type { VoteSession, VoteOption, Vote } from "@/lib/vote/types";
import { computeWinner } from "@/lib/vote/winner";

export interface CreateSessionInput {
  hostName: string;
  options: { name: string; placeId?: string | null; snapshot?: unknown }[];
}
export interface CastVoteInput {
  optionId: string;
  voterName: string;
  voterId: string; // per-browser id; never returned to clients
}
export interface SessionState {
  session: VoteSession;
  options: VoteOption[];
  votes: Vote[];
}
export type CastVoteResult =
  | { ok: true }
  | { ok: false; reason: "duplicate" | "closed" | "expired" | "not_found" | "bad_option" | "name_taken" };
export type CloseResult =
  | { winnerId: string | null }
  | { error: "not_found" | "already_closed" | "forbidden" };

export function isExpired(session: VoteSession, now: number = Date.now()): boolean {
  if (!session.expiresAt) return false;
  const t = Date.parse(session.expiresAt);
  return Number.isFinite(t) && t <= now;
}

export interface VoteRepository {
  createSession(input: CreateSessionInput): Promise<{ sessionId: string; hostToken: string }>;
  getSession(sessionId: string): Promise<SessionState | null>;
  castVote(sessionId: string, input: CastVoteInput): Promise<CastVoteResult>;
  closeSession(sessionId: string, hostToken: string): Promise<CloseResult>;
}

// Deterministic id generator for the in-memory double (tests only — never used in prod).
function makeIdFactory() {
  let n = 0;
  return () => `id-${++n}`;
}

export function createInMemoryVoteRepository(config: { ttlMs?: number } = {}): VoteRepository {
  const nextId = makeIdFactory();
  const sessions = new Map<string, VoteSession>();
  const options = new Map<string, VoteOption[]>();
  const votes = new Map<string, (Vote & { voterId: string })[]>();
  const hostTokens = new Map<string, string>();

  return {
    async createSession(input) {
      const sessionId = nextId();
      const hostToken = `host-${nextId()}`;
      sessions.set(sessionId, {
        id: sessionId, hostName: input.hostName, status: "open",
        winnerOptionId: null,
        expiresAt: config.ttlMs !== undefined ? new Date(Date.now() + config.ttlMs).toISOString() : "",
      });
      options.set(sessionId, input.options.map((o) => ({
        id: nextId(), sessionId, placeId: o.placeId ?? null, name: o.name, snapshot: o.snapshot ?? null,
      })));
      votes.set(sessionId, []);
      hostTokens.set(sessionId, hostToken);
      return { sessionId, hostToken };
    },
    async getSession(sessionId) {
      const session = sessions.get(sessionId);
      if (!session) return null;
      const publicVotes = (votes.get(sessionId) ?? []).map(({ voterId: _voterId, ...v }) => v);
      return { session, options: options.get(sessionId) ?? [], votes: publicVotes };
    },
    async castVote(sessionId, input) {
      const session = sessions.get(sessionId);
      if (!session) return { ok: false, reason: "not_found" };
      if (session.status === "closed") return { ok: false, reason: "closed" };
      if (isExpired(session)) return { ok: false, reason: "expired" };
      const opts = options.get(sessionId) ?? [];
      if (!opts.some((o) => o.id === input.optionId)) return { ok: false, reason: "bad_option" };
      const existing = votes.get(sessionId) ?? [];
      if (existing.some((v) => v.voterName === input.voterName && v.voterId !== input.voterId)) {
        return { ok: false, reason: "name_taken" };
      }
      if (existing.some((v) => v.optionId === input.optionId && v.voterId === input.voterId)) {
        return { ok: false, reason: "duplicate" };
      }
      existing.push({
        id: nextId(), sessionId, optionId: input.optionId,
        voterName: input.voterName, voterId: input.voterId, createdAt: "",
      });
      votes.set(sessionId, existing);
      return { ok: true };
    },
    async closeSession(sessionId, hostToken) {
      const session = sessions.get(sessionId);
      if (!session) return { error: "not_found" };
      if (hostTokens.get(sessionId) !== hostToken) return { error: "forbidden" };
      if (session.status === "closed") return { error: "already_closed" };
      const winnerId = computeWinner(options.get(sessionId) ?? [], votes.get(sessionId) ?? []);
      sessions.set(sessionId, { ...session, status: "closed", winnerOptionId: winnerId });
      return { winnerId };
    },
  };
}
