export interface VoteOption {
  id: string;
  sessionId: string;
  placeId: string | null;
  name: string;
  snapshot: unknown;
}

export interface Vote {
  id: string;
  sessionId: string;
  optionId: string;
  voterName: string;
  type: "up" | "veto";
  createdAt: string;
}

export interface VoteSession {
  id: string;
  hostName: string;
  status: "open" | "closed";
  winnerOptionId: string | null;
  expiresAt: string;
}

export interface Tally {
  [optionId: string]: { up: number; veto: number };
}
