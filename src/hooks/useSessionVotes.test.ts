import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionVotes } from "@/hooks/useSessionVotes";
import type { Vote } from "@/lib/vote/types";

// Fake Supabase channel that captures handlers and lets the test emit events.
function makeFakeClient() {
  const handlers: Record<string, (payload: { new: unknown }) => void> = {};
  const channel = {
    on(_evt: string, filter: { table: string }, cb: (p: { new: unknown }) => void) {
      handlers[filter.table] = cb; return channel;
    },
    subscribe() { return channel; },
  };
  const client = { channel: () => channel, removeChannel: vi.fn() };
  return { client, emit: (table: string, row: unknown) => handlers[table]?.({ new: row }) };
}

const initial = { votes: [] as Vote[], status: "open" as const, winnerOptionId: null };

describe("useSessionVotes", () => {
  it("appends votes pushed over realtime", () => {
    const { client, emit } = makeFakeClient();
    const { result } = renderHook(() =>
      useSessionVotes("s1", initial, () => client as never));
    act(() => emit("votes", { id: "v1", session_id: "s1", option_id: "o1", voter_name: "Al", type: "up", created_at: "" }));
    expect(result.current.votes).toHaveLength(1);
    expect(result.current.votes[0].voterName).toBe("Al");
  });

  it("updates status + winner when the session row changes", () => {
    const { client, emit } = makeFakeClient();
    const { result } = renderHook(() =>
      useSessionVotes("s1", initial, () => client as never));
    act(() => emit("sessions", { id: "s1", status: "closed", winner_option_id: "o2" }));
    expect(result.current.status).toBe("closed");
    expect(result.current.winnerOptionId).toBe("o2");
  });
});
