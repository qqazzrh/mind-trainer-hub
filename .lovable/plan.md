## Goal
Randomize quadrant assignment per round so a member gets different quadrants across rounds, while guaranteeing every quadrant (TL, TR, BL, BR) is assigned to exactly one member each round — nothing left behind, nothing duplicated.

## Change
In `src/routes/the-grid.tsx`:

Replace `getQuads(count, mi)` with `getQuadAssignments(count)` that returns an array of length `count` whose flattened union is exactly `[0,1,2,3]` (every quadrant covered once):

- **1 member** → `[[0,1,2,3]]`
- **2 members** → shuffle `[0,1,2,3]`, split into two pairs → `[[a,b],[c,d]]`
- **3 members** → shuffle `[0,1,2,3]` into `[a,b,c,d]`, then randomly pick which member gets the 2-quad chunk → e.g. `[[a],[b,c],[d]]` with the pair position randomized among the 3 members
- **4 members** → random permutation of `[[0],[1],[2],[3]]`

Then shuffle the resulting array so member index ↔ quadrant mapping changes round to round.

In the queue-building loop (line ~324), call `getQuadAssignments(teamList[ti].count)` once per team per round and assign `quadrants: assignments[mi]` to each member.

Invariant enforced: `assignments.flat().sort()` always equals `[0,1,2,3]` — no quadrant is ever skipped or duplicated.

This re-randomizes every round (practice included).
