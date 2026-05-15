import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useFacilitator } from "@/lib/facilitator-context";

export const Route = createFileRoute("/participants")({
  component: ParticipantsPage,
  head: () => ({ meta: [{ title: "Participants — Brain Gym" }] }),
});

type P = { id: string; participant_id: string; name: string };

function ParticipantsPage() {
  const { facilitator } = useFacilitator();
  const navigate = useNavigate();
  const [list, setList] = useState<P[]>([]);
  const [pid, setPid] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!facilitator) navigate({ to: "/" });
  }, [facilitator, navigate]);

  const load = async () => {
    const { data } = await supabase
      .from("participants")
      .select("id, participant_id, name")
      .order("participant_id");
    setList(data ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!pid.trim() || !name.trim()) return toast.error("ID and name required");
    setBusy(true);
    const { error } = await supabase.from("participants").insert({
      participant_id: pid.trim(),
      name: name.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Added");
    setPid("");
    setName("");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this participant?")) return;
    const { error } = await supabase.from("participants").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const importCsv = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return;
    const header = lines[0].toLowerCase();
    const sep = header.includes(";") ? ";" : ",";
    const cols = header.split(sep).map((s) => s.trim());
    const idIdx = cols.findIndex((c) => c.includes("participant_id") || c === "id");
    const nameIdx = cols.findIndex((c) => c.includes("name"));
    if (idIdx === -1 || nameIdx === -1) return toast.error("CSV needs 'participant_id' and 'name' columns");
    const rows: { participant_id: string; name: string }[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(sep);
      const id = parts[idIdx]?.trim();
      const nm = parts[nameIdx]?.trim();
      if (id && nm) rows.push({ participant_id: id, name: nm });
    }
    if (rows.length === 0) return toast.error("No rows parsed");
    const { error } = await supabase.from("participants").upsert(rows, { onConflict: "participant_id" });
    if (error) return toast.error(error.message);
    toast.success(`Imported ${rows.length}`);
    load();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-6 py-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/"><ArrowLeft className="mr-1 h-4 w-4" />Home</Link>
          </Button>
          <h1 className="text-lg font-semibold">Participants</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <Card className="mb-6 p-5">
          <div className="mb-3 text-sm font-medium">Add participant</div>
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Participant ID (e.g. P-001)"
              value={pid}
              onChange={(e) => setPid(e.target.value)}
              className="w-56"
            />
            <Input
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-64"
            />
            <Button onClick={add} disabled={busy}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
            <label className="ml-auto inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent">
              <Upload className="h-4 w-4" /> Import CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importCsv(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </Card>

        <Card>
          <div className="border-b px-5 py-3 text-sm font-medium">
            {list.length} participant{list.length === 1 ? "" : "s"}
          </div>
          {list.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No participants yet. Add some above or import a CSV.
            </div>
          ) : (
            <ul className="divide-y">
              {list.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="font-mono text-xs text-muted-foreground">{p.participant_id}</div>
                    <div className="font-medium">{p.name}</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}