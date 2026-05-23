import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFacilitator } from "@/lib/facilitator-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/the-grid")({
  component: TheGrid,
  head: () => ({ meta: [{ title: "The Grid — Brain Gym" }] }),
});

// ─────────── Types ───────────
type Member = { name: string; participantId?: string };
type Team = { name: string; members: Member[]; count: number };
type ExistingParticipant = { id: string; participant_id: string; name: string };
type QueueItem = { teamIdx: number; memberIdx: number; quadrants: number[] };
type QueueEntry = { memberIdx: number; pair: QueueItem[] };
type MemberScore = {
  name: string;
  quadrants: number[];
  correct: number;
  wrong: number;
  missed: number;
  total: number;
  filled: number;
  pct: number;
};
type RoundScore = {
  totalCorrect: number;
  totalWrong: number;
  totalMissed: number;
  pct: number;
  memberScores: MemberScore[];
};
type Screen =
  | "setup"
  | "queue"
  | "viewing"
  | "qreveal"
  | "drawing"
  | "scoring"
  | "results"
  | "final";

const QABBR = ["TL", "TR", "BL", "BR"];

const TIPS = {
  low_accuracy: [
    "Try chunking: break your quadrant into a 2×2 block and memorise one block at a time rather than scanning every cell.",
    "Count the filled cells first — knowing there are 'about 8 black boxes' gives your brain an anchor before you try to place them.",
    "Focus on the edges of your quadrant first. Edge patterns are easier to anchor than the interior.",
  ],
  low_order: [
    "Before drawing, agree on who fills in which quadrant first — don't all draw at once or you'll talk over each other.",
    "One person should call out their quadrant aloud while the others listen before anyone draws.",
    "Use a simple left-to-right, top-to-bottom scan order when memorising.",
  ],
  missed_boxes: [
    "If you're not sure about a box, leave it blank — a wrong shaded box costs more than a missed one.",
    "Double-check the borders of your section. Boundary cells are the most commonly missed.",
    "Only shade a box if at least one person is certain. Guessing hurts your score.",
  ],
  good_performance: [
    "Great round! Try recalling the pattern in reverse — bottom to top — next time to stress-test your memory.",
    "You're ready for harder grids. Each member silently memorises before the group shares.",
    "Strong performance. Reduce your drawing time next round — speed adds cognitive pressure.",
  ],
};
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

// ─────────── Helpers ───────────
function generateGrid(n: number): number[][] {
  const g: number[][] = [];
  for (let r = 0; r < n; r++) {
    g[r] = [];
    for (let c = 0; c < n; c++) g[r][c] = Math.random() < 0.42 ? 1 : 0;
  }
  return g;
}
function getQuads(count: number, mi: number): number[] {
  if (count === 1) return [0, 1, 2, 3];
  if (count === 2) return mi === 0 ? [0, 1] : [2, 3];
  if (count === 3) return mi === 0 ? [0] : mi === 1 ? [1, 2] : [3];
  return [mi];
}

