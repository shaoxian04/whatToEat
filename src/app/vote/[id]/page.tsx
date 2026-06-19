"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { VoteRoom } from "@/components/VoteRoom";
import type { SessionState } from "@/lib/vote/repository";

export default function VoteRoomPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const [state, setState] = useState<SessionState | null>(null);
  const [voterName, setVoterName] = useState("");
  const [joined, setJoined] = useState(false);
  const [notFound, setNotFound] = useState(false);

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
    async (optionId: string, type: "up" | "veto") => {
      await fetch(`/api/sessions/${sessionId}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterName, optionId, type }),
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

  if (notFound) return <p className="p-6">This lunch vote has ended or was not found.</p>;
  if (!state) return <p className="p-6">Loading the vote…</p>;

  if (!joined) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 p-6">
        <h1 className="text-xl font-bold">Join {state.session.hostName}&apos;s lunch vote</h1>
        <label className="text-sm">
          Your name
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={voterName}
            onChange={(e) => setVoterName(e.target.value)}
          />
        </label>
        <button
          onClick={() => voterName.trim() && setJoined(true)}
          className="rounded-xl bg-gray-900 px-4 py-2 font-medium text-white"
        >
          Join
        </button>
      </div>
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
