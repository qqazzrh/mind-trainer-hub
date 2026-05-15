
-- Facilitators
CREATE TABLE public.facilitators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Participants
CREATE TABLE public.participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sessions (covers both games)
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type TEXT NOT NULL CHECK (game_type IN ('story_sync','the_grid')),
  facilitator_id UUID REFERENCES public.facilitators(id) ON DELETE SET NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_started_at ON public.sessions(started_at DESC);

-- Rounds
CREATE TABLE public.rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  difficulty INT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, round_number)
);

-- Participant long-term scores
CREATE TABLE public.participant_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id TEXT NOT NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  round_number INT,
  dimension TEXT,
  score NUMERIC,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_participant_scores_pid ON public.participant_scores(participant_id);

-- Story library
CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  difficulty_level INT NOT NULL,
  title TEXT,
  full_text TEXT NOT NULL,
  segments JSONB NOT NULL,
  answer_keys JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coaching prompts
CREATE TABLE public.coaching_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern TEXT NOT NULL,
  ask TEXT NOT NULL,
  tip TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS, allow anon access (internal facilitator app, no auth)
ALTER TABLE public.facilitators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_prompts ENABLE ROW LEVEL SECURITY;

-- Permissive policies (no facilitator auth in v1)
CREATE POLICY "anon all facilitators" ON public.facilitators FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon all participants" ON public.participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon all sessions" ON public.sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon all rounds" ON public.rounds FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon all pscores" ON public.participant_scores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon all stories" ON public.stories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon all coaching" ON public.coaching_prompts FOR ALL USING (true) WITH CHECK (true);
