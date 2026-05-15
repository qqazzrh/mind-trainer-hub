import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFacilitator } from "@/lib/facilitator-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/lookup")({
  component: LookupPage,
  head: () => ({ meta: [{ title: "Participant Lookup — Brain Gym" }] }),
});

type Participant = { participant_id: string; name: string };
type ScoreRow = { session_id: string | null; round_number: number | null; dimension: string | null; score: number | null; recorded_at: string };

function LookupPage() {
  const { facilitator } = useFacilitator();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Participant[]>([]);
  const [selected, setSelected] = useState<Participant | null>(null);
  const [scores, setScores] = useState<ScoreRow[]>([]);

  useEffect(() => { if (!facilitator) navigate({ to: "/" }); }, [facilitator, navigate]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) { setResults([]); return; }
      const { data } = await supabase
        .from("participants").select("participant_id, name")
        .or(`participant_id.ilike.%${q}%,name.ilike.%${q}%`).limit(20);
      setResults(data ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const pick = async (p: Participant) => {
    setSelected(p);
    const { data } = await supabase
      .from("participant_scores")
      .select("session_id, round_number, dimension, score, recorded_at")
      .eq("participant_id", p.participant_id).order("recorded_at", { ascending: false }).limit(100);
    setScores(data ?? []);
  };

  if (!facilitator) return null;

  const totals = scores.filter(s => s.dimension === "round_total" && s.score !== null);
  const avg = totals.length ? Math.round(totals.reduce((a, s) => a + Number(s.score), 0) / totals.length) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-4">
          <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="mr-1 h-4 w-4" />Home</Link></Button>
          <h1 className="flex items-center gap-2 text-lg font-semibold"><Search className="h-5 w-5" />Participant lookup</h1>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 px-6 py-8">
        <Card className="p-4">
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by ID or name…" autoFocus />
          {results.length > 0 && (
            <div className="mt-3 space-y-1">
              {results.map(p => (
                <button key={p.participant_id} onClick={() => pick(p)} className="flex w-full items-center justify-between rounded-md border bg-card px-3 py-2 text-left text-sm hover:border-primary">
                  <span><span className="font-mono text-xs text-muted-foreground">{p.participant_id}</span> · {p.name}</span>
                  <span className="text-xs text-primary">View →</span>
                </button>
              ))}
            </div>
          )}
        </Card>

        {selected && (
          <Card className="space-y-4 p-6">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{selected.participant_id}</div>
              <div className="text-2xl font-semibold">{selected.name}</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Sessions participated</div>
                <div className="text-2xl font-bold">{new Set(scores.map(s => s.session_id)).size}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Average round score</div>
                <div className="text-2xl font-bold">{avg !== null ? `${avg}%` : "—"}</div>
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium">Recent rounds</div>
              {totals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No round scores yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs">
                      <tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Round</th><th className="px-3 py-2">Score</th></tr>
                    </thead>
                    <tbody>
                      {totals.slice(0, 20).map((s, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(s.recorded_at).toLocaleString()}</td>
                          <td className="px-3 py-2">#{s.round_number}</td>
                          <td className="px-3 py-2 font-medium">{Math.round(Number(s.score))}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}