"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { QuickVoteForm, type VoteOptionInput } from "@/components/QuickVoteForm";
import { StatusScreen } from "@/components/StatusScreen";
import { loadDraft, clearDraft } from "@/lib/vote/draft";

export default function VoteEntryPage() {
  const router = useRouter();
  const [initialOptions, setInitialOptions] = useState<VoteOptionInput[]>([]);
  const [ready, setReady] = useState(false);
  const consumed = useRef(false);

  // Consume the Browse handoff once, on the client, AFTER mount. Reading +
  // clearing sessionStorage in an effect (never a render-time initializer)
  // keeps SSR hydration stable — server and first client render both show the
  // gate — and the `consumed` ref makes it survive React Strict Mode's
  // double-invoke (the second pass would otherwise read empty after the first
  // cleared, dropping the draft).
  useEffect(() => {
    if (consumed.current) return;
    consumed.current = true;
    const draft = loadDraft();
    clearDraft();
    setInitialOptions(draft.map((d) => ({ name: d.name, placeId: d.placeId, snapshot: d.snapshot })));
    setReady(true);
  }, []);

  const onCreate = async (hostName: string, options: VoteOptionInput[]) => {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostName,
        options: options.map((o) => ({ name: o.name, placeId: o.placeId ?? null, snapshot: o.snapshot ?? null })),
      }),
    });
    if (!res.ok) return;
    const { sessionId, hostToken } = (await res.json()) as { sessionId: string; hostToken: string };
    if (typeof window !== "undefined") {
      localStorage.setItem(`whattoeat:host:${sessionId}`, hostToken);
      // Remember the creator's name so they land in the room already joined.
      localStorage.setItem(`whattoeat:name:${sessionId}`, hostName);
    }
    router.push(`/vote/${sessionId}`);
  };

  // One-tick gate while the draft is consumed; also the SSR/first-client paint.
  if (!ready) return <StatusScreen emoji="🍽️" text="Setting up your vote…" />;

  return <QuickVoteForm onCreate={onCreate} initialOptions={initialOptions} />;
}
