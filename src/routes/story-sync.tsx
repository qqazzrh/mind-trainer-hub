import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Play, Eye, EyeOff, Volume2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
type Config = { participants: Slot[]; totalRounds: number; startingLevel: 1 | 2 | 3 };
type Round = { roundNumber: number; level: number; storyId: string; instructionId: string; total: number; pct: number };

const COLLAB_TIMES: Record<number, number> = { 1: 90, 2: 75, 3: 60, 4: 45 };

function StorySync() {
  const { facilitator } = useFacilitator();
  const navigate = useNavigate();
  const tts = useServerFn(synthesizeSpeech);
  const [phase, setPhase] = useState<Phase>("setup");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [config, setConfig] = useState<Config>({ participants: [], totalRounds: 4, startingLevel: 1 });
  const [pidInput, setPidInput] = useState("");
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
  const [scores, setScores] = useState({ detail: 0, order: 0, instruction: 0, completeness: 0, errors: 0 });
  const [results, setResults] = useState<Round[]>([]);

  useEffect(() => { if (!facilitator) navigate({ to: "/" }); }, [facilitator, navigate]);

  // Collaboration timer
  useEffect(() => {
    if (phase !== "collaboration") return;
    if (collabTime <= 0) { setPhase("response"); return; }
    const t = setTimeout(() => setCollabTime(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, collabTime]);

  if (!facilitator) return null;

  const addParticipant = async () => {
    const id = pidInput.trim();
    if (!id) return;
    const { data } = await supabase.from("participants").select("participant_id, name").eq("participant_id", id).maybeSingle();
    if (!data) return toast.error(`Participant ${id} not found. Add them in Participants first.`);
    if (config.participants.some(p => p.participant_id === id)) return toast.error("Already added");
    if (config.participants.length >= 6) return toast.error("Max 6 participants");
    setConfig({ ...config, participants: [...config.participants, data] });
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

  // ===== SETUP =====
  if (phase === "setup") {
    const valid = config.participants.length >= 2;
    return (
      <Shell title="Story Sync — Setup">
        <Card className="space-y-5 p-6">
          <Field label="Add participants by ID (2–6)">
            <div className="flex gap-2">
              <Input value={pidInput} onChange={e => setPidInput(e.target.value)} placeholder="P-001" onKeyDown={e => e.key === "Enter" && addParticipant()} />
              <Button onClick={addParticipant}>Add</Button>
            </div>
            <div className="mt-3 space-y-1">
              {config.participants.map((p, i) => (
                <div key={p.participant_id} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <span><span className="font-mono text-xs text-muted-foreground">{p.participant_id}</span> · {p.name}</span>
                  <button onClick={() => setConfig({ ...config, participants: config.participants.filter((_, j) => j !== i) })} className="text-xs text-destructive">Remove</button>
                </div>
              ))}
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
          <Field label="Difficulty">
            <div className="flex gap-2">
              {[1, 2, 3].map(n => <Button key={n} variant={level === n ? "default" : "outline"} onClick={() => setLevel(n as 1 | 2 | 3)}>Level {n}</Button>)}
            </div>
          </Field>
          <Button className="w-full" onClick={() => {
            const s = pickStory(level, usedStories);
            const segs = s.segments.slice(0, config.participants.length);
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
      <Shell title="Listening phase">
        <Card className="p-6">
          <p className="mb-4 text-sm text-muted-foreground">Pass the headphones to each participant in order. Tap Play when they have them on.</p>
          <ul className="space-y-2">
            {config.participants.map((p, i) => {
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
          {listenIdx >= config.participants.length && (
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
    const total =
      scores.detail * 0.30 +
      scores.order * 0.25 +
      scores.instruction * 0.20 +
      scores.completeness * 0.10 -
      Math.min(scores.errors * 5, 25);
    const pct = Math.max(0, Math.min(100, Math.round(total)));
    return (
      <Shell title="Scoring">
        <Card className="space-y-4 p-6">
          <div>
            <div className="mb-2 text-sm font-medium">Answer key</div>
            <div className="space-y-2">
              {story.segments.map((s, i) => (
                <div key={i} className="rounded-md border p-3 text-sm">
                  <div className="text-xs text-muted-foreground">Segment {i + 1}</div>
                  <ul className="mt-1 space-y-1">
                    {s.facts.map((f, j) => (
                      <li key={j} className={f.is_distractor ? "text-amber-600" : ""}>
                        {f.is_distractor ? "⚠ " : "• "}<span className="font-medium">{f.label}:</span> {f.value}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <ScoreInput label="Detail accuracy (0–100)" value={scores.detail} onChange={v => setScores({ ...scores, detail: v })} max={100} />
            <ScoreInput label="Order accuracy (0–100)" value={scores.order} onChange={v => setScores({ ...scores, order: v })} max={100} />
            <ScoreInput label="Instruction compliance (0–3)" value={scores.instruction} onChange={v => setScores({ ...scores, instruction: v })} max={3} />
            <ScoreInput label="Completeness (0–100)" value={scores.completeness} onChange={v => setScores({ ...scores, completeness: v })} max={100} />
            <ScoreInput label="Error count" value={scores.errors} onChange={v => setScores({ ...scores, errors: v })} max={20} />
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-xs uppercase text-muted-foreground">Round score</div>
            <div className="text-3xl font-bold">{pct}%</div>
          </div>

          <Button className="w-full" onClick={async () => {
            const r: Round = { roundNumber: roundNum, level, storyId: story.id, instructionId: instruction!.id, total: pct, pct };
            const newResults = [...results, r];
            setResults(newResults);
            if (sessionId) {
              await supabase.from("rounds").insert({
                session_id: sessionId, round_number: roundNum, difficulty: level,
                data: { storyId: story.id, instructionId: instruction!.id } as any,
                scores: { ...scores, total: pct } as any,
              });
              for (const p of config.participants) {
                await supabase.from("participant_scores").insert({
                  participant_id: p.participant_id, session_id: sessionId,
                  round_number: roundNum, dimension: "round_total", score: pct,
                });
              }
            }
            setPhase("summary");
          }}>Confirm scores</Button>
        </Card>
      </Shell>
    );
  }

  // ===== SUMMARY =====
  if (phase === "summary") {
    const last = results[results.length - 1];
    const isFinal = roundNum >= config.totalRounds;
    // Adaptive
    const lastTwo = results.slice(-2);
    const avg = lastTwo.reduce((s, r) => s + r.pct, 0) / lastTwo.length;
    let nextLevel = level;
    if (avg >= 85 && level < 4) nextLevel = (level + 1) as any;
    else if (avg < 60 && level > 1) nextLevel = (level - 1) as any;
    return (
      <Shell title={`Round ${roundNum} summary`}>
        <Card className="space-y-4 p-6">
          <div className="text-center">
            <div className="text-xs uppercase text-muted-foreground">Score</div>
            <div className="text-4xl font-bold">{last.pct}%</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <div className="font-medium">Next round suggested: Level {nextLevel}</div>
            <div className="text-muted-foreground">Based on rolling 2-round average ({Math.round(avg)}%).</div>
          </div>
          {isFinal ? (
            <Button className="w-full" onClick={async () => {
              if (sessionId) await supabase.from("sessions").update({ status: "completed", ended_at: new Date().toISOString(), state: { results } as any }).eq("id", sessionId);
              setPhase("results");
            }}>View session results</Button>
          ) : (
            <Button className="w-full" onClick={() => {
              setRoundNum(roundNum + 1);
              setLevel(nextLevel);
              setStory(null);
              setInstruction(null);
              setScores({ detail: 0, order: 0, instruction: 0, completeness: 0, errors: 0 });
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
    const avg = Math.round(results.reduce((s, r) => s + r.pct, 0) / results.length);
    return (
      <Shell title="Session results">
        <Card className="p-6">
          <div className="mb-6 text-center">
            <div className="text-xs uppercase text-muted-foreground">Average score</div>
            <div className="text-5xl font-bold">{avg}%</div>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr><th className="px-3 py-2">Round</th><th className="px-3 py-2">Level</th><th className="px-3 py-2">Score</th></tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.roundNumber} className="border-t">
                    <td className="px-3 py-2">{r.roundNumber}</td>
                    <td className="px-3 py-2">L{r.level}</td>
                    <td className="px-3 py-2 font-medium">{r.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button asChild className="mt-6 w-full"><Link to="/">End session</Link></Button>
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