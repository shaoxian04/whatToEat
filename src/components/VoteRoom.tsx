"use client";

import Link from "next/link";
import type { VoteSession, VoteOption, Vote } from "@/lib/vote/types";
import { tallyVotes } from "@/lib/vote/winner";
import { useSessionVotes } from "@/hooks/useSessionVotes";

interface Props {
  sessionId: string;
  initialSession: VoteSession;
  options: VoteOption[];
  initialVotes: Vote[];
  voterName: string;
  onCast: (optionId: string, type: "up" | "veto") => Promise<void>;
  onClose: () => Promise<void>;
  canClose: boolean;
  subscribe?: typeof useSessionVotes;
}

export function VoteRoom({
  sessionId, initialSession, options, initialVotes, voterName, onCast, onClose, canClose,
  subscribe = useSessionVotes,
}: Props) {
  const live = subscribe(sessionId, {
    votes: initialVotes,
    status: initialSession.status,
    winnerOptionId: initialSession.winnerOptionId,
  });
  const tally = tallyVotes(options, live.votes);
  const closed = live.status === "closed";
  const winner = options.find((o) => o.id === live.winnerOptionId);

  return (
    <main className="placemat mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-5 py-8">
      <Link href="/" className="font-display text-base font-bold">
        🍜 whatToEat
      </Link>

      <header>
        <h1 className="font-display text-2xl font-extrabold leading-tight">
          {initialSession.hostName}&apos;s lunch vote
        </h1>
        <p className="mt-1 font-mono text-xs text-ink-soft">Voting as {voterName}</p>
      </header>

      {closed && (
        <p className="tile bg-herb/15 p-4 font-display text-lg font-bold text-herb-ink">
          🏆 Winner: {winner ? winner.name : "No winner (all vetoed)"}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {options.map((o) => (
          <div key={o.id} className="tile bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-display text-lg font-bold">{o.name}</span>
              <span className="flex shrink-0 items-center gap-2 font-mono text-sm font-semibold">
                <span data-testid={`up-${o.id}`}>👍 {tally[o.id]?.up ?? 0}</span>
                <span data-testid={`veto-${o.id}`}>🚫 {tally[o.id]?.veto ?? 0}</span>
              </span>
            </div>
            {!closed && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => onCast(o.id, "up")}
                  aria-label={`Upvote ${o.name}`}
                  className="tile-sm tile-press flex-1 bg-herb/15 py-2 text-sm font-bold text-herb-ink"
                >
                  👍 Up
                </button>
                <button
                  onClick={() => onCast(o.id, "veto")}
                  aria-label={`Veto ${o.name}`}
                  className="tile-sm tile-press flex-1 bg-tomato/15 py-2 text-sm font-bold text-tomato-ink"
                >
                  🚫 Veto
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {!closed && canClose && (
        <button
          onClick={onClose}
          className="tile tile-press bg-tomato px-4 py-3 font-display text-lg font-bold text-ink"
        >
          Close voting and pick winner
        </button>
      )}
    </main>
  );
}
