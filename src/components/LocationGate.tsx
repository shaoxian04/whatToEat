"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { searchAreaCoords } from "@/lib/api/nearby-client";
import { BackHome } from "@/components/BackHome";
import type { LatLng } from "@/lib/decision/types";

export interface ResolvedLocation {
  coords: LatLng;
  label: string;
  changeArea: () => void;
}

interface Props {
  children: (loc: ResolvedLocation) => ReactNode;
  searchArea?: typeof searchAreaCoords; // test hook
}

// Resolves where to search: the device location when allowed, otherwise (or on
// request) a typed area/address, so a denied permission isn't a dead end.
export function LocationGate({ children, searchArea = searchAreaCoords }: Props) {
  const geo = useGeolocation();
  const { request } = geo;
  const [manual, setManual] = useState<{ coords: LatLng; label: string } | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    request();
  }, [request]);

  const changeArea = () => setSearching(true);

  if (!searching && manual) return <>{children({ ...manual, changeArea })}</>;
  if (!searching && geo.coords) {
    return <>{children({ coords: geo.coords, label: "Your location", changeArea })}</>;
  }
  // No coords and no error yet: the request is pending (or about to start).
  if (!searching && !geo.error) {
    return (
      <main className="placemat flex min-h-screen flex-col items-center justify-center gap-3 px-5 text-center">
        <p className="text-5xl">📍</p>
        <p className="font-display text-xl font-bold">Requesting your location…</p>
        <button type="button" onClick={changeArea} className="font-mono text-sm font-bold text-tomato-ink underline">
          Type an area instead
        </button>
      </main>
    );
  }

  return (
    <AreaSearch
      notice={searching ? null : geo.error}
      searchArea={searchArea}
      onUseDevice={() => {
        setManual(null);
        setSearching(false);
        request();
      }}
      onFound={(found) => {
        setManual(found);
        setSearching(false);
      }}
    />
  );
}

interface AreaSearchProps {
  notice: string | null;
  searchArea: typeof searchAreaCoords;
  onFound: (loc: { coords: LatLng; label: string }) => void;
  onUseDevice: () => void;
}

function AreaSearch({ notice, searchArea, onFound, onUseDevice }: AreaSearchProps) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      setError("Enter an area or address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const found = await searchArea(q);
      onFound({ coords: { lat: found.lat, lng: found.lng }, label: found.label });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not search for that place.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="placemat mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-5 py-8">
      <BackHome />
      <div className="flex flex-1 flex-col justify-center gap-4">
        <p className="text-5xl">📍</p>
        <h1 className="font-display text-2xl font-extrabold leading-tight">Where are you eating?</h1>
        {notice && <p className="text-sm text-ink-soft">{notice} You can type an area instead.</p>}
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Area or address
            <input
              className="tile-sm bg-white px-3 py-2 font-medium outline-none"
              placeholder="e.g. Bukit Bintang, KL"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </label>
          {error && (
            <p role="alert" className="tile-sm bg-tomato/15 px-3 py-2 text-sm font-semibold text-tomato-ink">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="tile tile-press bg-herb px-4 py-3 font-display text-lg font-bold text-ink disabled:opacity-60"
          >
            {busy ? "Searching…" : "Find food here"}
          </button>
        </form>
        <button type="button" onClick={onUseDevice} className="self-start font-mono text-sm font-bold text-tomato-ink underline">
          Use my current location
        </button>
      </div>
    </main>
  );
}
