import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Volume2, Loader2, Plus, X, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useFacilitator } from "@/lib/facilitator-context";
import { useServerFn } from "@tanstack/react-start";
import { synthesizeSpeech } from "@/lib/tts.functions";
import { pickStory, pickInstruction, type Story, type RecallInstruction } from "@/lib/story-library";

export const Route = createFileRoute("/story-sync")({
  component: StorySync,
  head: () => ({ meta: [{ title: "Story Sync — Brain Gym" }] }),
});

type Phase = "setup" | "round_setup" | "listening" | "instruction" | "collaboration" | "response" | "scoring" | "summary" | "results";
type Slot = { participant_id: string; name: string };
type Group = { name: string; participants: Slot[] };
type Config = { groups: Group[]; totalRounds: number; startingLevel: 1 | 2 | 3; multiGroup: boolean };
type Round = { roundNumber: number; level: number; storyId: string; instructionId: string; groupName: string; pct: number; scores: ScoreSet; perParticipant: ParticipantScore[] };
type ScoreSet = { detail: number; order: number; instruction: number; completeness: number; errors: number };
type ParticipantScore = { participant_id: string; name: string; segmentIdx: number; correct: number; total: number; distractorsIncluded: number; pct: number };
type FactMark = "correct" | "incorrect";
type FactMarks = Record<number, Record<number, FactMark>>; // segmentIdx -> factIdx -> mark
type InstructionCompliance = "full" | "partial" | "none";
type Coaching = { pattern: string; ask: string; tip: string };

const COLLAB_TIMES: Record<number, number> = { 1: 90, 2: 75, 3: 60, 4: 45 };
const RESTORE_KEY_BASE = "brain-gym:story-sync:active";

const defaultConfig = (): Config => ({
  groups: [{ name: "Group A", participants: [] }],
  totalRounds: 4,
  startingLevel: 1,
  multiGroup: false,
});

function pickCoaching(prompts: Coaching[], cur: Round, prev: Round | undefined): Coaching | null {
  if (!prompts.length) return null;
  const find = (p: string) => prompts.find(x => x.pattern === p);
  const s = cur.scores;
  if (cur.pct >= 85) return find("strong_round") ?? prompts[0];
  if (s.errors >= 2) return find("intrusion_errors") ?? prompts[0];
  if (s.instruction <= 1) return find("instruction_compliance_low") ?? prompts[0];
  if (s.detail >= 75 && s.order < 60) return find("high_detail_low_order") ?? prompts[0];
  if (s.order >= 75 && s.detail < 60) return find("low_detail_high_order") ?? prompts[0];
  if (prev && cur.pct < prev.pct - 15) return find("drop_from_prior_round") ?? prompts[0];
  if (cur.pct < 60 && prev && prev.pct < 60) return find("consistent_low") ?? prompts[0];
  return prompts[0];
}

