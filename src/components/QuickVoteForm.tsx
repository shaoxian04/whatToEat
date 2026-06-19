"use client";

import Link from "next/link";
import { useState } from "react";

interface Props {
  onCreate: (hostName: string, options: string[]) => Promise<void>;
}

export function QuickVoteForm({ onCreate }: Props) {
  const [hostName, setHostName] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [error, setError] = useState<string | null>(null);

  const setOption = (i: number, val: string) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? val : o)));

  const submit = async () => {
    const filled = options.map((o) => o.trim()).filter(Boolean);
    if (!hostName.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (filled.length < 2) {
      setError("Add at least 2 options.");
      return;
    }
    setError(null);
    await onCreate(hostName.trim(), filled);
  };

  return (
    <main className="placemat mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-5 py-8">
      <Link href="/" className="font-display text-lg font-bold">
        🍜 whatToEat
      </Link>
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

      {options.map((o, i) => (
        <label key={i} className="flex flex-col gap-1 text-sm font-semibold">
          {`Option ${i + 1}`}
          <input
            className="tile-sm bg-white px-3 py-2 font-medium outline-none"
            placeholder={i === 0 ? "Sushi place" : i === 1 ? "That noodle spot" : "Another option"}
            value={o}
            onChange={(e) => setOption(i, e.target.value)}
          />
        </label>
      ))}

      <button
        type="button"
        onClick={() => setOptions((p) => [...p, ""])}
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
