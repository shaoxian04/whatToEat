"use client";

import { useState } from "react";
import { BackHome } from "@/components/BackHome";

export interface VoteOptionInput {
  name: string;
  placeId?: string | null;
  snapshot?: unknown;
}

interface Props {
  onCreate: (hostName: string, options: VoteOptionInput[]) => Promise<void>;
  initialOptions?: VoteOptionInput[];
}

export function QuickVoteForm({ onCreate, initialOptions }: Props) {
  const [hostName, setHostName] = useState("");
  const [picks, setPicks] = useState<VoteOptionInput[]>(initialOptions ?? []);
  const [texts, setTexts] = useState<string[]>((initialOptions?.length ?? 0) >= 2 ? [] : ["", ""]);
  const [error, setError] = useState<string | null>(null);

  const setText = (i: number, val: string) =>
    setTexts((prev) => prev.map((o, idx) => (idx === i ? val : o)));
  const removePick = (i: number) =>
    setPicks((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async () => {
    const filledTexts: VoteOptionInput[] = texts.map((o) => o.trim()).filter(Boolean).map((name) => ({ name }));
    const all = [...picks, ...filledTexts];
    if (!hostName.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (all.length < 2) {
      setError("Add at least 2 options.");
      return;
    }
    setError(null);
    await onCreate(hostName.trim(), all);
  };

  return (
    <main className="placemat mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-5 py-8">
      <BackHome />
      <header>
        <h1 className="font-display text-3xl font-extrabold leading-tight">Quick group vote</h1>
        <p className="mt-1 text-sm text-ink-soft">Throw out the options — settle it together.</p>
      </header>

      <label className="flex flex-col gap-1 text-sm font-semibold">
        Your name
        <input
          className="tile-sm bg-white px-3 py-2 font-medium outline-none"
          placeholder="e.g. Alex"
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
        />
      </label>

      {picks.length > 0 && (
        <div className="flex flex-col gap-2">
          {picks.map((p, i) => (
            <div key={`${p.placeId ?? "pick"}-${i}`} className="tile-sm flex items-center justify-between gap-2 bg-paper-2 px-3 py-2">
              <span className="min-w-0 truncate font-display font-bold">{p.name}</span>
              <button
                type="button"
                onClick={() => removePick(i)}
                aria-label={`Remove ${p.name}`}
                className="shrink-0 font-mono text-sm font-bold text-tomato-ink"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {texts.map((o, i) => (
        <label key={i} className="flex flex-col gap-1 text-sm font-semibold">
          {`Option ${i + 1}`}
          <input
            className="tile-sm bg-white px-3 py-2 font-medium outline-none"
            placeholder={i === 0 ? "Sushi place" : i === 1 ? "That noodle spot" : "Another option"}
            value={o}
            onChange={(e) => setText(i, e.target.value)}
          />
        </label>
      ))}

      <button
        type="button"
        onClick={() => setTexts((p) => [...p, ""])}
        className="self-start font-mono text-sm font-bold text-tomato-ink"
      >
        + Add option
      </button>

      {error && (
        <p className="tile-sm bg-tomato/15 px-3 py-2 text-sm font-semibold text-tomato-ink">{error}</p>
      )}

      <button
        type="button"
        onClick={submit}
        className="tile tile-press mt-1 bg-herb px-4 py-3 font-display text-lg font-bold text-ink"
      >
        Start vote
      </button>
    </main>
  );
}
