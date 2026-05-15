# Brain Gym Exercise App — Build Plan

A facilitator-led tablet app for two brain training exercises. Facilitator picks their name, manages participants, then runs either game in any order.

## Tech & backend

- TanStack Start + Tailwind on the existing template
- Lovable Cloud (Supabase) for all data
- ElevenLabs API for StorySync narration (you'll provide the API key as a secret)

## Database (Lovable Cloud)

- `facilitators` — `id`, `facilitator_id` (FAC-XXX), `name`. Seeded with the 6 from your CSV.
- `participants` — `id`, `participant_id` (e.g. P-001), `name`, timestamps. Managed in-app.
- `participant_scores` — long-term contribution scores per participant per session/round (StorySync §3.2).
- `sessions` — game type (`story_sync` | `the_grid`), facilitator_id, started_at, ended_at, config JSON, final state JSON.
- `rounds` — session_id, round number, difficulty, scores, raw round data JSON (covers both games' data models).
- `stories` — pre-written story library for StorySync (≥25 per difficulty, seeded over time).
- `coaching_prompts` — StorySync coaching pattern library.

RLS: tables readable/writable only by an authenticated user. Since facilitators don't log in with a real account, we use a single anon-allowed policy gated by an app-level "active facilitator" selection (acceptable for an internal tool — flagging this trade-off).

## Screens

**Shared**
- Facilitator Select — pick from list of 6, sets active facilitator in app state, persists to localStorage.
- Home — two big cards: "Story Sync" / "The Grid", plus links to Participants, Session History, Participant Lookup.
- Participants — list, add, edit, delete (id + name), CSV import.

**Story Sync (PRD v1.1)**
- Session Setup → Round Setup → Story Generation/Preview → Listening Phase (sequential headphone playback via ElevenLabs TTS) → Recall Instruction → Collaboration (timer, hide/show) → Team Response → Scoring (5 dimensions, distractor flags) → Coaching → Round Summary → Session Results → Session History → Participant Lookup.
- Adaptive difficulty engine (rolling 2-round avg, L1–L4).
- Multi-group mode toggle.
- Recall instruction types per PRD §7.

**The Grid (PRD v3)**
- Session Setup (2 teams, 2–4 players each, names, sections) → Round Setup (difficulty, viewing time, optional drawing timer) → Grid Display (canonical layouts L/R, L/C/R, 2×2) → Viewing Timer with audio cues → Drawing Phase → Answer Reveal → Scoring (cells correct) → Round Summary (divergent recommendation handling) → Session Results (head-to-head bar, adaptive path) → Session History.
- Pattern generator per difficulty (3×3 → 6×6, 1–3 colors, density bands).
- Audio cues via Web Audio API (start tone, 3-2-1 countdown, end tone).

## Implementation order

1. DB schema + seed facilitators from CSV
2. Facilitator select + Home + Participants CRUD
3. The Grid full flow (no external API needed → ships first)
4. Story Sync flow with text-only fallback
5. ElevenLabs TTS server function (key requested via secret) + Listening Phase audio
6. Adaptive difficulty + coaching prompts + session history + participant lookup
7. Polish, audio cues, edge cases (offline restore, cancel round, etc.)

## Things I'll need from you mid-build

- ElevenLabs API key — I'll request it as a secret when we get to step 5
- Story library content (or I'll seed ~25 per level with generated narratives during step 4)

## Out of scope for v1

- Real authentication / passwords (simple name picker per your choice)
- Sync to external participant database (local DB only; PRD calls this a future milestone)
- AI-generated stories (PRD marks as v2)
