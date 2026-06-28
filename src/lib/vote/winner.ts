import type { VoteOption, Vote, Tally } from "@/lib/vote/types";

export function tallyVotes(options: VoteOption[], votes: Vote[]): Tally {
  const tally: Tally = {};
  for (const o of options) tally[o.id] = { up: 0 };
  for (const v of votes) {
    if (!tally[v.optionId]) continue;
    tally[v.optionId].up += 1;
  }
  return tally;
}

export function computeWinner(
  options: VoteOption[],
  votes: Vote[],
  rng: () => number = Math.random,
): string | null {
  if (options.length === 0) return null;
  const tally = tallyVotes(options, votes);
  const max = Math.max(...options.map((o) => tally[o.id].up));
  const leaders = options.filter((o) => tally[o.id].up === max);
  return leaders[Math.floor(rng() * leaders.length)].id;
}
