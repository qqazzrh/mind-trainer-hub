import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, History as HistoryIcon, Headphones, Grid3x3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFacilitator } from "@/lib/facilitator-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
  head: () => ({ meta: [{ title: "Session History — Brain Gym" }] }),
});

type SessionRow = {
  id: string;
  game_type: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  config: any;
  state: any;
  facilitator_id: string | null;
  facilitator_name?: string;
};

type RoundRow = {
  round_number: number;
  difficulty: number;
  scores: any;
  data: any;
};

function HistoryPage() {
  const { facilitator } = useFacilitator();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);

  useEffect(() => { if (!facilitator) navigate({ to: "/" }); }, [facilitator, navigate]);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase
        .from("sessions")
        .select("id, game_type, status, started_at, ended_at, config, state, facilitator_id")
        .order("started_at", { ascending: false })
        .limit(50);
      const { data: facs } = await supabase.from("facilitators").select("id, name");
      const byId = new Map((facs ?? []).map(f => [f.id, f.name]));
      setSessions((sess ?? []).map(s => ({ ...s, facilitator_name: s.facilitator_id ? byId.get(s.facilitator_id) : undefined })));
      setLoading(false);
    })();
  }, []);

  const openSession = async (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    const { data } = await supabase
      .from("rounds").select("round_number, difficulty, scores, data")
      .eq("session_id", id).order("round_number");
    setRounds(data ?? []);
  };

  if (!facilitator) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-6 py-4">
          <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="mr-1 h-4 w-4" />Home</Link></Button>
          <h1 className="flex items-center gap-2 text-lg font-semibold"><HistoryIcon className="h-5 w-5" />Session history</h1>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">
        {loading ? <p className="text-muted-foreground">Loading…</p> : sessions.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">No sessions yet.</Card>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => (
              <Card key={s.id} className="overflow-hidden">
                <button onClick={() => openSession(s.id)} className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-muted/30">
                  <div className="flex items-center gap-3">
                    {s.game_type === "story_sync" ? <Headphones className="h-5 w-5 text-primary" /> : <Grid3x3 className="h-5 w-5 text-primary" />}
                    <div>
                      <div className="font-medium">{s.game_type === "story_sync" ? "Story Sync" : "The Grid"}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(s.started_at).toLocaleString()} · {s.facilitator_name ?? "—"} · <span className="capitalize">{s.status.replace("_", " ")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{openId === s.id ? "Hide" : "View"}</div>
                </button>
                {openId === s.id && (
                  <div className="border-t bg-muted/20 p-4">
                    {rounds.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No rounds recorded.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs text-muted-foreground">
                          <tr><th className="py-1">Round</th><th>Level</th><th>Score</th><th>Detail</th></tr>
                        </thead>
                        <tbody>
                          {rounds.map(r => {
                            const total = r.scores?.total ?? r.scores?.team1Score ?? r.scores?.pct ?? "—";
                            const detail = s.game_type === "story_sync"
                              ? `D ${r.scores?.detail ?? 0} · O ${r.scores?.order ?? 0} · I ${r.scores?.instruction ?? 0}`
                              : r.scores?.team2Score !== undefined ? `T1 ${r.scores?.team1Score} vs T2 ${r.scores?.team2Score}` : "—";
                            return (
                              <tr key={r.round_number} className="border-t">
                                <td className="py-1.5">{r.round_number}</td>
                                <td>L{r.difficulty}</td>
                                <td className="font-medium">{typeof total === "number" ? `${total}%` : total}</td>
                                <td className="text-xs text-muted-foreground">{detail}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}