import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Play, RefreshCw, Eye, EyeOff, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useFacilitator } from "@/lib/facilitator-context";
import {
  generateGrid,
  LEVEL_SPECS,
  recommendLevel,
  sectionLayout,
  totalCells,
  type GridLevel,
  type Section,
} from "@/lib/grid-utils";
import { cues } from "@/lib/audio-cues";

export const Route = createFileRoute("/the-grid")({
  component: TheGrid,
  head: () => ({ meta: [{ title: "The Grid — Brain Gym" }] }),
});

type Phase =
  | "setup"
  | "round_setup"
  | "viewing"
  | "drawing"
  | "reveal"
  | "scoring"
  | "round_summary"
  | "results";

type Config = {
  team1Name: string;
  team2Name: string;
  playersPerTeam: number;
  team1Players: string[];
  team2Players: string[];
  totalRounds: number;
  startingLevel: GridLevel;
};

type RoundResult = {
  roundNumber: number;
  level: GridLevel;
  team1Score: number;
  team2Score: number;
  maxScore: number;
};

const COLOR_FILLS = ["bg-transparent", "bg-slate-900", "bg-rose-500", "bg-amber-400"];

function TheGrid() {
  const { facilitator } = useFacilitator();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("setup");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [config, setConfig] = useState<Config>({
    team1Name: "Team 1",
    team2Name: "Team 2",
    playersPerTeam: 3,
    team1Players: ["Player A", "Player B", "Player C", "Player D"],
    team2Players: ["Player A", "Player B", "Player C", "Player D"],
    totalRounds: 4,
    startingLevel: 1,
  });
  const [roundNum, setRoundNum] = useState(1);
  const [currentLevel, setCurrentLevel] = useState<GridLevel>(1);
  const [viewingTimeOverride, setViewingTimeOverride] = useState<number | null>(null);
  const [drawingTimerEnabled, setDrawingTimerEnabled] = useState(false);
  const [drawingTimerDuration, setDrawingTimerDuration] = useState(120);
  const [grid, setGrid] = useState<Section[] | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [drawTimeLeft, setDrawTimeLeft] = useState<number | null>(null);
  const [team1Score, setTeam1Score] = useState("");
  const [team2Score, setTeam2Score] = useState("");
  const [results, setResults] = useState<RoundResult[]>([]);
  const [team1Recommend, setTeam1Recommend] = useState<GridLevel>(1);
  const [team2Recommend, setTeam2Recommend] = useState<GridLevel>(1);
  const tickRef = useRef<{ played: Set<number> }>({ played: new Set() });

  useEffect(() => {
    if (!facilitator) navigate({ to: "/" });
  }, [facilitator, navigate]);

  // Viewing timer
  useEffect(() => {
    if (phase !== "viewing") return;
    if (timeLeft <= 0) {
      cues.end();
      setPhase("drawing");
      if (drawingTimerEnabled) {
        setDrawTimeLeft(drawingTimerDuration);
      }
      return;
    }
    if ([3, 2, 1].includes(timeLeft) && !tickRef.current.played.has(timeLeft)) {
      tickRef.current.played.add(timeLeft);
      cues.tick(4 - timeLeft);
    }
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft, drawingTimerEnabled, drawingTimerDuration]);

  // Drawing timer
  useEffect(() => {
    if (phase !== "drawing" || drawTimeLeft === null) return;
    if (drawTimeLeft <= 0) {
      cues.end();
      setPhase("reveal");
      return;
    }
    if ([3, 2, 1].includes(drawTimeLeft)) cues.tick(4 - drawTimeLeft);
    const t = setTimeout(() => setDrawTimeLeft((v) => (v ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, drawTimeLeft]);

  // Adaptive recommendation: rolling avg of last 2 rounds per team
  useEffect(() => {
    if (results.length === 0) return;
    const last = results.slice(-2);
    const t1Avg = last.reduce((s, r) => s + r.team1Score / r.maxScore, 0) / last.length;
    const t2Avg = last.reduce((s, r) => s + r.team2Score / r.maxScore, 0) / last.length;
    setTeam1Recommend(recommendLevel(currentLevel, t1Avg));
    setTeam2Recommend(recommendLevel(currentLevel, t2Avg));
  }, [results, currentLevel]);

  if (!facilitator) return null;

  // ===== SETUP =====
  if (phase === "setup") {
    const valid = config.playersPerTeam >= 2 && config.playersPerTeam <= 4 && [4, 6, 8].includes(config.totalRounds);
    return (
      <Shell title="The Grid — Session Setup">
        <Card className="space-y-5 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Team 1 name">
              <Input value={config.team1Name} onChange={(e) => setConfig({ ...config, team1Name: e.target.value })} />
            </Field>
            <Field label="Team 2 name">
              <Input value={config.team2Name} onChange={(e) => setConfig({ ...config, team2Name: e.target.value })} />
            </Field>
          </div>

          <Field label="Players per team (2–4)">
            <div className="flex gap-2">
              {[2, 3, 4].map((n) => (
                <Button
                  key={n}
                  variant={config.playersPerTeam === n ? "default" : "outline"}
                  onClick={() => setConfig({ ...config, playersPerTeam: n })}
                >
                  {n}
                </Button>
              ))}
            </div>
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <PlayerNames
              label={config.team1Name}
              count={config.playersPerTeam}
              names={config.team1Players}
              onChange={(names) => setConfig({ ...config, team1Players: names })}
            />
            <PlayerNames
              label={config.team2Name}
              count={config.playersPerTeam}
              names={config.team2Players}
              onChange={(names) => setConfig({ ...config, team2Players: names })}
            />
          </div>

          <Field label="Number of rounds">
            <div className="flex gap-2">
              {[4, 6, 8].map((n) => (
                <Button
                  key={n}
                  variant={config.totalRounds === n ? "default" : "outline"}
                  onClick={() => setConfig({ ...config, totalRounds: n })}
                >
                  {n}
                </Button>
              ))}
            </div>
          </Field>

          <Field label="Starting difficulty">
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <Button
                  key={n}
                  variant={config.startingLevel === n ? "default" : "outline"}
                  onClick={() => setConfig({ ...config, startingLevel: n as GridLevel })}
                >
                  Level {n}
                </Button>
              ))}
            </div>
          </Field>

          <Button
            disabled={!valid}
            onClick={async () => {
              const { data, error } = await supabase
                .from("sessions")
                .insert({
                  game_type: "the_grid",
                  facilitator_id: facilitator.id,
                  config: config as any,
                })
                .select("id")
                .single();
              if (error || !data) return toast.error(error?.message ?? "Failed");
              setSessionId(data.id);
              setCurrentLevel(config.startingLevel);
              setTeam1Recommend(config.startingLevel);
              setTeam2Recommend(config.startingLevel);
              setPhase("round_setup");
            }}
            className="w-full"
          >
            Start session
          </Button>
        </Card>
      </Shell>
    );
  }

  // ===== ROUND SETUP =====
  if (phase === "round_setup") {
    const teamsDiverge = team1Recommend !== team2Recommend;
    const cumulT1 = results.reduce((s, r) => s + r.team1Score, 0);
    const cumulT2 = results.reduce((s, r) => s + r.team2Score, 0);
    const level4Available = team1Recommend === 4 || team2Recommend === 4;

    return (
      <Shell title={`Round ${roundNum} of ${config.totalRounds}`}>
        <Card className="p-6">
          <div className="mb-4 flex justify-between text-sm text-muted-foreground">
            <span>{config.team1Name}: {cumulT1}</span>
            <span>{config.team2Name}: {cumulT2}</span>
          </div>

          {results.length > 0 && (
            <div className="mb-4 rounded-lg bg-muted/50 p-3 text-sm">
              <div className="font-medium">Adaptive recommendation</div>
              {teamsDiverge ? (
                <div className="mt-1 text-muted-foreground">
                  {config.team1Name} → Level {team1Recommend} | {config.team2Name} → Level {team2Recommend}.
                  Pick one for this round.
                </div>
              ) : (
                <div className="mt-1 text-muted-foreground">Suggested: Level {team1Recommend}</div>
              )}
            </div>
          )}

          <Field label="Difficulty for this round">
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3].map((n) => (
                <Button
                  key={n}
                  variant={currentLevel === n ? "default" : "outline"}
                  onClick={() => setCurrentLevel(n as GridLevel)}
                >
                  Level {n}
                </Button>
              ))}
              {level4Available && (
                <Button
                  variant={currentLevel === 4 ? "default" : "outline"}
                  onClick={() => setCurrentLevel(4)}
                >
                  Level 4 (max)
                </Button>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Sub-grid: {LEVEL_SPECS[currentLevel].size}×{LEVEL_SPECS[currentLevel].size} ·
              Default view: {LEVEL_SPECS[currentLevel].viewingTime}s · Colors: {LEVEL_SPECS[currentLevel].colors}
            </p>
          </Field>

          <Field label="Viewing time override (4–15s, optional)">
            <Input
              type="number"
              min={4}
              max={15}
              placeholder={String(LEVEL_SPECS[currentLevel].viewingTime)}
              value={viewingTimeOverride ?? ""}
              onChange={(e) => setViewingTimeOverride(e.target.value ? Number(e.target.value) : null)}
              className="w-32"
            />
          </Field>

          <Field label="Drawing timer (optional)">
            <div className="flex items-center gap-3">
              <Switch checked={drawingTimerEnabled} onCheckedChange={setDrawingTimerEnabled} />
              <span className="text-sm text-muted-foreground">
                {drawingTimerEnabled ? "Enabled" : "Disabled"}
              </span>
              {drawingTimerEnabled && (
                <Input
                  type="number"
                  min={30}
                  max={300}
                  value={drawingTimerDuration}
                  onChange={(e) => setDrawingTimerDuration(Number(e.target.value))}
                  className="w-28"
                />
              )}
            </div>
          </Field>

          <div className="flex gap-2">
            <Button
              onClick={() => {
                setGrid(generateGrid(currentLevel, config.playersPerTeam));
              }}
            >
              {grid ? "Regenerate" : "Generate Grid"}
            </Button>
            {grid && (
              <Button
                variant="default"
                onClick={() => {
                  tickRef.current.played.clear();
                  setTimeLeft(viewingTimeOverride ?? LEVEL_SPECS[currentLevel].viewingTime);
                  cues.start();
                  setPhase("viewing");
                }}
              >
                <Play className="mr-1 h-4 w-4" /> Start Viewing Timer
              </Button>
            )}
          </div>

          {grid && (
            <div className="mt-6">
              <div className="mb-2 text-xs text-muted-foreground">Preview (facilitator only)</div>
              <GridDisplay grid={grid} layout={sectionLayout(config.playersPerTeam)} small />
            </div>
          )}
        </Card>
      </Shell>
    );
  }

  // ===== VIEWING =====
  if (phase === "viewing" && grid) {
    return (
      <Shell title={`Viewing — Round ${roundNum}`}>
        <div className="mb-6 text-center">
          <div className="text-7xl font-bold tabular-nums">{timeLeft}</div>
          <p className="mt-2 text-sm text-muted-foreground">Players: memorize your section.</p>
        </div>
        <GridDisplay grid={grid} layout={sectionLayout(config.playersPerTeam)} team1Names={config.team1Players} team2Names={config.team2Players} />
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            onClick={() => {
              setTimeLeft(0);
            }}
          >
            End early
          </Button>
        </div>
      </Shell>
    );
  }

  // ===== DRAWING =====
  if (phase === "drawing") {
    return (
      <Shell title={`Drawing — Round ${roundNum}`}>
        <Card className="p-8 text-center">
          <EyeOff className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h2 className="text-2xl font-semibold">Grid hidden</h2>
          <p className="mt-2 text-muted-foreground">Both teams: reproduce the grid on your shared sheet.</p>

          {drawTimeLeft !== null && (
            <div className="mt-6 text-5xl font-bold tabular-nums">{drawTimeLeft}s</div>
          )}

          <div className="mt-8 flex justify-center gap-2">
            <Button onClick={() => setPhase("reveal")}>
              <Check className="mr-1 h-4 w-4" /> Done drawing — reveal
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (confirm("Cancel this round? It will not be recorded.")) {
                  setGrid(null);
                  setDrawTimeLeft(null);
                  setPhase("round_setup");
                }
              }}
            >
              Cancel round
            </Button>
          </div>
        </Card>
      </Shell>
    );
  }

  // ===== REVEAL =====
  if (phase === "reveal" && grid) {
    return (
      <Shell title="Answer">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Eye className="h-4 w-4" /> Compare each team's drawing to the answer.
        </div>
        <GridDisplay grid={grid} layout={sectionLayout(config.playersPerTeam)} team1Names={config.team1Players} team2Names={config.team2Players} />
        <div className="mt-6 flex justify-center">
          <Button onClick={() => setPhase("scoring")}>Score this round</Button>
        </div>
      </Shell>
    );
  }

  // ===== SCORING =====
  if (phase === "scoring") {
    const max = totalCells(currentLevel, config.playersPerTeam);
    const t1n = Number(team1Score);
    const t2n = Number(team2Score);
    const valid = !isNaN(t1n) && !isNaN(t2n) && t1n >= 0 && t1n <= max && t2n >= 0 && t2n <= max && team1Score !== "" && team2Score !== "";
    return (
      <Shell title={`Score — Round ${roundNum}`}>
        <Card className="space-y-5 p-6">
          <div className="text-sm text-muted-foreground">Max possible: {max} cells</div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={`${config.team1Name} score`}>
              <Input
                type="number"
                min={0}
                max={max}
                value={team1Score}
                onChange={(e) => setTeam1Score(e.target.value)}
                autoFocus
              />
              {team1Score && <div className="mt-1 text-xs text-muted-foreground">{Math.round((t1n / max) * 100)}%</div>}
            </Field>
            <Field label={`${config.team2Name} score`}>
              <Input
                type="number"
                min={0}
                max={max}
                value={team2Score}
                onChange={(e) => setTeam2Score(e.target.value)}
              />
              {team2Score && <div className="mt-1 text-xs text-muted-foreground">{Math.round((t2n / max) * 100)}%</div>}
            </Field>
          </div>
          <Button
            disabled={!valid}
            className="w-full"
            onClick={async () => {
              const result: RoundResult = {
                roundNumber: roundNum,
                level: currentLevel,
                team1Score: t1n,
                team2Score: t2n,
                maxScore: max,
              };
              const newResults = [...results, result];
              setResults(newResults);
              if (sessionId) {
                await supabase.from("rounds").insert({
                  session_id: sessionId,
                  round_number: roundNum,
                  difficulty: currentLevel,
                  data: { layout: sectionLayout(config.playersPerTeam) } as any,
                  scores: result as any,
                });
              }
              setPhase("round_summary");
            }}
          >
            Confirm scores
          </Button>
        </Card>
      </Shell>
    );
  }

  // ===== ROUND SUMMARY =====
  if (phase === "round_summary") {
    const last = results[results.length - 1];
    const cumulT1 = results.reduce((s, r) => s + r.team1Score, 0);
    const cumulT2 = results.reduce((s, r) => s + r.team2Score, 0);
    const isFinal = roundNum >= config.totalRounds;
    return (
      <Shell title={`Round ${roundNum} summary`}>
        <Card className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <Stat label={config.team1Name} value={`${last.team1Score} / ${last.maxScore}`} sub={`Total ${cumulT1}`} />
            <Stat label={config.team2Name} value={`${last.team2Score} / ${last.maxScore}`} sub={`Total ${cumulT2}`} />
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <div className="font-medium">Leader</div>
            <div className="text-muted-foreground">
              {cumulT1 === cumulT2
                ? "Tied"
                : cumulT1 > cumulT2
                  ? config.team1Name
                  : config.team2Name}
            </div>
          </div>
          <div className="flex gap-2">
            {isFinal ? (
              <Button
                className="w-full"
                onClick={async () => {
                  if (sessionId) {
                    await supabase
                      .from("sessions")
                      .update({ status: "completed", ended_at: new Date().toISOString(), state: { results } as any })
                      .eq("id", sessionId);
                  }
                  setPhase("results");
                }}
              >
                View session results
              </Button>
            ) : (
              <Button
                className="w-full"
                onClick={() => {
                  setRoundNum(roundNum + 1);
                  setGrid(null);
                  setTeam1Score("");
                  setTeam2Score("");
                  setDrawTimeLeft(null);
                  setDrawingTimerEnabled(false); // sticky off per PRD
                  setViewingTimeOverride(null);
                  // Pre-select recommendation
                  setCurrentLevel(team1Recommend);
                  setPhase("round_setup");
                }}
              >
                Next round
              </Button>
            )}
          </div>
        </Card>
      </Shell>
    );
  }

  // ===== RESULTS =====
  if (phase === "results") {
    const totalT1 = results.reduce((s, r) => s + r.team1Score, 0);
    const totalT2 = results.reduce((s, r) => s + r.team2Score, 0);
    const winner = totalT1 === totalT2 ? "Perfect Draw" : totalT1 > totalT2 ? config.team1Name : config.team2Name;
    const t1Best = Math.max(...results.map((r) => r.team1Score));
    const t2Best = Math.max(...results.map((r) => r.team2Score));
    const t1Wins = results.filter((r) => r.team1Score > r.team2Score).length;
    const t2Wins = results.filter((r) => r.team2Score > r.team1Score).length;
    const t1MaxLevel = Math.max(...results.map((r) => r.level));
    const t2MaxLevel = Math.max(...results.map((r) => r.level));

    return (
      <Shell title="Session results">
        <Card className="p-6">
          <div className="mb-6 text-center">
            <div className="text-sm uppercase tracking-wider text-muted-foreground">Winner</div>
            <div className="mt-1 text-4xl font-bold">{winner}</div>
            <div className="mt-1 text-muted-foreground">
              {totalT1} – {totalT2}
            </div>
          </div>

          <div className="mb-6 overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2">Round</th>
                  <th className="px-3 py-2">Level</th>
                  <th className="px-3 py-2">{config.team1Name}</th>
                  <th className="px-3 py-2">{config.team2Name}</th>
                  <th className="px-3 py-2">Max</th>
                  <th className="px-3 py-2">Winner</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const w = r.team1Score === r.team2Score ? "—" : r.team1Score > r.team2Score ? config.team1Name : config.team2Name;
                  return (
                    <tr key={r.roundNumber} className="border-t">
                      <td className="px-3 py-2">{r.roundNumber}</td>
                      <td className="px-3 py-2">L{r.level}</td>
                      <td className="px-3 py-2">{r.team1Score}</td>
                      <td className="px-3 py-2">{r.team2Score}</td>
                      <td className="px-3 py-2">{r.maxScore}</td>
                      <td className="px-3 py-2 font-medium">{w}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
            <Stat label="Best round" value={`${t1Best} vs ${t2Best}`} />
            <Stat label="Rounds won" value={`${t1Wins} – ${t2Wins}`} />
            <Stat label="Highest level" value={`L${t1MaxLevel} vs L${t2MaxLevel}`} />
          </div>

          <div className="mb-6 rounded-lg bg-muted/50 p-3 text-sm">
            <div className="font-medium">Adaptive path</div>
            <div className="mt-1 text-muted-foreground">
              {results.map((r) => `L${r.level}`).join(" → ")}
            </div>
          </div>

          <Button asChild className="w-full">
            <Link to="/">End session</Link>
          </Button>
        </Card>
      </Shell>
    );
  }

  return null;
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Home
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <Label className="mb-2 block text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function PlayerNames({
  label,
  count,
  names,
  onChange,
}: {
  label: string;
  count: number;
  names: string[];
  onChange: (n: string[]) => void;
}) {
  return (
    <div>
      <Label className="mb-2 block text-sm font-medium">{label} players</Label>
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <Input
            key={i}
            value={names[i] ?? ""}
            onChange={(e) => {
              const next = [...names];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder={`Player ${String.fromCharCode(65 + i)}`}
          />
        ))}
      </div>
    </div>
  );
}