function StorySync() {
  const { facilitator } = useFacilitator();
  const navigate = useNavigate();
  const tts = useServerFn(synthesizeSpeech);
  const [phase, setPhase] = useState<Phase>("setup");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [activeGroupIdx, setActiveGroupIdx] = useState(0);
  const [pidInput, setPidInput] = useState("");
  const [addToGroup, setAddToGroup] = useState(0);
  const [roundNum, setRoundNum] = useState(1);
  const [level, setLevel] = useState<1 | 2 | 3 | 4>(1);
  const [story, setStory] = useState<Story | null>(null);
  const [instruction, setInstruction] = useState<RecallInstruction | null>(null);
  const [usedStories, setUsedStories] = useState<string[]>([]);
  const [usedInstructions, setUsedInstructions] = useState<string[]>([]);
  const [listenIdx, setListenIdx] = useState(0);
  const [audioLoading, setAudioLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [collabTime, setCollabTime] = useState(60);
  const [instructionHidden, setInstructionHidden] = useState(false);
  const [factMarks, setFactMarks] = useState<FactMarks>({});
  const [instructionCompliance, setInstructionCompliance] = useState<InstructionCompliance>("full");
  const [results, setResults] = useState<Round[]>([]);
  const [coachingPrompts, setCoachingPrompts] = useState<Coaching[]>([]);
  const [restoreOffer, setRestoreOffer] = useState<any>(null);

  useEffect(() => { if (!facilitator) navigate({ to: "/" }); }, [facilitator, navigate]);

  // Scope restore to the active facilitator so multiple facilitators on the
  // same device each have their own independent in-progress session.
  const RESTORE_KEY = facilitator ? `${RESTORE_KEY_BASE}:${facilitator.facilitator_id}` : RESTORE_KEY_BASE;

  // Load coaching prompts once
  useEffect(() => {
    supabase.from("coaching_prompts").select("pattern, ask, tip").then(({ data }) => setCoachingPrompts(data ?? []));
  }, []);

  // Offline restore: detect saved session
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RESTORE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.sessionId && saved?.phase && saved.phase !== "results") {
          setRestoreOffer(saved);
        }
      }
    } catch {}
  }, [RESTORE_KEY]);

  // Persist active session
  useEffect(() => {
    if (!sessionId || phase === "setup") return;
    try {
      localStorage.setItem(RESTORE_KEY, JSON.stringify({
        sessionId, phase, config, activeGroupIdx, roundNum, level,
        usedStories, usedInstructions, results,
      }));
    } catch {}
  }, [sessionId, phase, config, activeGroupIdx, roundNum, level, usedStories, usedInstructions, results]);

  const clearRestore = () => { try { localStorage.removeItem(RESTORE_KEY); } catch {} };

  // Collaboration timer
  useEffect(() => {
    if (phase !== "collaboration") return;
    if (collabTime <= 0) { setPhase("response"); return; }
    const t = setTimeout(() => setCollabTime(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, collabTime]);

  if (!facilitator) return null;

  const activeGroup = config.groups[activeGroupIdx] ?? config.groups[0];

  const addParticipant = async () => {
    const id = pidInput.trim();
    if (!id) return;
    const { data } = await supabase.from("participants").select("participant_id, name").eq("participant_id", id).maybeSingle();
    if (!data) return toast.error(`Participant ${id} not found. Add them in Participants first.`);
    const target = config.groups[addToGroup];
    if (!target) return;
    if (config.groups.some(g => g.participants.some(p => p.participant_id === id)))
      return toast.error("Already added to a group");
    if (target.participants.length >= 6) return toast.error("Max 6 per group");
    const next = config.groups.map((g, i) => i === addToGroup ? { ...g, participants: [...g.participants, data] } : g);
    setConfig({ ...config, groups: next });
    setPidInput("");
  };

  const playSegment = async (idx: number) => {
    if (!story) return;
    setAudioLoading(true);
    try {
      const res = await tts({ data: { text: story.segments[idx].text } });
      if (res.error || !res.audio) {
        toast.error(res.error ?? "TTS failed — falling back to on-screen text");
        return;
      }
      const audio = new Audio(`data:audio/mpeg;base64,${res.audio}`);
      audioRef.current = audio;
      await audio.play();
    } catch (e: any) {
      toast.error(e?.message ?? "Audio error");
    } finally {
      setAudioLoading(false);
    }
  };

  // ===== Resume banner (shown only at setup) =====
  if (phase === "setup" && restoreOffer) {
    return (
      <Shell title="Resume previous session?">
        <Card className="space-y-4 p-6">
          <p className="text-sm text-muted-foreground">
            We found an in-progress session from a previous visit (round {restoreOffer.roundNum} of {restoreOffer.config?.totalRounds}, phase: <span className="font-medium">{restoreOffer.phase}</span>).
          </p>
          <div className="flex gap-2">
            <Button onClick={() => {
              setSessionId(restoreOffer.sessionId);
              setConfig(restoreOffer.config ?? defaultConfig());
              setActiveGroupIdx(restoreOffer.activeGroupIdx ?? 0);
              setRoundNum(restoreOffer.roundNum ?? 1);
              setLevel(restoreOffer.level ?? 1);
              setUsedStories(restoreOffer.usedStories ?? []);
              setUsedInstructions(restoreOffer.usedInstructions ?? []);
              setResults(restoreOffer.results ?? []);
              setPhase("round_setup");
              setRestoreOffer(null);
            }}>Resume</Button>
            <Button variant="outline" onClick={() => { clearRestore(); setRestoreOffer(null); }}>Discard & start new</Button>
          </div>
        </Card>
      </Shell>
    );
  }

  // ===== SETUP =====
  if (phase === "setup") {
    const totalParticipants = config.groups.reduce((s, g) => s + g.participants.length, 0);
    const valid = config.groups.every(g => g.participants.length >= 2) && totalParticipants >= 2;
    return (
      <Shell title="Story Sync — Setup">
        <Card className="space-y-5 p-6">
          <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
            <div>
              <div className="text-sm font-medium">Multi-group mode</div>
              <div className="text-xs text-muted-foreground">Run several groups in parallel; pick which group plays each round.</div>
            </div>
            <Switch checked={config.multiGroup} onCheckedChange={(v) => {
              if (v) setConfig({ ...config, multiGroup: true });
              else setConfig({ ...config, multiGroup: false, groups: [config.groups[0] ?? { name: "Group A", participants: [] }] });
            }} />
          </div>

          <Field label="Groups">
            <div className="space-y-3">
              {config.groups.map((g, gi) => (
                <div key={gi} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Input value={g.name} onChange={e => {
                      const next = config.groups.map((x, i) => i === gi ? { ...x, name: e.target.value } : x);
                      setConfig({ ...config, groups: next });
                    }} className="h-8 max-w-[200px]" />
                    {config.groups.length > 1 && (
                      <Button size="sm" variant="ghost" onClick={() => {
                        const next = config.groups.filter((_, i) => i !== gi);
                        setConfig({ ...config, groups: next });
                        if (addToGroup >= next.length) setAddToGroup(0);
                      }}><X className="h-4 w-4" /></Button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {g.participants.map((p, pi) => (
                      <div key={p.participant_id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-1.5 text-sm">
                        <span><span className="font-mono text-xs text-muted-foreground">{p.participant_id}</span> · {p.name}</span>
                        <button onClick={() => {
                          const next = config.groups.map((x, i) => i === gi ? { ...x, participants: x.participants.filter((_, j) => j !== pi) } : x);
                          setConfig({ ...config, groups: next });
                        }} className="text-xs text-destructive">Remove</button>
                      </div>
                    ))}
                    {g.participants.length === 0 && <p className="text-xs text-muted-foreground">No participants yet (need at least 2).</p>}
                  </div>
                </div>
              ))}
              {config.multiGroup && (
                <Button size="sm" variant="outline" onClick={() => {
                  const letter = String.fromCharCode(65 + config.groups.length);
                  setConfig({ ...config, groups: [...config.groups, { name: `Group ${letter}`, participants: [] }] });
                }}><Plus className="mr-1 h-4 w-4" />Add group</Button>
              )}
            </div>
          </Field>

          <Field label="Add participant by ID">
            <div className="flex gap-2">
              {config.groups.length > 1 && (
                <select value={addToGroup} onChange={e => setAddToGroup(Number(e.target.value))} className="rounded-md border bg-background px-2 text-sm">
                  {config.groups.map((g, i) => <option key={i} value={i}>{g.name}</option>)}
                </select>
              )}
              <Input value={pidInput} onChange={e => setPidInput(e.target.value)} placeholder="P-001" onKeyDown={e => e.key === "Enter" && addParticipant()} />
              <Button onClick={addParticipant}>Add</Button>
            </div>
          </Field>

          <Field label="Number of rounds">
            <div className="flex gap-2">
              {[4, 6, 8].map(n => <Button key={n} variant={config.totalRounds === n ? "default" : "outline"} onClick={() => setConfig({ ...config, totalRounds: n })}>{n}</Button>)}
            </div>
          </Field>

          <Field label="Starting difficulty">
            <div className="flex gap-2">
              {[1, 2, 3].map(n => <Button key={n} variant={config.startingLevel === n ? "default" : "outline"} onClick={() => setConfig({ ...config, startingLevel: n as 1 | 2 | 3 })}>Level {n}</Button>)}
            </div>
          </Field>

          <Button disabled={!valid} className="w-full" onClick={async () => {
            const { data, error } = await supabase.from("sessions").insert({ game_type: "story_sync", facilitator_id: facilitator.id, config: config as any }).select("id").single();
            if (error || !data) return toast.error(error?.message ?? "Failed");
            setSessionId(data.id);
            setLevel(config.startingLevel);
            setActiveGroupIdx(0);
            setPhase("round_setup");
          }}>Start session</Button>
        </Card>
      </Shell>
    );
  }

  // ===== ROUND SETUP =====
  if (phase === "round_setup") {
    return (
      <Shell title={`Round ${roundNum} of ${config.totalRounds}`}>
        <Card className="space-y-4 p-6">
          {config.groups.length > 1 && (
            <Field label="Active group for this round">
              <div className="flex flex-wrap gap-2">
                {config.groups.map((g, i) => (
                  <Button key={i} variant={activeGroupIdx === i ? "default" : "outline"} onClick={() => {
                    setActiveGroupIdx(i);
                    // adapt level based on this group's history
                    const groupResults = results.filter(r => r.groupName === g.name).slice(-2);
                    if (groupResults.length === 2) {
                      const avg = (groupResults[0].pct + groupResults[1].pct) / 2;
                      if (avg >= 85 && level < 4) setLevel(((level + 1) as any));
                      else if (avg < 60 && level > 1) setLevel(((level - 1) as any));
                    }
                  }}>{g.name} ({g.participants.length})</Button>
                ))}
              </div>
            </Field>
          )}
          <Field label="Difficulty">
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(n => <Button key={n} variant={level === n ? "default" : "outline"} onClick={() => setLevel(n as any)}>Level {n}</Button>)}
            </div>
          </Field>
          <Button className="w-full" onClick={() => {
            const s = pickStory(level, usedStories);
            const segs = s.segments.slice(0, activeGroup.participants.length);
            const storyForRound: Story = { ...s, segments: segs };
            setStory(storyForRound);
            setUsedStories([...usedStories, s.id]);
            setListenIdx(0);
            setPhase("listening");
          }}>Generate story → Start listening phase</Button>
        </Card>
      </Shell>
    );
  }

  // ===== LISTENING =====
  if (phase === "listening" && story) {
    return (
      <Shell title={`Listening · ${activeGroup.name}`}>
        <Card className="p-6">
          <p className="mb-4 text-sm text-muted-foreground">Pass the headphones to each participant in order. Tap Play when they have them on.</p>
          <ul className="space-y-2">
            {activeGroup.participants.map((p, i) => {
              const status = i < listenIdx ? "Done" : i === listenIdx ? "Listening" : "Waiting";
              return (
                <li key={i} className={`flex items-center justify-between rounded-md border p-3 ${i === listenIdx ? "border-primary bg-primary/5" : ""}`}>
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">Segment {i + 1} · {status}</div>
                  </div>
                  {i === listenIdx && (
                    <div className="flex gap-2">
                      <Button size="sm" disabled={audioLoading} onClick={() => playSegment(i)}>
                        {audioLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="mr-1 h-4 w-4" />}
                        Play
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        if (audioRef.current) audioRef.current.pause();
                        setListenIdx(listenIdx + 1);
                      }}>Done</Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {listenIdx >= activeGroup.participants.length && (
            <Button className="mt-4 w-full" onClick={() => {
              const inst = pickInstruction(usedInstructions);
              setInstruction(inst);
              setUsedInstructions([...usedInstructions, inst.id]);
              setPhase("instruction");
            }}>All done → Show recall instruction</Button>
          )}
        </Card>
      </Shell>
    );
  }

  // ===== INSTRUCTION =====
  if (phase === "instruction" && instruction) {
    return (
      <Shell title="Recall instruction">
        <Card className="p-8 text-center">
          <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{instruction.label}</div>
          <div className="text-2xl font-medium">{instruction.text}</div>
          <Button className="mt-6" onClick={() => {
            setCollabTime(COLLAB_TIMES[level] ?? 60);
            setInstructionHidden(false);
            setPhase("collaboration");
          }}>Start collaboration</Button>
        </Card>
      </Shell>
    );
  }

  // ===== COLLABORATION =====
  if (phase === "collaboration" && instruction) {
    return (
      <Shell title="Collaboration">
        <Card className="p-8 text-center">
          <div className="text-6xl font-bold tabular-nums">{collabTime}s</div>
          <div className="mt-4">
            {instructionHidden ? (
              <div className="italic text-muted-foreground">Instruction hidden</div>
            ) : (
              <div className="text-lg">{instruction.text}</div>
            )}
          </div>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={() => setInstructionHidden(v => !v)}>
              {instructionHidden ? <Eye className="mr-1 h-4 w-4" /> : <EyeOff className="mr-1 h-4 w-4" />}
              {instructionHidden ? "Show" : "Hide"} instruction
            </Button>
            <Button onClick={() => setPhase("response")}>End collaboration</Button>
          </div>
        </Card>
      </Shell>
    );
  }

  // ===== TEAM RESPONSE =====
  if (phase === "response" && instruction) {
    return (
      <Shell title="Team response">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Team is delivering their response.</p>
          <div className="mt-3 text-lg">{instruction.text}</div>
          <Button className="mt-6" onClick={() => setPhase("scoring")}>Reveal answer key</Button>
        </Card>
      </Shell>
    );
  }

  // ===== SCORING =====
  if (phase === "scoring" && story) {
    const setMark = (seg: number, fact: number, mark: FactMark) => {
      setFactMarks(prev => {
        const segMarks = { ...(prev[seg] ?? {}) };
        if (segMarks[fact] === mark) delete segMarks[fact];
        else segMarks[fact] = mark;
        return { ...prev, [seg]: segMarks };
      });
    };
    // Per-participant scoring. For real facts: correct = recalled. For distractors: correct = correctly ignored, incorrect = wrongly included.
    const perParticipant: ParticipantScore[] = activeGroup.participants.map((p, segIdx) => {
      const seg = story.segments[segIdx];
      const facts = seg?.facts ?? [];
      const realFacts = facts.filter(f => !f.is_distractor);
      let correct = 0;
      let distractorsIncluded = 0;
      facts.forEach((f, j) => {
        const mark = factMarks[segIdx]?.[j];
        if (f.is_distractor) {
          if (mark === "incorrect") distractorsIncluded += 1;
        } else {
          if (mark === "correct") correct += 1;
        }
      });
      const total = realFacts.length;
      const base = total ? (correct / total) * 100 : 0;
      const penalty = Math.min(distractorsIncluded * 10, 30);
      const pct = Math.max(0, Math.min(100, Math.round(base - penalty)));
      return { participant_id: p.participant_id, name: p.name, segmentIdx: segIdx, correct, total, distractorsIncluded, pct };
    });
    const groupPct = perParticipant.length
      ? Math.round(perParticipant.reduce((s, p) => s + p.pct, 0) / perParticipant.length)
      : 0;
    const totalDistractorsIncluded = perParticipant.reduce((s, p) => s + p.distractorsIncluded, 0);
    const instructionScore = instructionCompliance === "full" ? 3 : instructionCompliance === "partial" ? 1.5 : 0;
    // Marked? (every fact must have a mark before confirming)
    const totalFacts = story.segments.reduce((s, seg) => s + seg.facts.length, 0);
    const markedFacts = Object.values(factMarks).reduce((s, m) => s + Object.keys(m).length, 0);
    const allMarked = markedFacts === totalFacts;

    return (
      <Shell title="Scoring">
        <Card className="space-y-5 p-6">
          <div className="rounded-md border bg-muted/20 p-3 text-sm">
            Tap each fact <span className="font-medium text-emerald-600">Got it</span> if the team recalled it, or <span className="font-medium text-rose-600">Missed</span> if not. Distractors (⚠) score the opposite — Got it = correctly ignored.
          </div>

          <div className="space-y-4">
            {story.segments.map((s, i) => {
              const p = activeGroup.participants[i];
              const pp = perParticipant[i];
              return (
                <div key={i} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-baseline justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">Segment {i + 1} · heard by</div>
                      <div className="font-medium">{p?.name} <span className="font-mono text-xs text-muted-foreground">{p?.participant_id}</span></div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Their score</div>
                      <div className="text-xl font-bold tabular-nums">{pp?.pct ?? 0}%</div>
                    </div>
                  </div>
                  <ul className="space-y-1.5">
                    {s.facts.map((f, j) => {
                      const mark = factMarks[i]?.[j];
                      return (
                        <li key={j} className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm">
                          <span className={f.is_distractor ? "text-amber-600" : ""}>
                            {f.is_distractor ? "⚠ " : ""}<span className="font-medium">{f.label}:</span> {f.value}
                          </span>
                          <div className="flex shrink-0 gap-1">
                            <button
                              onClick={() => setMark(i, j, "correct")}
                              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${mark === "correct" ? "border-emerald-600 bg-emerald-600 text-white" : "border-border hover:bg-emerald-50"}`}
                            >✓ Got it</button>
                            <button
                              onClick={() => setMark(i, j, "incorrect")}
                              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${mark === "incorrect" ? "border-rose-600 bg-rose-600 text-white" : "border-border hover:bg-rose-50"}`}
                            >✗ {f.is_distractor ? "Included" : "Missed"}</button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          <div>
            <Label className="mb-2 block text-sm font-medium">Did the team follow the recall instruction?</Label>
            <div className="flex gap-2">
              {(["full", "partial", "none"] as const).map(v => (
                <Button key={v} size="sm" variant={instructionCompliance === v ? "default" : "outline"} onClick={() => setInstructionCompliance(v)}>
                  {v === "full" ? "Yes" : v === "partial" ? "Partly" : "No"}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-xs uppercase text-muted-foreground">Group round score</div>
            <div className="text-3xl font-bold">{groupPct}%</div>
            <div className="mt-1 text-xs text-muted-foreground">{markedFacts}/{totalFacts} facts marked</div>
          </div>

          <Button disabled={!allMarked} className="w-full" onClick={async () => {
            const scoreSet: ScoreSet = {
              detail: groupPct,
              order: groupPct,
              instruction: instructionScore,
              completeness: totalFacts ? Math.round((markedFacts / totalFacts) * 100) : 0,
              errors: totalDistractorsIncluded,
            };
            const r: Round = { roundNumber: roundNum, level, storyId: story.id, instructionId: instruction!.id, groupName: activeGroup.name, pct: groupPct, scores: scoreSet, perParticipant };
            const newResults = [...results, r];
            setResults(newResults);
            if (sessionId) {
              await supabase.from("rounds").insert({
                session_id: sessionId, round_number: roundNum, difficulty: level,
                data: { storyId: story.id, instructionId: instruction!.id, groupName: activeGroup.name, perParticipant, factMarks } as any,
                scores: { ...scoreSet, total: groupPct } as any,
              });
              for (const pp of perParticipant) {
                await supabase.from("participant_scores").insert({
                  participant_id: pp.participant_id, session_id: sessionId,
                  round_number: roundNum, dimension: "round_total", score: pp.pct,
                });
              }
            }
            setPhase("summary");
          }}>{allMarked ? "Confirm scores" : `Mark all facts (${markedFacts}/${totalFacts})`}</Button>
        </Card>
      </Shell>
    );
  }

  // ===== SUMMARY =====
  if (phase === "summary") {
    const last = results[results.length - 1];
    const isFinal = roundNum >= config.totalRounds;
    const groupResults = results.filter(r => r.groupName === activeGroup.name);
    const lastTwo = groupResults.slice(-2);
    const avg = lastTwo.reduce((s, r) => s + r.pct, 0) / lastTwo.length;
    let nextLevel = level;
    if (lastTwo.length === 2) {
      if (avg >= 85 && level < 4) nextLevel = (level + 1) as any;
      else if (avg < 60 && level > 1) nextLevel = (level - 1) as any;
    }
    const prevForGroup = groupResults[groupResults.length - 2];
    const coaching = pickCoaching(coachingPrompts, last, prevForGroup);
    return (
      <Shell title={`Round ${roundNum} summary · ${last.groupName}`}>
        <Card className="space-y-4 p-6">
          <div className="text-center">
            <div className="text-xs uppercase text-muted-foreground">Group score</div>
            <div className="text-4xl font-bold">{last.pct}%</div>
          </div>

          {last.perParticipant?.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-medium">Per participant</div>
              <div className="space-y-1.5">
                {last.perParticipant.map(pp => (
                  <div key={pp.participant_id} className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm">
                    <span><span className="font-mono text-xs text-muted-foreground">{pp.participant_id}</span> · {pp.name}</span>
                    <span className="tabular-nums"><span className="text-muted-foreground">{pp.correct}/{pp.total}{pp.distractorsIncluded ? ` · ${pp.distractorsIncluded}⚠` : ""}</span> <span className="ml-2 font-semibold">{pp.pct}%</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {coaching && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
                <Lightbulb className="h-4 w-4" /> Coaching prompt
              </div>
              <p className="text-sm"><span className="font-medium">Ask the group:</span> {coaching.ask}</p>
              <p className="mt-2 text-sm text-muted-foreground"><span className="font-medium">Tip:</span> {coaching.tip}</p>
            </div>
          )}

          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <div className="font-medium">Next round suggested: Level {nextLevel}</div>
            <div className="text-muted-foreground">
              {lastTwo.length === 2 ? `Based on ${last.groupName}'s rolling 2-round average (${Math.round(avg)}%).` : "Need 2 rounds for adaptive recommendation."}
            </div>
          </div>
          {isFinal ? (
            <Button className="w-full" onClick={async () => {
              if (sessionId) await supabase.from("sessions").update({ status: "completed", ended_at: new Date().toISOString(), state: { results } as any }).eq("id", sessionId);
              clearRestore();
              setPhase("results");
            }}>View session results</Button>
          ) : (
            <Button className="w-full" onClick={() => {
              setRoundNum(roundNum + 1);
              setLevel(nextLevel);
              setStory(null);
              setInstruction(null);
              setFactMarks({});
              setInstructionCompliance("full");
              setListenIdx(0);
              setPhase("round_setup");
            }}>Next round</Button>
          )}
        </Card>
      </Shell>
    );
  }

  // ===== RESULTS =====
  if (phase === "results") {
    const byGroup = config.groups.map(g => {
      const rs = results.filter(r => r.groupName === g.name);
      const avg = rs.length ? Math.round(rs.reduce((s, r) => s + r.pct, 0) / rs.length) : 0;
      return { name: g.name, rounds: rs, avg };
    });
    return (
      <Shell title="Session results">
        <Card className="space-y-6 p-6">
          {byGroup.map(g => (
            <div key={g.name}>
              <div className="mb-3 flex items-baseline justify-between">
                <div className="text-lg font-semibold">{g.name}</div>
                <div className="text-sm text-muted-foreground">Average <span className="text-2xl font-bold text-foreground">{g.avg}%</span></div>
              </div>
              {g.rounds.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rounds played.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr><th className="px-3 py-2">Round</th><th className="px-3 py-2">Level</th><th className="px-3 py-2">Score</th></tr>
                    </thead>
                    <tbody>
                      {g.rounds.map(r => (
                        <tr key={r.roundNumber} className="border-t">
                          <td className="px-3 py-2">{r.roundNumber}</td>
                          <td className="px-3 py-2">L{r.level}</td>
                          <td className="px-3 py-2 font-medium">{r.pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
          <Button asChild className="w-full"><Link to="/">End session</Link></Button>
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
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-4">
          <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="mr-1 h-4 w-4" />Home</Link></Button>
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-2 block text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

function ScoreInput({ label, value, onChange, max }: { label: string; value: number; onChange: (v: number) => void; max: number }) {
  return (
    <div>
      <Label className="mb-1 block text-xs">{label}</Label>
      <Input type="number" min={0} max={max} value={value} onChange={e => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}