// ─────────── Component ───────────
function TheGrid() {
  const { facilitator, hydrated } = useFacilitator();
  const navigate = useNavigate();
  useEffect(() => {
    if (hydrated && !facilitator) navigate({ to: "/" });
  }, [facilitator, hydrated, navigate]);

  // setup form
  const [team1Name, setTeam1Name] = useState("Team Alpha");
  const [team2Name, setTeam2Name] = useState("Team Beta");
  const [count1, setCount1] = useState(2);
  const [count2, setCount2] = useState(2);
  const [members1, setMembers1] = useState<string[]>(["", "", "", ""]);
  const [members2, setMembers2] = useState<string[]>(["", "", "", ""]);
  const [gridSizeCfg, setGridSizeCfg] = useState(6);
  const [viewTimeCfg, setViewTimeCfg] = useState(8);
  const [drawTimeCfg, setDrawTimeCfg] = useState(120);
  const [sessionDur, setSessionDur] = useState(30);

  // game state
  const [screen, setScreen] = useState<Screen>("setup");
  const [teams, setTeams] = useState<Team[]>([]);
  const [gridSize, setGridSize] = useState(6);
  const [viewTime, setViewTime] = useState(8);
  const [drawTime, setDrawTime] = useState(120);
  const [maxRounds, setMaxRounds] = useState(4);
  const [round, setRound] = useState(0);
  const [isPractice, setIsPractice] = useState(true);
  const [difficulty, setDifficulty] = useState(1);
  const [grids, setGrids] = useState<number[][][]>([]);
  const [gridCount, setGridCount] = useState(1);
  const [currentGridIdx, setCurrentGridIdx] = useState(0);
  const [recallGridIdx, setRecallGridIdx] = useState(0);
  const [viewQueue, setViewQueue] = useState<QueueEntry[]>([]);
  const [queuePos, setQueuePos] = useState(0);
  const [revealPos, setRevealPos] = useState(0);
  const [showCover, setShowCover] = useState(false);
  const [coverName, setCoverName] = useState("");
  const [coverInstruction, setCoverInstruction] = useState("");
  const coverCbRef = useRef<(() => void) | null>(null);
  const [viewTimerLeft, setViewTimerLeft] = useState(0);
  const [drawTimerLeft, setDrawTimerLeft] = useState(0);
  const [scoringTeam, setScoringTeam] = useState(0);
  const [scoringInputs, setScoringInputs] = useState<number[][][]>([]);
  const [roundScores, setRoundScores] = useState<RoundScore[]>([]);
  const [sessionScores, setSessionScores] = useState<number[]>([0, 0]);
  const [diffChange, setDiffChange] = useState<"up" | "down" | "same">("same");
  const [tips, setTips] = useState<{ team: string; text: string }[]>([]);
  const [endModal, setEndModal] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [existingParticipants, setExistingParticipants] = useState<ExistingParticipant[]>([]);

  // Load existing participants from DB (refetches whenever we land on setup)
  const loadParticipants = async () => {
    const { data } = await supabase
      .from("participants")
      .select("id, participant_id, name")
      .order("name", { ascending: true })
      .limit(1000);
    if (data) setExistingParticipants(data as ExistingParticipant[]);
  };
  useEffect(() => {
    if (screen === "setup") loadParticipants();
  }, [screen]);

  // Calc rounds
  const roundMinutes = useMemo(() => {
    const viewSlots = count1 + count2;
    const handoff = 18;
    const scoring = 2 * 90;
    return (viewSlots * (viewTimeCfg + handoff) + drawTimeCfg + scoring) / 60;
  }, [count1, count2, viewTimeCfg, drawTimeCfg]);
  const estRounds = Math.max(1, Math.floor(sessionDur / roundMinutes));

  // ─────────── Viewing timer ───────────
  useEffect(() => {
    if (screen !== "viewing") return;
    if (showCover) return;
    const id = setInterval(() => {
      setViewTimerLeft((v) => {
        if (v <= 1) {
          // grid done
          if (gridCount > 1 && currentGridIdx < gridCount - 1) {
            setCurrentGridIdx((i) => i + 1);
            return viewTime;
          }
          // advance to reveal
          clearInterval(id);
          setTimeout(() => setScreen("qreveal"), 0);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [screen, showCover, gridCount, currentGridIdx, viewTime]);

  // ─────────── Drawing timer ───────────
  useEffect(() => {
    if (screen !== "drawing") return;
    if (drawTimerLeft <= 0) {
      setScreen("scoring");
      setupScoring();
      return;
    }
    const id = setTimeout(() => setDrawTimerLeft((v) => v - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, drawTimerLeft]);

  // ─────────── Setup actions ───────────
  const updateMember = (team: 1 | 2, idx: number, val: string) => {
    const arr = team === 1 ? [...members1] : [...members2];
    arr[idx] = val;
    team === 1 ? setMembers1(arr) : setMembers2(arr);
  };

  const startGame = async () => {
    const slug = (s: string) =>
      s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "member";
    const rand = () => Math.random().toString(36).slice(2, 7);

    // Resolve a member name → ExistingParticipant (creating one if needed)
    const byName = new Map(existingParticipants.map((p) => [p.name.trim().toLowerCase(), p]));
    const toCreate: { participant_id: string; name: string }[] = [];
    const resolveMember = (rawName: string, fallbackIdx: number): Member => {
      const name = (rawName || `Member ${fallbackIdx + 1}`).trim();
      const existing = byName.get(name.toLowerCase());
      if (existing) return { name: existing.name, participantId: existing.participant_id };
      const participant_id = `p_${slug(name)}_${rand()}`;
      toCreate.push({ participant_id, name });
      // Cache so duplicate names within the same form reuse the same id
      byName.set(name.toLowerCase(), { id: "", participant_id, name });
      return { name, participantId: participant_id };
    };

    const t1: Team = {
      name: team1Name || "Team 1",
      count: count1,
      members: Array.from({ length: count1 }, (_, i) => resolveMember(members1[i], i)),
    };
    const t2: Team = {
      name: team2Name || "Team 2",
      count: count2,
      members: Array.from({ length: count2 }, (_, i) => resolveMember(members2[i], i)),
    };
    setTeams([t1, t2]);
    setMaxRounds(estRounds);
    setSessionScores([0, 0]);
    setDifficulty(1);
    setIsPractice(true);
    setRound(0);

    // Insert any newly-created participants
    try {
      if (toCreate.length) {
        const { data } = await supabase
          .from("participants")
          .upsert(toCreate, { onConflict: "participant_id", ignoreDuplicates: false })
          .select("id, participant_id, name");
        if (data) {
          setExistingParticipants((prev) => {
            const seen = new Set(prev.map((p) => p.participant_id));
            return [...prev, ...(data as ExistingParticipant[]).filter((p) => !seen.has(p.participant_id))];
          });
        }
      }
    } catch {}

    // Persist session
    try {
      const { data, error } = await supabase
        .from("sessions")
        .insert({
          game_type: "the_grid",
          facilitator_id: facilitator?.id ?? null,
          config: {
            teams: [t1, t2],
            gridSize: gridSizeCfg,
            viewTime: viewTimeCfg,
            drawTime: drawTimeCfg,
            sessionDuration: sessionDur,
            maxRounds: estRounds,
          },
          status: "in_progress",
        })
        .select("id")
        .single();
      if (!error && data) setSessionId(data.id);
    } catch {}

    startRound([t1, t2], 1, true);
  };

  const startRound = (teamList: Team[], diff: number, practice: boolean) => {
    let n = gridSizeCfg;
    let vt = viewTimeCfg;
    let gc = 1;
    if (practice) {
      n = 4;
      vt = 10;
      gc = 1;
    } else {
      const cfgs = [
        { size: 6, viewTime: 10 },
        { size: 8, viewTime: 8 },
        { size: 8, viewTime: 6 },
        { size: 10, viewTime: 5 },
      ];
      const cfg = cfgs[Math.min(3, diff - 1)];
      n = cfg.size;
      vt = cfg.viewTime;
      gc = diff <= 2 ? 1 : diff === 3 ? 2 : 3;
    }
    setGridSize(n);
    setViewTime(vt);
    setGridCount(gc);
    const newGrids: number[][][] = [];
    for (let g = 0; g < gc; g++) newGrids.push(generateGrid(n));
    setGrids(newGrids);
    setRecallGridIdx(gc > 1 ? Math.floor(Math.random() * gc) : 0);

    // Build queue
    const max = Math.max(teamList[0].count, teamList[1].count);
    const q: QueueEntry[] = [];
    for (let mi = 0; mi < max; mi++) {
      const pair: QueueItem[] = [];
      for (let ti = 0; ti < 2; ti++) {
        if (mi < teamList[ti].count) {
          pair.push({ teamIdx: ti, memberIdx: mi, quadrants: getQuads(teamList[ti].count, mi) });
        }
      }
      if (pair.length) q.push({ memberIdx: mi, pair });
    }
    setViewQueue(q);
    setQueuePos(0);
    setRevealPos(0);
    setScreen("queue");
  };

  // ─────────── Viewing flow ───────────
  const beginCover = (name: string, instruction: string, cb: () => void) => {
    setCoverName(name);
    setCoverInstruction(instruction);
    coverCbRef.current = cb;
    setShowCover(true);
  };
  const hideCover = () => {
    setShowCover(false);
    const cb = coverCbRef.current;
    coverCbRef.current = null;
    if (cb) cb();
  };

  const startNextViewing = () => {
    if (queuePos >= viewQueue.length) {
      startDrawingPhase();
      return;
    }
    const entry = viewQueue[queuePos];
    setRevealPos(0);
    const names = entry.pair.map((it) => teams[it.teamIdx].members[it.memberIdx].name).join(" & ");
    const tns = entry.pair.map((it) => teams[it.teamIdx].name).join(" + ");
    beginCover(names, `Both step up together — ${tns}`, () => {
      setCurrentGridIdx(0);
      setViewTimerLeft(viewTime);
      setScreen("viewing");
    });
  };

  const afterReveal = () => {
    const entry = viewQueue[queuePos];
    const nextPos = revealPos + 1;
    if (entry && nextPos < entry.pair.length) {
      const nextItem = entry.pair[nextPos];
      const nm = teams[nextItem.teamIdx].members[nextItem.memberIdx];
      const tm = teams[nextItem.teamIdx];
      beginCover(nm.name, `Hand the iPad to ${nm.name} — ${tm.name}`, () => {
        setRevealPos(nextPos);
        setScreen("qreveal");
      });
    } else {
      const newPos = queuePos + 1;
      setQueuePos(newPos);
      setRevealPos(0);
      if (newPos >= viewQueue.length) startDrawingPhase();
      else setScreen("queue");
    }
  };

  // ─────────── Drawing ───────────
  const startDrawingPhase = () => {
    setDrawTime(drawTimeCfg);
    setDrawTimerLeft(drawTimeCfg);
    setScreen("drawing");
  };

  // ─────────── Scoring ───────────
  const setupScoring = () => {
    const n = gridSize;
    const empty = () =>
      Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
    setScoringInputs([empty(), empty()]);
    setScoringTeam(0);
  };

  const toggleScoringCell = (r: number, c: number) => {
    setScoringInputs((prev) => {
      const next = prev.map((m) => m.map((row) => [...row]));
      next[scoringTeam][r][c] = next[scoringTeam][r][c] ? 0 : 1;
      return next;
    });
  };

  const confirmScores = async () => {
    const recall = grids[recallGridIdx];
    const n = gridSize;
    const half = n / 2;
    const results: RoundScore[] = teams.map((team, ti) => {
      const tapped = scoringInputs[ti];
      let totalCorrect = 0, totalWrong = 0, totalMissed = 0;
      const memberScores: MemberScore[] = team.members.map((member, mi) => {
        const entry = viewQueue.find((e) => e.memberIdx === mi);
        const item = entry?.pair.find((p) => p.teamIdx === ti);
        const quads = item?.quadrants ?? [];
        let correct = 0, wrong = 0, missed = 0, total = 0, filled = 0;
        quads.forEach((q) => {
          const rS = q < 2 ? 0 : half, rE = q < 2 ? half : n;
          const cS = q % 2 === 0 ? 0 : half, cE = q % 2 === 0 ? half : n;
          for (let r = rS; r < rE; r++) for (let c = cS; c < cE; c++) {
            total++;
            const actual = recall[r][c];
            const sub = tapped[r][c];
            if (actual === 1) filled++;
            if (actual === 1 && sub === 1) correct++;
            else if (actual === 0 && sub === 1) wrong++;
            else if (actual === 1 && sub === 0) missed++;
          }
        });
        totalCorrect += correct; totalWrong += wrong; totalMissed += missed;
        const denom = filled + wrong;
        const pct = denom > 0 ? Math.round((correct / denom) * 100) : 0;
        return { name: member.name, quadrants: quads, correct, wrong, missed, total, filled, pct };
      });
      let totalFilled = 0;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (recall[r][c] === 1) totalFilled++;
      const denom = totalFilled + totalWrong;
      const pct = denom > 0 ? Math.round((totalCorrect / denom) * 100) : 0;
      return { totalCorrect, totalWrong, totalMissed, pct, memberScores };
    });
    setRoundScores(results);

    // Adaptive + persistence
    let nextDiff = difficulty;
    let dc: "up" | "down" | "same" = "same";
    if (!isPractice) {
      const maxPct = Math.max(results[0].pct, results[1].pct);
      if (maxPct >= 85) { nextDiff = Math.min(4, difficulty + 1); dc = "up"; }
      else if (maxPct < 60) { nextDiff = Math.max(1, difficulty - 1); dc = "down"; }
      setSessionScores(([a, b]) => [a + results[0].pct, b + results[1].pct]);
    }
    setDifficulty(nextDiff);
    setDiffChange(dc);
    generateTipsFor(results);

    // Persist round + participant scores
    if (sessionId) {
      try {
        await supabase.from("rounds").insert({
          session_id: sessionId,
          round_number: round,
          difficulty,
          data: { isPractice, gridSize: n, gridCount, recallGridIdx, grids, teams, viewQueue },
          scores: { results, sessionScores },
        });
        const rows: {
          participant_id: string;
          session_id: string;
          round_number: number;
          score: number;
          dimension: string;
        }[] = [];
        results.forEach((rs, ti) => {
          rs.memberScores.forEach((ms) => {
            const m = teams[ti].members.find((mm) => mm.name === ms.name);
            rows.push({
              participant_id: m?.participantId ?? `${teams[ti].name}::${ms.name}`,
              session_id: sessionId,
              round_number: round,
              score: ms.pct,
              dimension: "grid_accuracy",
            });
          });
        });
        if (rows.length) await supabase.from("participant_scores").insert(rows);
      } catch {}
    }

    setScreen("results");
  };

  const generateTipsFor = (rs: RoundScore[]) => {
    const out: { team: string; text: string }[] = [];
    teams.forEach((team, ti) => {
      const r = rs[ti];
      const pct = r.pct;
      const ts: string[] = [];
      if (pct < 60) {
        ts.push(pick(TIPS.low_accuracy));
        if (r.totalWrong > r.totalMissed) ts.push(pick(TIPS.missed_boxes));
        else ts.push(pick(TIPS.low_order));
      } else if (pct < 80) {
        if (r.totalWrong > 2) ts.push(pick(TIPS.missed_boxes));
        const weak = r.memberScores.reduce((a, b) => (a.pct < b.pct ? a : b), r.memberScores[0]);
        if (weak && weak.pct < pct - 20) ts.push(pick(TIPS.low_order));
        if (ts.length === 0) ts.push(pick(TIPS.low_accuracy));
      } else {
        ts.push(pick(TIPS.good_performance));
      }
      ts.forEach((t) => out.push({ team: team.name, text: t }));
    });
    setTips(out);
  };

  const nextRound = () => {
    let newRound = round;
    if (isPractice) {
      setIsPractice(false);
      newRound = 1;
    } else {
      newRound = round + 1;
    }
    setRound(newRound);
    startRound(teams, difficulty, false);
  };

  const confirmEndSession = () => setEndModal(true);
  const endSessionConfirmed = async () => {
    setEndModal(false);
    if (sessionId) {
      try {
        await supabase
          .from("sessions")
          .update({ status: "ended", ended_at: new Date().toISOString() })
          .eq("id", sessionId);
      } catch {}
    }
    setScreen("final");
  };

  // ─────────── Render ───────────
  return (
    <div style={{ background: "#0a0a0a", color: "#f5f5f0", minHeight: "100vh", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;700&display=swap');
        .tg-screen { animation: tg-fade .22s ease; }
        @keyframes tg-fade { from { opacity:0; transform:translateY(12px);} to { opacity:1; transform:translateY(0);} }
        .tg-btn-primary { background:#e8ff47; color:#0a0a0a; border:none; border-radius:12px; font-family:'Space Mono',monospace; font-size:15px; font-weight:700; letter-spacing:1px; padding:18px; cursor:pointer; text-transform:uppercase; width:100%; }
        .tg-btn-primary:active { opacity:.85; transform:scale(.98); }
        .tg-btn-secondary { background:transparent; color:#f5f5f0; border:1px solid #333; border-radius:12px; font-family:'Space Mono',monospace; font-size:13px; padding:14px; cursor:pointer; width:100%; }
        .tg-seg-btn { flex:1; padding:8px 4px; border-radius:6px; border:none; background:transparent; color:#666; font-family:'Space Mono',monospace; font-size:11px; cursor:pointer; }
        .tg-seg-btn.active { background:#e8ff47; color:#0a0a0a; font-weight:700; }
        .tg-input { background:#2a2a2a; border:1px solid #333; border-radius:8px; color:#f5f5f0; font-family:'DM Sans',sans-serif; font-size:16px; padding:11px 14px; width:100%; outline:none; }
        .tg-input:focus { border-color:#e8ff47; }
      `}</style>

      {/* Back link */}
      {screen === "setup" && (
        <div style={{ padding: "16px 24px 0" }}>
          <Link to="/" style={{ color: "#666", textDecoration: "none", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={14} /> Back
          </Link>
        </div>
      )}

      {/* COVER */}
      {showCover && (
        <div style={{ position: "fixed", inset: 0, background: "#0a0a0a", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 22, textAlign: "center", padding: 44 }}>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 48, fontWeight: 700, letterSpacing: -2, color: "#e8ff47", lineHeight: 1 }}>THE<br />GRID</div>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 28, fontWeight: 700 }}>{coverName}</div>
          <div style={{ fontSize: 14, color: "#666" }}>{coverInstruction}</div>
          <button className="tg-btn-primary" style={{ maxWidth: 300 }} onClick={hideCover}>I'M READY →</button>
        </div>
      )}

      {/* SETUP */}
      {screen === "setup" && (
        <div className="tg-screen" style={{ padding: "20px 28px 40px", display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 38, fontWeight: 700, letterSpacing: -2, color: "#e8ff47", lineHeight: 1 }}>THE<span style={{ color: "#f5f5f0" }}>GRID</span></div>
            <div style={{ fontSize: 12, color: "#666", letterSpacing: 2, textTransform: "uppercase", marginTop: 4 }}>Memory · Recall · Precision</div>
          </div>
          <div style={{ background: "rgba(232,255,71,0.08)", border: "1px solid rgba(232,255,71,0.25)", borderRadius: 12, padding: "14px 18px", fontSize: 13, color: "#ccc", lineHeight: 1.5 }}>
            <strong style={{ color: "#e8ff47" }}>Practice Round Included</strong> — The session starts with one practice round so both teams learn the flow before scores count.
          </div>

          {/* Teams */}
          {([1, 2] as const).map((t) => {
            const name = t === 1 ? team1Name : team2Name;
            const setName = t === 1 ? setTeam1Name : setTeam2Name;
            const count = t === 1 ? count1 : count2;
            const setCount = t === 1 ? setCount1 : setCount2;
            const members = t === 1 ? members1 : members2;
            const dotColor = t === 1 ? "#e8ff47" : "#60a5fa";
            return (
              <div key={t} style={{ background: "#1a1a1a", borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 14, border: "1px solid #333" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 11, height: 11, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                  <input className="tg-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={`Team ${t} name`} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "#aaa" }}>Members</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <button onClick={() => setCount(Math.max(1, count - 1))} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #333", background: "#2a2a2a", color: "#f5f5f0", fontSize: 19, cursor: "pointer" }}>−</button>
                    <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 20, minWidth: 22, textAlign: "center", color: "#e8ff47" }}>{count}</div>
                    <button onClick={() => setCount(Math.min(4, count + 1))} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #333", background: "#2a2a2a", color: "#f5f5f0", fontSize: 19, cursor: "pointer" }}>+</button>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {Array.from({ length: count }).map((_, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", fontFamily: "'Space Mono',monospace", fontSize: 10, color: "#666" }}>{i + 1}</span>
                       {(() => {
                         const dedup = Array.from(
                           new Map(existingParticipants.map((p) => [p.name.toLowerCase(), p])).values()
                         );
                         const current = members[i] ?? "";
                         const isNew = !!current && !dedup.some((p) => p.name.toLowerCase() === current.toLowerCase());
                         // Exclude names already chosen in either team (except the current cell)
                         const taken = new Set<string>();
                         members1.forEach((n, idx) => { if (!(t === 1 && idx === i) && n && n.trim()) taken.add(n.trim().toLowerCase()); });
                         members2.forEach((n, idx) => { if (!(t === 2 && idx === i) && n && n.trim()) taken.add(n.trim().toLowerCase()); });
                         const available = dedup.filter((p) => !taken.has(p.name.toLowerCase()));
                         const selectVal = current === "" ? "" : isNew ? "__new__" : current;
                        return (
                          <>
                            <Select
                              value={selectVal || undefined}
                              onValueChange={(v) => {
                                if (v === "__new__") updateMember(t, i, " ");
                                else updateMember(t, i, v);
                              }}
                            >
                              <SelectTrigger
                                className="tg-input"
                                style={{ paddingLeft: 32, height: "auto", cursor: "pointer", background: "#0f0f0f", borderColor: "#333", color: "#f5f5f0" }}
                              >
                                <SelectValue placeholder="— Select participant —" />
                              </SelectTrigger>
                              <SelectContent style={{ background: "#1a1a1a", color: "#f5f5f0", borderColor: "#333", maxHeight: 320 }}>
                                {available.map((p) => (
                                  <SelectItem key={p.participant_id} value={p.name}>
                                    {p.name}
                                  </SelectItem>
                                ))}
                                <SelectItem value="__new__" style={{ color: "#e8ff47" }}>
                                  + Add new participant…
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            {isNew && (
                              <input
                                className="tg-input"
                                style={{ paddingLeft: 32, marginTop: 6 }}
                                value={current.trim()}
                                onChange={(e) => updateMember(t, i, e.target.value)}
                                placeholder="New participant name"
                                autoFocus
                              />
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <div style={{ display: "flex", gap: 10 }}>
            <ConfigCard label="Grid Size" options={[6, 8, 10]} value={gridSizeCfg} onChange={setGridSizeCfg} suffix="×" repeat />
            <ConfigCard label="View Time" options={[5, 8, 12]} value={viewTimeCfg} onChange={setViewTimeCfg} suffix="s" />
          </div>

          <div style={{ background: "#1a1a1a", borderRadius: 12, border: "1px solid #333", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#666" }}>Session Length</div>
                <div style={{ fontSize: 13, color: "#aaa", marginTop: 3 }}>~{estRounds} round{estRounds !== 1 ? "s" : ""} · ~{Math.round(roundMinutes)} min/round</div>
              </div>
            </div>
            <div style={{ display: "flex", background: "#2a2a2a", borderRadius: 8, padding: 3, gap: 2 }}>
              {[15, 30, 45, 60].map((v) => (
                <button key={v} className={`tg-seg-btn${sessionDur === v ? " active" : ""}`} onClick={() => setSessionDur(v)}>{v}m</button>
              ))}
            </div>
          </div>

          <div style={{ background: "#1a1a1a", borderRadius: 12, border: "1px solid #333", padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#666" }}>Draw Timer</div>
              <div style={{ fontSize: 13, color: "#aaa", marginTop: 3 }}>Team drawing phase</div>
            </div>
            <div style={{ display: "flex", background: "#2a2a2a", borderRadius: 8, padding: 3, gap: 2 }}>
              {[60, 120, 180].map((v) => (
                <button key={v} className={`tg-seg-btn${drawTimeCfg === v ? " active" : ""}`} onClick={() => setDrawTimeCfg(v)}>{v / 60}m</button>
              ))}
            </div>
          </div>

          <button className="tg-btn-primary" onClick={startGame}>START SESSION →</button>
        </div>
      )}

      {/* QUEUE */}
      {screen === "queue" && (
        <div className="tg-screen" style={{ padding: "44px 28px", display: "flex", flexDirection: "column", gap: 28, alignItems: "center", textAlign: "center", justifyContent: "center", minHeight: "100vh" }}>
          <div style={{ background: isPractice ? "rgba(232,255,71,0.1)" : "#1a1a1a", border: `1px solid ${isPractice ? "rgba(232,255,71,0.3)" : "#333"}`, borderRadius: 100, padding: "7px 18px", fontFamily: "'Space Mono',monospace", fontSize: 11, letterSpacing: 2, color: isPractice ? "#e8ff47" : "#666", textTransform: "uppercase" }}>
            {isPractice ? "PRACTICE ROUND" : `ROUND ${round}`}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, alignItems: "center" }}>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: "#666" }}>Viewing Order</div>
            <div style={{ fontSize: 12, color: "#666", maxWidth: 260, lineHeight: 1.5 }}>
              {isPractice ? "This round does not count toward scores. Learn the flow." : "Members pair up by position — both teams view together, then each gets their quadrant reveal."}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 400 }}>
            {viewQueue.map((entry, idx) => {
              const done = idx < queuePos, current = idx === queuePos;
              return (
                <div key={idx} style={{ background: "#1a1a1a", border: `1px solid ${current ? "#e8ff47" : "#333"}`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, fontSize: 15, opacity: done ? 0.32 : 1 }}>
                  <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: current ? "#e8ff47" : "#666", minWidth: 18 }}>{idx + 1}</div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    {entry.pair.map((it, i) => (
                      <span key={i}>
                        {i > 0 && <span style={{ color: "#666", margin: "0 6px" }}>+</span>}
                        <strong>{teams[it.teamIdx].members[it.memberIdx].name}</strong>{" "}
                        <span style={{ color: "#666", fontSize: 11 }}>{teams[it.teamIdx].name}</span>
                      </span>
                    ))}
                  </div>
                  {done && <div style={{ color: "#4ade80", fontSize: 17 }}>✓</div>}
                </div>
              );
            })}
          </div>
          <button className="tg-btn-primary" style={{ maxWidth: 380 }} onClick={startNextViewing}>
            {queuePos === 0 ? "BEGIN →" : "NEXT PAIR →"}
          </button>
        </div>
      )}

      {/* VIEWING */}
      {screen === "viewing" && grids[currentGridIdx] && (
        <ViewingScreen
          gridSize={gridSize}
          grid={grids[currentGridIdx]}
          viewTime={viewTime}
          timerLeft={viewTimerLeft}
          gridCount={gridCount}
          currentGridIdx={currentGridIdx}
          entry={viewQueue[queuePos]}
          teams={teams}
        />
      )}

      {/* QREVEAL */}
      {screen === "qreveal" && viewQueue[queuePos] && (
        <RevealScreen
          item={viewQueue[queuePos].pair[revealPos]}
          teams={teams}
          gridSize={gridSize}
          gridCount={gridCount}
          recallGridIdx={recallGridIdx}
          onDone={afterReveal}
        />
      )}

      {/* DRAWING */}
      {screen === "drawing" && (
        <div className="tg-screen" style={{ padding: "36px 28px", display: "flex", flexDirection: "column", gap: 24, alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: "100vh" }}>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#666" }}>{isPractice ? "Practice Round — Drawing Phase" : "Drawing Phase"}</div>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>RECONSTRUCT<br /><span style={{ color: "#e8ff47" }}>THE GRID</span></div>
          <div style={{ fontSize: 14, color: "#666", maxWidth: 300, lineHeight: 1.6 }}>All teams work on their physical sheets simultaneously. Reproduce the full grid from memory.</div>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 72, fontWeight: 700, lineHeight: 1, color: drawTimerLeft <= 10 ? "#f87171" : "#e8ff47" }}>
            {Math.floor(drawTimerLeft / 60)}:{(drawTimerLeft % 60).toString().padStart(2, "0")}
          </div>
          <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 7 }}>
            {teams.map((team, ti) => (
              <div key={ti}>
                <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#666", marginBottom: 3, paddingLeft: 3, marginTop: 8 }}>{team.name}</div>
                {team.members.map((m, mi) => {
                  const entry = viewQueue.find((e) => e.memberIdx === mi);
                  const item = entry?.pair.find((p) => p.teamIdx === ti);
                  if (!item) return null;
                  return (
                    <div key={mi} style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 9, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, textAlign: "left", marginTop: 6 }}>
                      <div style={{ fontSize: 14, flex: 1 }}>{m.name}</div>
                      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#e8ff47", background: "rgba(232,255,71,.1)", borderRadius: 5, padding: "3px 9px" }}>{item.quadrants.map((q) => QABBR[q]).join("+")}</div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <button className="tg-btn-primary" style={{ maxWidth: 380 }} onClick={() => { setScreen("scoring"); setupScoring(); }}>DONE DRAWING →</button>
        </div>
      )}

      {/* SCORING */}
      {screen === "scoring" && scoringInputs.length > 0 && (
        <div className="tg-screen" style={{ padding: "28px 20px 44px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 20, fontWeight: 700 }}>SCORE INPUT</div>
            <div style={{ fontSize: 13, color: "#666" }}>
              {gridCount > 1 ? `Scoring grid ${recallGridIdx + 1} — tap what each team drew` : "Tap the boxes each team shaded on their sheet"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            {teams.map((team, i) => (
              <button key={i} onClick={() => setScoringTeam(i)} style={{ flex: 1, padding: 11, borderRadius: 9, border: `1px solid ${scoringTeam === i ? "#e8ff47" : "#333"}`, background: scoringTeam === i ? "rgba(232,255,71,.07)" : "#1a1a1a", color: scoringTeam === i ? "#e8ff47" : "#555", fontFamily: "'Space Mono',monospace", fontSize: 12, cursor: "pointer", textAlign: "center" }}>{team.name}</button>
            ))}
          </div>
          <div style={{ fontSize: 13, color: "#666", textAlign: "center", lineHeight: 1.6 }}>
            Tap every box that <strong style={{ color: "#fff" }}>{teams[scoringTeam].name}</strong> shaded
          </div>
          <div style={{ display: "flex", justifyContent: "center", overflow: "auto" }}>
            <ScoringGrid
              n={gridSize}
              tapped={scoringInputs[scoringTeam]}
              onToggle={toggleScoringCell}
            />
          </div>
          <button className="tg-btn-primary" onClick={confirmScores}>CALCULATE SCORES →</button>
        </div>
      )}

      {/* RESULTS */}
      {screen === "results" && roundScores.length === 2 && (
        <ResultsScreen
          isPractice={isPractice}
          round={round}
          teams={teams}
          roundScores={roundScores}
          sessionScores={sessionScores}
          difficulty={difficulty}
          diffChange={diffChange}
          tips={tips}
          maxRounds={maxRounds}
          onNext={nextRound}
          onEnd={confirmEndSession}
        />
      )}

      {/* FINAL */}
      {screen === "final" && (
        <FinalScreen
          teams={teams}
          sessionScores={sessionScores}
          round={round}
          onNew={() => {
            setScreen("setup");
            setSessionId(null);
          }}
        />
      )}

      {/* End modal */}
      {endModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
          <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 16, padding: 28, width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>End Session?</div>
              <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>
                {maxRounds - round > 0
                  ? `You are on Round ${round} of ${maxRounds}. Ending now will skip ${maxRounds - round} remaining round${maxRounds - round > 1 ? "s" : ""}. Final scores will be shown.`
                  : "This will close the session and show final scores."}
              </div>
            </div>
            <button className="tg-btn-primary" style={{ background: "#f87171", color: "#fff" }} onClick={endSessionConfirmed}>YES, END SESSION</button>
            <button className="tg-btn-secondary" onClick={() => setEndModal(false)}>KEEP PLAYING</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────── Sub-components ───────────
function ConfigCard({ label, options, value, onChange, suffix, repeat }: { label: string; options: number[]; value: number; onChange: (v: number) => void; suffix: string; repeat?: boolean }) {
  return (
    <div style={{ flex: 1, background: "#1a1a1a", borderRadius: 12, border: "1px solid #333", padding: 14, display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#666" }}>{label}</div>
      <div style={{ display: "flex", background: "#2a2a2a", borderRadius: 8, padding: 3, gap: 2 }}>
        {options.map((v) => (
          <button key={v} className={`tg-seg-btn${value === v ? " active" : ""}`} onClick={() => onChange(v)}>{v}{suffix}{repeat ? v : ""}</button>
        ))}
      </div>
    </div>
  );
}

function ViewingScreen({ gridSize, grid, viewTime, timerLeft, gridCount, currentGridIdx, entry, teams }: {
  gridSize: number; grid: number[][]; viewTime: number; timerLeft: number; gridCount: number; currentGridIdx: number; entry: QueueEntry; teams: Team[];
}) {
  const names = entry.pair.map((it) => teams[it.teamIdx].members[it.memberIdx].name).join(" & ");
  const tns = entry.pair.map((it) => teams[it.teamIdx].name).join(" + ");
  const circumference = 2 * Math.PI * 30;
  const pct = timerLeft / viewTime;
  const offset = circumference * (1 - pct);
  const urgent = timerLeft <= 3;
  return (
    <div className="tg-screen" style={{ background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "28px 20px 40px", gap: 16, minHeight: "100vh" }}>
      <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#666" }}>{tns}</div>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 16, fontWeight: 700 }}>{names}</div>
        </div>
        <div style={{ position: "relative", width: 72, height: 72 }}>
          <svg width={72} height={72} viewBox="0 0 72 72" style={{ transform: "rotate(-90deg)" }}>
            <circle cx={36} cy={36} r={30} fill="none" stroke="#2a2a2a" strokeWidth={4} />
            <circle cx={36} cy={36} r={30} fill="none" stroke={urgent ? "#f87171" : "#e8ff47"} strokeWidth={4} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s" }} />
          </svg>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontFamily: "'Space Mono',monospace", fontSize: 20, fontWeight: 700 }}>{timerLeft}</div>
        </div>
      </div>

      {gridCount > 1 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center" }}>
          {Array.from({ length: gridCount }).map((_, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: i === currentGridIdx ? "#e8ff47" : "#2a2a2a", border: `1px solid ${i === currentGridIdx ? "#e8ff47" : "#333"}`, opacity: i < currentGridIdx ? 0.4 : 1 }} />
          ))}
        </div>
      )}

      <GridSVG n={gridSize} grid={grid} maxPx={Math.min(380, typeof window !== "undefined" ? window.innerWidth - 48 : 380)} showLabels={false} />

      <div style={{ fontSize: 12, color: "#666", textAlign: "center", letterSpacing: 1 }}>
        {gridCount > 1 ? `Grid ${currentGridIdx + 1} of ${gridCount} — memorise all of them` : "Both players memorise the full grid together"}
      </div>
    </div>
  );
}

function GridSVG({ n, grid, maxPx, showLabels }: { n: number; grid: number[][]; maxPx: number; showLabels: boolean }) {
  const size = maxPx;
  const cellSize = size / n;
  const half = n / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      {grid.map((row, r) => row.map((v, c) => (
        <rect key={`${r}-${c}`} x={c * cellSize} y={r * cellSize} width={cellSize} height={cellSize} fill={v === 1 ? "#0a0a0a" : "#f5f5f0"} stroke="#bbb" strokeWidth={0.5} />
      )))}
      <line x1={0} y1={half * cellSize} x2={size} y2={half * cellSize} stroke="#e8ff47" strokeWidth={2} />
      <line x1={half * cellSize} y1={0} x2={half * cellSize} y2={size} stroke="#e8ff47" strokeWidth={2} />
      {showLabels && [[half * 0.5, half * 0.5], [half * 1.5, half * 0.5], [half * 0.5, half * 1.5], [half * 1.5, half * 1.5]].map(([x, y], i) => (
        <text key={i} x={x * cellSize} y={y * cellSize} textAnchor="middle" dominantBaseline="middle" fill="rgba(232,255,71,0.4)" fontSize={cellSize * 1.1} fontFamily="Space Mono, monospace" fontWeight={700}>{QABBR[i]}</text>
      ))}
    </svg>
  );
}

function RevealScreen({ item, teams, gridSize, gridCount, recallGridIdx, onDone }: {
  item: QueueItem; teams: Team[]; gridSize: number; gridCount: number; recallGridIdx: number; onDone: () => void;
}) {
  const member = teams[item.teamIdx].members[item.memberIdx];
  const n = gridSize;
  const mini = 200;
  const cellSize = mini / n;
  const half = n / 2;
  // overlay box
  let minR = n, maxR = 0, minC = n, maxC = 0;
  item.quadrants.forEach((q) => {
    const rS = q < 2 ? 0 : half, rE = q < 2 ? half : n;
    const cS = q % 2 === 0 ? 0 : half, cE = q % 2 === 0 ? half : n;
    minR = Math.min(minR, rS); maxR = Math.max(maxR, rE);
    minC = Math.min(minC, cS); maxC = Math.max(maxC, cE);
  });
  return (
    <div className="tg-screen" style={{ background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 24, padding: "44px 28px", textAlign: "center", minHeight: "100vh" }}>
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "#666" }}>YOUR QUADRANT IS</div>
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 26, fontWeight: 700, color: "#e8ff47" }}>{member.name}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
        <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "#666" }}>You are responsible for</div>
        <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 44, fontWeight: 700, lineHeight: 1 }}>{item.quadrants.map((q) => QABBR[q]).join(" + ")}</div>
      </div>
      {gridCount > 1 && (
        <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 18, fontWeight: 700, color: "#e8ff47", padding: "8px 20px", background: "rgba(232,255,71,0.1)", borderRadius: 10, border: "1px solid rgba(232,255,71,0.3)" }}>
          RECALL GRID {recallGridIdx + 1}
        </div>
      )}
      <div style={{ position: "relative", display: "inline-block" }}>
        <svg width={mini} height={mini} viewBox={`0 0 ${mini} ${mini}`} style={{ display: "block" }}>
          {Array.from({ length: n }).map((_, r) => Array.from({ length: n }).map((_, c) => (
            <rect key={`${r}-${c}`} x={c * cellSize} y={r * cellSize} width={cellSize} height={cellSize} fill="#f5f5f0" stroke="#bbb" strokeWidth={0.5} />
          )))}
          <line x1={0} y1={half * cellSize} x2={mini} y2={half * cellSize} stroke="#e8ff47" strokeWidth={2} />
          <line x1={half * cellSize} y1={0} x2={half * cellSize} y2={mini} stroke="#e8ff47" strokeWidth={2} />
          {[[half * 0.5, half * 0.5], [half * 1.5, half * 0.5], [half * 0.5, half * 1.5], [half * 1.5, half * 1.5]].map(([x, y], i) => (
            <text key={i} x={x * cellSize} y={y * cellSize} textAnchor="middle" dominantBaseline="middle" fill={item.quadrants.includes(i) ? "rgba(232,255,71,0.9)" : "rgba(232,255,71,0.2)"} fontSize={cellSize * 1.1} fontFamily="Space Mono, monospace" fontWeight={700}>{QABBR[i]}</text>
          ))}
        </svg>
        <div style={{ position: "absolute", top: minR * cellSize, left: minC * cellSize, width: (maxC - minC) * cellSize, height: (maxR - minR) * cellSize, border: "3px solid #e8ff47", boxShadow: "inset 0 0 0 9999px rgba(232,255,71,.1)", pointerEvents: "none", borderRadius: 2 }} />
      </div>
      <div style={{ fontSize: 12, color: "#666", maxWidth: 260, lineHeight: 1.5 }}>Hand the iPad back to the facilitator</div>
      <button className="tg-btn-primary" style={{ maxWidth: 300 }} onClick={onDone}>DONE →</button>
    </div>
  );
}

function ScoringGrid({ n, tapped, onToggle }: { n: number; tapped: number[][]; onToggle: (r: number, c: number) => void }) {
  const cellSize = 44;
  const size = n * cellSize;
  const half = n / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      {tapped.map((row, r) => row.map((v, c) => (
        <rect key={`${r}-${c}`} x={c * cellSize + 1} y={r * cellSize + 1} width={cellSize - 2} height={cellSize - 2} rx={3} fill={v ? "#0a0a0a" : "#f5f5f0"} stroke="#888" strokeWidth={0.5} style={{ cursor: "pointer" }} onClick={() => onToggle(r, c)} />
      )))}
      <line x1={0} y1={half * cellSize} x2={size} y2={half * cellSize} stroke="#e8ff47" strokeWidth={2} strokeDasharray="5,3" />
      <line x1={half * cellSize} y1={0} x2={half * cellSize} y2={size} stroke="#e8ff47" strokeWidth={2} strokeDasharray="5,3" />
    </svg>
  );
}

function ResultsScreen({ isPractice, round, teams, roundScores, sessionScores, difficulty, diffChange, tips, maxRounds, onNext, onEnd }: {
  isPractice: boolean; round: number; teams: Team[]; roundScores: RoundScore[]; sessionScores: number[]; difficulty: number; diffChange: "up" | "down" | "same"; tips: { team: string; text: string }[]; maxRounds: number; onNext: () => void; onEnd: () => void;
}) {
  const s0 = roundScores[0].pct, s1 = roundScores[1].pct;
  const practiceLabel = isPractice ? " — PRACTICE" : "";
  const diffDesc = ["", "Easy (1 grid, 6×6)", "Medium (1 grid, 8×8)", "Hard (2 grids shown)", "Expert (3 grids shown)"];
  const arrowText = diffChange === "up" ? "↑ Harder" : diffChange === "down" ? "↓ Easier" : "→ Same level";
  const arrowColor = diffChange === "up" ? "#e8ff47" : diffChange === "down" ? "#f87171" : "#60a5fa";
  const remaining = maxRounds - round;
  return (
    <div className="tg-screen" style={{ background: "#0a0a0a", padding: "36px 24px 56px", display: "flex", flexDirection: "column", gap: 24, overflowY: "auto" }}>
      <div>
        <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, letterSpacing: 3, color: "#666", textTransform: "uppercase" }}>
          {isPractice ? "PRACTICE ROUND RESULTS (scores don't count)" : `ROUND ${round} RESULTS`}
        </div>
        <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 26, fontWeight: 700, lineHeight: 1.1, marginTop: 6 }}>
          {s0 > s1 ? <><span style={{ color: "#e8ff47" }}>{teams[0].name}</span> wins{practiceLabel}</>
            : s1 > s0 ? <><span style={{ color: "#e8ff47" }}>{teams[1].name}</span> wins{practiceLabel}</>
              : <span style={{ color: "#fff" }}>Perfect Draw</span>}
        </div>
        <div style={{ fontSize: 13, color: "#666", marginTop: 3 }}>
          {s0 === s1 ? `Both scored ${s0}%${isPractice ? " — practice round" : " — facilitator's call"}` : `by ${Math.abs(s0 - s1)} points`}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        {teams.map((team, i) => {
          const rs = roundScores[i];
          const isWin = (i === 0 && s0 > s1) || (i === 1 && s1 > s0);
          return (
            <div key={i} style={{ flex: 1, background: isWin ? "rgba(232,255,71,.05)" : "#1a1a1a", border: `1px solid ${isWin ? "#e8ff47" : "#333"}`, borderRadius: 12, padding: "18px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ fontSize: 11, color: "#666", letterSpacing: 1, textTransform: "uppercase" }}>{team.name}</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 36, fontWeight: 700, lineHeight: 1, color: isWin ? "#e8ff47" : "#f5f5f0" }}>{rs.pct}<span style={{ fontSize: 18 }}>%</span></div>
              <div style={{ fontSize: 12, color: "#666" }}>✓ {rs.totalCorrect} correct &nbsp;✗ {rs.totalWrong} wrong &nbsp;◻ {rs.totalMissed} missed</div>
            </div>
          );
        })}
      </div>

      {/* Member breakdown */}
      <div>
        {teams.map((team, ti) => (
          <div key={ti} style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#666" }}>{team.name} — by member</div>
            {roundScores[ti].memberScores.map((ms, idx) => (
              <div key={idx} style={{ background: "#1a1a1a", borderRadius: 9, border: "1px solid #333", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, fontSize: 14 }}>{ms.name}</div>
                <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: "#666" }}>{ms.quadrants.map((q) => QABBR[q]).join("+")}</div>
                <div style={{ width: 70, height: 5, background: "#2a2a2a", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "#e8ff47", width: `${ms.pct}%`, transition: "width .5s ease" }} />
                </div>
                <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 12, minWidth: 34, textAlign: "right" }}>{ms.pct}%</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#aaa", lineHeight: 1.5 }}>
        {isPractice ? (
          <><strong style={{ color: "#fff" }}>Practice complete.</strong> Round 1 will adapt difficulty from here.</>
        ) : (
          <>
            <strong style={{ color: "#fff" }}>Next round:</strong>{" "}
            <span style={{ color: arrowColor }}>{arrowText}</span> — {diffDesc[difficulty]}
          </>
        )}
      </div>

      {tips.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#666" }}>Facilitator Tips</div>
          {tips.map((t, i) => (
            <div key={i} style={{ background: "#1a1a1a", border: "1px solid #333", borderLeft: "3px solid #e8ff47", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "#e8ff47", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{t.team}</div>
              <div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.6 }}>{t.text}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
        <div style={{ fontSize: 12, color: "#666", textAlign: "center", lineHeight: 1.5, padding: "0 8px" }}>
          {isPractice ? "Practice scores don't count. Round 1 starts now!" : `Totals — ${teams[0].name}: ${sessionScores[0]}pts  |  ${teams[1].name}: ${sessionScores[1]}pts`}
        </div>
        <button className="tg-btn-primary" onClick={onNext}>
          {isPractice ? "START ROUND 1 →" : remaining > 0 ? `NEXT ROUND (${remaining} left) →` : "FINAL ROUND DONE →"}
        </button>
        <button className="tg-btn-secondary" onClick={onEnd}>END SESSION</button>
      </div>
    </div>
  );
}

function FinalScreen({ teams, sessionScores, round, onNew }: { teams: Team[]; sessionScores: number[]; round: number; onNew: () => void }) {
  const s0 = sessionScores[0], s1 = sessionScores[1];
  return (
    <div className="tg-screen" style={{ padding: "36px 24px 56px", display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, letterSpacing: 3, color: "#666", textTransform: "uppercase" }}>
        SESSION COMPLETE — {round} ROUND{round !== 1 ? "S" : ""}
      </div>
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 28, fontWeight: 700 }}>
        {s0 > s1 ? <><span style={{ color: "#e8ff47" }}>{teams[0].name}</span> wins the session</>
          : s1 > s0 ? <><span style={{ color: "#e8ff47" }}>{teams[1].name}</span> wins the session</>
            : <span>Perfect Draw</span>}
      </div>
      <div style={{ fontSize: 14, color: "#666" }}>
        {s0 === s1 ? `Both finished with ${s0} points` : `Total: ${Math.max(s0, s1)} pts vs ${Math.min(s0, s1)} pts`}
      </div>
      <button className="tg-btn-primary" onClick={onNew}>NEW SESSION</button>
      <Link to="/" style={{ color: "#666", textDecoration: "none", fontSize: 13, textAlign: "center" }}>← Back to home</Link>
    </div>
  );
}