function GridDisplay({
  grid,
  layout,
  small,
  team1Names,
  team2Names,
}: {
  grid: Section[];
  layout: { cols: number; rows: number; labels: string[] };
  small?: boolean;
  team1Names?: string[];
  team2Names?: string[];
}) {
  const cellSize = small ? "h-6 w-6" : "h-12 w-12 sm:h-16 sm:w-16";
  return (
    <div
      className="mx-auto inline-grid gap-3 rounded-xl border-4 border-foreground p-3"
      style={{ gridTemplateColumns: `repeat(${layout.cols}, minmax(0,1fr))` }}
    >
      {grid.map((section, sIdx) => (
        <div key={sIdx} className="rounded-md border-2 border-foreground/60 bg-background p-2">
          <div className="mb-1 text-center text-xs font-medium text-muted-foreground">
            {layout.labels[sIdx]}
            {team1Names?.[sIdx] && team2Names?.[sIdx] && (
              <span className="ml-1">· {team1Names[sIdx]} / {team2Names[sIdx]}</span>
            )}
          </div>
          <div
            className="grid gap-px"
            style={{ gridTemplateColumns: `repeat(${section[0].length}, minmax(0,1fr))` }}
          >
            {section.flat().map((v, i) => (
              <div
                key={i}
                className={`${cellSize} border border-foreground/30 ${COLOR_FILLS[v] ?? "bg-transparent"}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}