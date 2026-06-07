import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Brain, Grid3x3, Headphones, LogOut, Users, History, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFacilitator, type Facilitator } from "@/lib/facilitator-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Brain Gym — Facilitator Console" },
      { name: "description", content: "Run brain training exercises with your group." },
    ],
  }),
});

function Home() {
  const { facilitator, setFacilitator } = useFacilitator();
  const [facilitatorId, setFacilitatorId] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const id = facilitatorId.trim();
    const nm = name.trim();
    if (!id || !nm) {
      setError("Please enter both your ID and name.");
      return;
    }
    setSubmitting(true);
    const { data, error: qErr } = await supabase
      .from("facilitators")
      .select("id, facilitator_id, name")
      .ilike("facilitator_id", id)
      .ilike("name", nm)
      .maybeSingle();
    setSubmitting(false);
    if (qErr) {
      setError("Something went wrong. Please try again.");
      return;
    }
    if (!data) {
      setError("No matching record. Please retry or contact owner: team@nuracare.co");
      return;
    }
    setFacilitator(data as Facilitator);
  };

  if (!facilitator) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
        <div className="mx-auto max-w-2xl px-6 py-16">
          <div className="mb-12 flex flex-col items-center text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Brain className="h-9 w-9" />
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">Brain Gym</h1>
            <p className="mt-3 text-muted-foreground">Enter your facilitator ID and name to get started.</p>
          </div>

          <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4 rounded-xl border bg-card p-6 shadow-sm">
            <div className="space-y-2">
              <Label htmlFor="fid">Facilitator ID</Label>
              <Input
                id="fid"
                value={facilitatorId}
                onChange={(e) => setFacilitatorId(e.target.value)}
                placeholder="FAC-001"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fname">Name</Label>
              <Input
                id="fname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="your first name"
                autoComplete="off"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Checking…" : "Continue"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <span className="font-semibold">Brain Gym</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {facilitator.name} · {facilitator.facilitator_id}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setFacilitator(null)}>
              <LogOut className="mr-1 h-4 w-4" /> Switch
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">Choose an exercise</h1>
          <p className="mt-2 text-muted-foreground">Run either game in any order.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Link to="/story-sync" className="group">
            <Card className="relative overflow-hidden p-8 transition hover:border-primary hover:shadow-lg">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Headphones className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-semibold">Story Sync</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Each participant hears one segment of a story. The team rebuilds it together under a recall rule.
              </p>
              <div className="mt-6 text-sm font-medium text-primary group-hover:underline">Start session →</div>
            </Card>
          </Link>

          <Link to="/the-grid" className="group">
            <Card className="relative overflow-hidden p-8 transition hover:border-primary hover:shadow-lg">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Grid3x3 className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-semibold">The Grid</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Two teams memorize a shared pattern in sections, then reconstruct it from memory on paper.
              </p>
              <div className="mt-6 text-sm font-medium text-primary group-hover:underline">Start session →</div>
            </Card>
          </Link>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          <Link to="/participants" className="rounded-lg border bg-card p-4 transition hover:border-primary">
            <Users className="mb-2 h-5 w-5 text-muted-foreground" />
            <div className="text-sm font-medium">Participants</div>
            <div className="text-xs text-muted-foreground">Add and manage people</div>
          </Link>
          <Link to="/history" className="rounded-lg border bg-card p-4 transition hover:border-primary">
            <History className="mb-2 h-5 w-5 text-muted-foreground" />
            <div className="text-sm font-medium">Session history</div>
            <div className="text-xs text-muted-foreground">Past sessions and results</div>
          </Link>
          <Link to="/lookup" className="rounded-lg border bg-card p-4 transition hover:border-primary">
            <Search className="mb-2 h-5 w-5 text-muted-foreground" />
            <div className="text-sm font-medium">Participant lookup</div>
            <div className="text-xs text-muted-foreground">Long-term performance</div>
          </Link>
        </div>
      </main>
    </div>
  );
}
