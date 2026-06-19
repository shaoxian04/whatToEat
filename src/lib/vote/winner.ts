import type { VoteOption, Vote, Tally } from "@/lib/vote/types";

export function tallyVotes(options: VoteOption[], votes: Vote[]): Tally {
  const tally: Tally = {};
  for (const o of options) tally[o.id] = { up: 0, veto: 0 };
  for (const v of votes) {
    if (!tally[v.optionId]) continue;
    if (v.type === "up") tally[v.optionId].up += 1;
    else tally[v.optionId].veto += 1;
  }
  return tally;
}

export function computeWinner(
  options: VoteOption[],
  votes: Vote[],
  rng: () => number = Math.random,
): string | null {
  const tally = tallyVotes(options, votes);
  const eligible = options.filter((o) => tally[o.id].veto === 0);
  if (eligible.length === 0) return null;
  const max = Math.max(...eligible.map((o) => tally[o.id].up));
  const leaders = eligible.filter((o) => tally[o.id].up === max);
  return leaders[Math.floor(rng() * leaders.length)].id;
}
