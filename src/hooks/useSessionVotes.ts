"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Vote } from "@/lib/vote/types";

export interface LiveState {
  votes: Vote[];
  status: "open" | "closed";
  winnerOptionId: string | null;
}

export interface LiveSession extends LiveState {
  refresh?: () => Promise<void>;
}

export type FetchState = (sessionId: string) => Promise<LiveState | null>;

// Browsers read through our own API (service role server-side) rather than
// Supabase directly, so the anon key never needs read access to vote data.
export const fetchSessionState: FetchState = async (sessionId) => {
  const res = await fetch(`/api/sessions/${sessionId}`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    votes: data.votes ?? [],
    status: data.session?.status ?? "open",
    winnerOptionId: data.session?.winnerOptionId ?? null,
  };
};

export const POLL_INTERVAL_MS = 3000;

export function useSessionVotes(
  sessionId: string,
  initial: LiveState,
  fetchState: FetchState = fetchSessionState,
  intervalMs: number = POLL_INTERVAL_MS,
): LiveSession {
  const [state, setState] = useState<LiveState>(initial);
  const closedRef = useRef(initial.status === "closed");

  const refresh = useCallback(async () => {
    try {
      const next = await fetchState(sessionId);
      if (!next) return;
      closedRef.current = next.status === "closed";
      setState(next);
    } catch {
      // Transient network error: keep the last good state; the next tick retries.
    }
  }, [sessionId, fetchState]);

  useEffect(() => {
    const id = setInterval(() => {
      if (closedRef.current) return;
      if (typeof document !== "undefined" && document.hidden) return;
      void refresh();
    }, intervalMs);
    const onVisible = () => {
      if (!document.hidden && !closedRef.current) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, intervalMs]);

  return { ...state, refresh };
}
