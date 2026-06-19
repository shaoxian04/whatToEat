"use client";

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
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-xl font-bold">{initialSession.hostName}&apos;s lunch vote</h1>
      <p className="text-sm text-gray-500">Voting as {voterName}</p>

      {closed && (
        <p className="rounded-xl bg-green-50 p-3 font-semibold text-green-700">
          Winner: {winner ? winner.name : "No winner (all vetoed)"}
        </p>
      )}

      {options.map((o) => (
        <div key={o.id} className="flex items-center justify-between rounded-2xl border p-4">
          <span className="font-medium">{o.name}</span>
          <span className="flex items-center gap-3 text-sm">
            <span data-testid={`up-${o.id}`}>👍 {tally[o.id]?.up ?? 0}</span>
            <span data-testid={`veto-${o.id}`}>🚫 {tally[o.id]?.veto ?? 0}</span>
            {!closed && (
              <>
                <button onClick={() => onCast(o.id, "up")}
                  className="rounded bg-green-600 px-2 py-1 text-white" aria-label={`Upvote ${o.name}`}>
                  Up
                </button>
                <button onClick={() => onCast(o.id, "veto")}
                  className="rounded bg-red-600 px-2 py-1 text-white" aria-label={`Veto ${o.name}`}>
                  Veto
                </button>
              </>
            )}
          </span>
        </div>
      ))}

      {!closed && canClose && (
        <button onClick={onClose} className="rounded-xl bg-gray-900 px-4 py-2 font-medium text-white">
          Close voting and pick winner
        </button>
      )}
    </div>
  );
}
