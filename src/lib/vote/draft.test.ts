import { describe, it, expect, beforeEach } from "vitest";
import { saveDraft, loadDraft, clearDraft, type DraftOption } from "@/lib/vote/draft";

const KEY = "whattoeat:vote-draft";
const pick = (placeId: string, name: string): DraftOption => ({
  name, placeId,
  snapshot: { placeId, name, rating: 4, priceLevel: 2, lat: 0, lng: 0, openNow: true, photoRef: null },
});

describe("vote draft storage", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("round-trips saved options", () => {
    const opts = [pick("a", "Alpha"), pick("b", "Beta")];
    saveDraft(opts);
    expect(loadDraft()).toEqual(opts);
  });

  it("returns [] when nothing is stored", () => {
    expect(loadDraft()).toEqual([]);
  });

  it("returns [] on malformed JSON", () => {
    window.sessionStorage.setItem(KEY, "{not json");
    expect(loadDraft()).toEqual([]);
  });

  it("drops entries missing required fields or a valid snapshot", () => {
    window.sessionStorage.setItem(KEY, JSON.stringify([
      pick("a", "Alpha"),
      { name: "NoPlace" },
      { placeId: "c", name: "BadSnap", snapshot: 5 },
    ]));
    expect(loadDraft()).toEqual([pick("a", "Alpha")]);
  });

  it("clears the draft", () => {
    saveDraft([pick("a", "Alpha")]);
    clearDraft();
    expect(loadDraft()).toEqual([]);
  });
});
