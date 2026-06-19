"use client";

import { useRouter } from "next/navigation";
import { QuickVoteForm } from "@/components/QuickVoteForm";

export default function VoteEntryPage() {
  const router = useRouter();
  const onCreate = async (hostName: string, options: string[]) => {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostName, options: options.map((name) => ({ name })) }),
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
  return <QuickVoteForm onCreate={onCreate} />;
}
