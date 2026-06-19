"use client";

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
    if (!hostName.trim()) { setError("Please enter your name."); return; }
    if (filled.length < 2) { setError("Add at least 2 options."); return; }
    setError(null);
    await onCreate(hostName.trim(), filled);
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 p-6">
      <h1 className="text-2xl font-bold">Quick group vote</h1>
      <label className="text-sm">Your name
        <input className="mt-1 w-full rounded border px-3 py-2" value={hostName}
          onChange={(e) => setHostName(e.target.value)} />
      </label>
      {options.map((o, i) => (
        <label key={i} className="text-sm">{`Option ${i + 1}`}
          <input className="mt-1 w-full rounded border px-3 py-2" value={o}
            onChange={(e) => setOption(i, e.target.value)} />
        </label>
      ))}
      <button type="button" onClick={() => setOptions((p) => [...p, ""])}
        className="self-start text-sm text-blue-600">+ Add option</button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="button" onClick={submit}
        className="rounded-xl bg-gray-900 px-4 py-2 font-medium text-white">Start vote</button>
    </div>
  );
}
