"use client";

import { useState, useEffect } from "react";
import type { VoteSession, VoteOption, Vote } from "@/lib/vote/types";
import { tallyVotes, winnerBasis } from "@/lib/vote/winner";
import { isExpired } from "@/lib/vote/repository";
import { useSessionVotes, type LiveSession, type LiveState } from "@/hooks/useSessionVotes";
import { BackHome } from "@/components/BackHome";
import { parseSnapshot } from "@/lib/vote/snapshot";
import { priceLabel, mapsUrl } from "@/lib/restaurant-format";

export type CastOutcome =
  | { ok: true }
  | { ok: false; message: string; rename?: boolean };

interface Props {
  sessionId: string;
  initialSession: VoteSession;
  options: VoteOption[];
  initialVotes: Vote[];
  voterName: string;
  // Resolving to undefined counts as success.
  onCast: (optionId: string) => Promise<CastOutcome | void>;
  // Resolves to an error message, or nothing on success.
  onClose: () => Promise<string | null | void>;
  onRename?: () => void;
  canClose: boolean;
  subscribe?: (sessionId: string, initial: LiveState) => LiveSession;
}

export function VoteRoom({
  sessionId, initialSession, options, initialVotes, voterName, onCast, onClose, onRename, canClose,
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
  const basis = winnerBasis(options, live.votes);
  const expired = !closed && isExpired(initialSession);

  const [pending, setPending] = useState<Set<string>>(new Set());
  const [justVoted, setJustVoted] = useState<Set<string>>(new Set());
  const [error, setError] = useState<{ message: string; rename?: boolean } | null>(null);
  const [closing, setClosing] = useState(false);
  const myVotes = new Set([
    ...live.votes.filter((v) => v.voterName === voterName).map((v) => v.optionId),
    ...justVoted,
  ]);

  const cast = async (optionId: string) => {
    if (pending.has(optionId) || myVotes.has(optionId)) return;
    setError(null);
    setPending((p) => new Set(p).add(optionId));
    try {
      const outcome = await onCast(optionId);
      if (outcome && !outcome.ok) {
        setError({ message: outcome.message, rename: outcome.rename });
      } else {
        setJustVoted((s) => new Set(s).add(optionId));
      }
    } catch {
      setError({ message: "Couldn't record your vote. Check your connection and try again." });
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(optionId);
        return next;
      });
      void live.refresh?.();
    }
  };

  const close = async () => {
    setError(null);
    setClosing(true);
    try {
      const message = await onClose();
      if (message) setError({ message });
    } catch {
      setError({ message: "Couldn't close the vote. Check your connection and try again." });
    } finally {
      setClosing(false);
      void live.refresh?.();
    }
  };

  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") setShareUrl(window.location.href);
  }, []);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="placemat mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-5 py-8">
      <BackHome />

      <header>
        <h1 className="font-display text-2xl font-extrabold leading-tight">
          {initialSession.hostName}&apos;s lunch vote
        </h1>
        <p className="mt-1 font-mono text-xs text-ink-soft">Voting as {voterName}</p>
      </header>

      {!closed && shareUrl && (
        <div className="tile flex flex-col gap-2 bg-mustard/15 p-3">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-mustard-ink">
            Invite the crew →
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Shareable vote link"
              className="tile-sm min-w-0 flex-1 truncate bg-white px-2 py-1.5 font-mono text-xs outline-none"
            />
            <button
              onClick={copyLink}
              className="tile-sm tile-press shrink-0 bg-mustard px-3 py-1.5 text-sm font-bold text-ink"
            >
              {copied ? "✓ Copied" : "Copy link"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="tile flex flex-col gap-2 bg-tomato/15 p-3 text-sm font-semibold text-tomato-ink">
          <p>{error.message}</p>
          {error.rename && onRename && (
            <button
              onClick={onRename}
              className="tile-sm tile-press w-fit bg-white px-3 py-1 text-sm font-bold text-ink"
            >
              Change my name
            </button>
          )}
        </div>
      )}

      {expired && (
        <p className="tile bg-paper-2 p-4 text-sm font-semibold text-ink-soft">
          ⏰ This vote has expired, so new votes aren&apos;t accepted.
          {canClose ? " You can still close it to pick a winner." : ""}
        </p>
      )}

      {closed && (
        <div className="tile bg-herb/15 p-4">
          <p className="font-display text-lg font-bold text-herb-ink">
            🏆 Winner: {winner ? winner.name : "No winner yet"}
          </p>
          {winner && basis !== "most_votes" && (
            <p className="mt-1 font-mono text-xs text-ink-soft">
              {basis === "tie" ? "It was a tie, so we picked one at random." : "Nobody voted, so we picked at random."}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {options.map((o) => (
          <div key={o.id} className="tile bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-display text-lg font-bold">{o.name}</span>
              <span className="flex shrink-0 items-center gap-2 font-mono text-sm font-semibold">
                <span data-testid={`up-${o.id}`}>👍 {tally[o.id]?.up ?? 0}</span>
              </span>
            </div>
            {(() => {
              const snap = parseSnapshot(o.snapshot);
              if (!snap) return null;
              return (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-xs font-medium">
                  {snap.rating !== null && (
                    <span className="rounded-full border-[1.5px] border-ink bg-paper-2 px-2 py-0.5">
                      {`★ ${snap.rating}${
                        typeof snap.userRatingCount === "number"
                          ? ` (${snap.userRatingCount.toLocaleString()})`
                          : ""
                      }`}
                    </span>
                  )}
                  {snap.priceLevel !== null && (
                    <span className="rounded-full border-[1.5px] border-ink bg-paper-2 px-2 py-0.5">
                      {priceLabel(snap.priceLevel)}
                    </span>
                  )}
                  {snap.openNow === true && (
                    <span className="rounded-full border-[1.5px] border-ink bg-herb/20 px-2 py-0.5 text-herb-ink">
                      Open now
                    </span>
                  )}
                  <a
                    href={mapsUrl(snap.name, snap.placeId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-tomato-ink underline"
                  >
                    Directions →
                  </a>
                </div>
              );
            })()}
            {!closed && !expired && (() => {
              const voted = myVotes.has(o.id);
              const busy = pending.has(o.id);
              return (
                <button
                  onClick={() => cast(o.id)}
                  disabled={voted || busy}
                  aria-pressed={voted}
                  aria-label={voted ? `You upvoted ${o.name}` : `Upvote ${o.name}`}
                  className={`tile-sm mt-3 w-full py-2 text-sm font-bold ${
                    voted ? "bg-herb text-ink" : "tile-press bg-herb/15 text-herb-ink"
                  } disabled:cursor-default`}
                >
                  {voted ? "✓ You voted" : busy ? "Voting…" : "👍 Up"}
                </button>
              );
            })()}
          </div>
        ))}
      </div>

      {!closed && canClose && (
        <button
          onClick={close}
          disabled={closing}
          className="tile tile-press bg-tomato px-4 py-3 font-display text-lg font-bold text-ink disabled:opacity-60"
        >
          {closing ? "Closing…" : "Close voting and pick winner"}
        </button>
      )}
    </main>
  );
}
