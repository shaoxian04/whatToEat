import type { RestaurantSnapshot } from "@/lib/vote/snapshot";
import { parseSnapshot } from "@/lib/vote/snapshot";

const KEY = "whattoeat:vote-draft";
const MAX_OPTIONS = 50;

export interface DraftOption {
  name: string;
  placeId: string;
  snapshot: RestaurantSnapshot;
}

export function saveDraft(options: DraftOption[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(options.slice(0, MAX_OPTIONS)));
  } catch {
    /* storage unavailable — ignore */
  }
}

export function loadDraft(): DraftOption[] {
  if (typeof window === "undefined") return [];
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: DraftOption[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.name !== "string" || typeof o.placeId !== "string") continue;
    const snapshot = parseSnapshot(o.snapshot);
    if (!snapshot) continue;
    out.push({ name: o.name, placeId: o.placeId, snapshot });
    if (out.length >= MAX_OPTIONS) break;
  }
  return out;
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
