"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { VoteRoom } from "@/components/VoteRoom";
import { StatusScreen } from "@/components/StatusScreen";
import { BackHome } from "@/components/BackHome";
import type { SessionState } from "@/lib/vote/repository";

export default function VoteRoomPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const [state, setState] = useState<SessionState | null>(null);
  const [voterName, setVoterName] = useState<string>(() =>
    typeof window !== "undefined"
      ? localStorage.getItem(`whattoeat:name:${sessionId}`) ?? ""
      : "",
  );
  const [joined, setJoined] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? !!localStorage.getItem(`whattoeat:name:${sessionId}`)
      : false,
  );
  const [notFound, setNotFound] = useState(false);

  const join = () => {
    const name = voterName.trim();
    if (!name) return;
    if (typeof window !== "undefined") {
      localStorage.setItem(`whattoeat:name:${sessionId}`, name);
    }
    setJoined(true);
  };

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setState)
      .catch(() => setNotFound(true));
  }, [sessionId]);

  const [hostToken] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? localStorage.getItem(`whattoeat:host:${sessionId}`)
      : null,
  );

  const onCast = useCallback(
    async (optionId: string) => {
      await fetch(`/api/sessions/${sessionId}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterName, optionId }),
      });
    },
    [sessionId, voterName],
  );

  const onClose = useCallback(async () => {
    await fetch(`/api/sessions/${sessionId}/close`, {
      method: "POST",
      headers: hostToken ? { "x-host-token": hostToken } : {},
    });
  }, [sessionId, hostToken]);

  if (notFound) return <StatusScreen emoji="🥡" text="This lunch vote has ended or was not found." />;
  if (!state) return <StatusScreen emoji="🍜" text="Loading the vote…" />;

  if (!joined) {
    return (
      <main className="placemat mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-5 py-8">
        <BackHome />
        <div className="flex flex-1 flex-col justify-center gap-4">
          <h1 className="font-display text-2xl font-extrabold leading-tight">
            Join {state.session.hostName}&apos;s lunch vote
          </h1>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Your name
            <input
              className="tile-sm bg-white px-3 py-2 font-medium outline-none"
              placeholder="e.g. Bo"
              value={voterName}
              onChange={(e) => setVoterName(e.target.value)}
            />
          </label>
          <button
            onClick={join}
            className="tile tile-press bg-herb px-4 py-3 font-display text-lg font-bold text-ink"
          >
            Join
          </button>
        </div>
      </main>
    );
  }

  return (
    <VoteRoom
      sessionId={sessionId}
      initialSession={state.session}
      options={state.options}
      initialVotes={state.votes}
      voterName={voterName.trim()}
      onCast={onCast}
      onClose={onClose}
      canClose={!!hostToken}
    />
  );
}
