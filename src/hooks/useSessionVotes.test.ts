import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionVotes, type LiveState } from "@/hooks/useSessionVotes";

const initial: LiveState = { votes: [], status: "open", winnerOptionId: null };
const vote = { id: "v1", sessionId: "s1", optionId: "o1", voterName: "Al", createdAt: "" };

afterEach(() => vi.useRealTimers());

describe("useSessionVotes", () => {
  it("polls the session and picks up new votes", async () => {
    vi.useFakeTimers();
    const fetchState = vi.fn().mockResolvedValue({ ...initial, votes: [vote] });
    const { result } = renderHook(() => useSessionVotes("s1", initial, fetchState, 1000));
    expect(result.current.votes).toHaveLength(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(fetchState).toHaveBeenCalledWith("s1");
    expect(result.current.votes).toHaveLength(1);
  });

  it("refresh() updates status + winner immediately", async () => {
    const fetchState = vi.fn().mockResolvedValue({ votes: [], status: "closed", winnerOptionId: "o2" });
    const { result } = renderHook(() => useSessionVotes("s1", initial, fetchState, 60_000));
    await act(async () => { await result.current.refresh!(); });
    expect(result.current.status).toBe("closed");
    expect(result.current.winnerOptionId).toBe("o2");
  });

  it("stops polling once the session is closed", async () => {
    vi.useFakeTimers();
    const fetchState = vi.fn().mockResolvedValue({ votes: [], status: "closed", winnerOptionId: null });
    renderHook(() => useSessionVotes("s1", initial, fetchState, 1000));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(fetchState).toHaveBeenCalledTimes(1);
  });

  it("keeps the last good state when a poll fails", async () => {
    const fetchState = vi.fn().mockRejectedValue(new Error("offline"));
    const start = { ...initial, votes: [vote] };
    const { result } = renderHook(() => useSessionVotes("s1", start, fetchState, 60_000));
    await act(async () => { await result.current.refresh!(); });
    expect(result.current.votes).toHaveLength(1);
  });
});
