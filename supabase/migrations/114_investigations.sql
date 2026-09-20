-- Migration: investigations, which the sidebar has linked to since January
-- Drafted: September 20, 2026
--
-- /investigations is in the sidebar under Analysis and has roughly 2,000 lines of
-- interface behind it. None of its eight tables exist, so every visit fails.
--
-- The schema was not missing, only unapplied: 016_investigations.sql and
-- 040_investigation_notebooks.sql define it and were never run against this
-- database. They cannot be run now, for three reasons found by reading them:
--
--   1. Every RLS policy in 016 tests current_setting('app.user_id', true). That
--      is the Firebase-era session variable, and nothing sets it under Supabase
--      auth, so it evaluates NULL and every policy denies. Applying 016 unchanged
--      would create eight tables that silently return nothing to everybody - a
--      worse failure than the 400 it replaces, because it looks like it works.
--   2. investigations, and three tables in 040, carry a foreign key to teams,
--      which does not exist. Whether Vigil has teams is undecided, so team_id
--      survives as a plain uuid with no foreign key: the column is there when
--      the question is answered, and points at nothing until then.
--   3. 016 and 040 both define investigation_templates, with different columns.
--      016's version is the one the code reads (default_entries), so that is the
--      one kept.
--
-- Policies here follow what 073 settled on and what watchlists and saved_searches
-- already use: user_id is text, compared against (auth.uid())::text, one policy
-- per command.
--
-- investigation_entities is new. InvestigationNotebook.jsx reads it to fill an
-- "Entities" tab and nothing anywhere writes to it, so it is created with the
-- four columns that component reads and left empty. The tab will say "No linked
-- entities", which is true, instead of failing.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.investigations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL,
  team_id     uuid,                       -- no FK: see header
  title       text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'in_progress', 'closed', 'archived')),
  priority    text NOT NULL DEFAULT 'medium'
              CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  tags        text[] NOT NULL DEFAULT '{}',
  category    text,
  summary     text,
  tlp         text NOT NULL DEFAULT 'amber'
              CHECK (tlp IN ('red', 'amber', 'green', 'white')),
  is_shared   boolean NOT NULL DEFAULT false,
  shared_with text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  closed_at   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_investigations_user    ON public.investigations (user_id);
CREATE INDEX IF NOT EXISTS idx_investigations_status  ON public.investigations (status);
CREATE INDEX IF NOT EXISTS idx_investigations_created ON public.investigations (created_at DESC);

COMMENT ON TABLE public.investigations IS
  'Analyst notebooks: a case, its findings and the evidence behind them';
COMMENT ON COLUMN public.investigations.team_id IS
  'Reserved. No foreign key until there is a teams table to point at.';

CREATE TABLE IF NOT EXISTS public.investigation_entries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  entry_type       text NOT NULL CHECK (entry_type IN
                     ('note', 'finding', 'entity', 'evidence', 'action', 'timeline_event')),
  content          jsonb NOT NULL DEFAULT '{}',
  created_by       text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_investigation_entries_inv
  ON public.investigation_entries (investigation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.investigation_collaborators (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  user_id          text NOT NULL,
  role             text NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),
  added_by         text,
  added_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (investigation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_investigation_collab_user
  ON public.investigation_collaborators (user_id);

CREATE TABLE IF NOT EXISTS public.investigation_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  description     text,
  category        text,
  default_entries jsonb NOT NULL DEFAULT '[]',
  checklist       jsonb NOT NULL DEFAULT '[]',
  is_system       boolean NOT NULL DEFAULT false,
  created_by      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Read-only in the interface; nothing writes one yet.
CREATE TABLE IF NOT EXISTS public.investigation_entities (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  entity_type      text NOT NULL,
  entity_id        text NOT NULL,
  display_name     text,
  added_by         text,
  added_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (investigation_id, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_investigation_entities_inv
  ON public.investigation_entities (investigation_id);

CREATE TABLE IF NOT EXISTS public.investigation_activities (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  user_id          text,
  activity_type    text NOT NULL,
  description      text,
  old_value        jsonb,
  new_value        jsonb,
  metadata         jsonb NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_investigation_activities_inv
  ON public.investigation_activities (investigation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.investigation_comments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  user_id          text NOT NULL,
  parent_id        uuid REFERENCES public.investigation_comments(id) ON DELETE CASCADE,
  content          text NOT NULL,
  content_html     text,
  mentions         text[] NOT NULL DEFAULT '{}',
  is_edited        boolean NOT NULL DEFAULT false,
  edited_at        timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_investigation_comments_inv
  ON public.investigation_comments (investigation_id, created_at);

CREATE TABLE IF NOT EXISTS public.investigation_checklist (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  content          text NOT NULL,
  is_completed     boolean NOT NULL DEFAULT false,
  completed_by     text,
  completed_at     timestamptz,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_investigation_checklist_inv
  ON public.investigation_checklist (investigation_id, sort_order);

-- ---------------------------------------------------------------------------
-- 2. Visibility
-- ---------------------------------------------------------------------------
-- The investigations policy has to consult investigation_collaborators, and the
-- collaborators policy has to consult investigations. Expressed directly that is
-- mutual recursion and Postgres refuses it, so the lookup is a SECURITY DEFINER
-- function, which runs without RLS and breaks the cycle.
CREATE OR REPLACE FUNCTION public.can_see_investigation(p_investigation uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM investigations i
    WHERE i.id = p_investigation
      AND ( i.user_id = (auth.uid())::text
         OR (auth.uid())::text = ANY (i.shared_with)
         OR EXISTS (SELECT 1 FROM investigation_collaborators c
                    WHERE c.investigation_id = i.id
                      AND c.user_id = (auth.uid())::text) )
  );
$$;

COMMENT ON FUNCTION public.can_see_investigation(uuid) IS
  'Owner, explicitly shared with, or a collaborator. SECURITY DEFINER so the child-table policies do not recurse into investigations.';

GRANT EXECUTE ON FUNCTION public.can_see_investigation(uuid) TO authenticated;

ALTER TABLE public.investigations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_entities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_activities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_checklist     ENABLE ROW LEVEL SECURITY;

-- An investigation is readable by owner, sharee or collaborator; only the owner
-- may change or delete it.
CREATE POLICY investigations_select ON public.investigations
  FOR SELECT TO authenticated USING (
    user_id = (auth.uid())::text
    OR (auth.uid())::text = ANY (shared_with)
    OR EXISTS (SELECT 1 FROM public.investigation_collaborators c
               WHERE c.investigation_id = investigations.id
                 AND c.user_id = (auth.uid())::text));
CREATE POLICY investigations_insert ON public.investigations
  FOR INSERT TO authenticated WITH CHECK (user_id = (auth.uid())::text);
CREATE POLICY investigations_update ON public.investigations
  FOR UPDATE TO authenticated USING (user_id = (auth.uid())::text);
CREATE POLICY investigations_delete ON public.investigations
  FOR DELETE TO authenticated USING (user_id = (auth.uid())::text);

-- Everything hanging off an investigation inherits its visibility.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['investigation_entries', 'investigation_entities',
                           'investigation_activities', 'investigation_comments',
                           'investigation_checklist', 'investigation_collaborators']
  LOOP
    EXECUTE format(
      'CREATE POLICY %1$s_all ON public.%1$s FOR ALL TO authenticated
         USING (public.can_see_investigation(investigation_id))
         WITH CHECK (public.can_see_investigation(investigation_id))', t);
  END LOOP;
END $$;

-- Templates are reference data: readable by anyone signed in, writable by nobody
-- through the API.
CREATE POLICY investigation_templates_read ON public.investigation_templates
  FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 3. Keep updated_at honest
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_investigation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS investigations_touch ON public.investigations;
CREATE TRIGGER investigations_touch BEFORE UPDATE ON public.investigations
  FOR EACH ROW EXECUTE FUNCTION public.touch_investigation();

DROP TRIGGER IF EXISTS investigation_entries_touch ON public.investigation_entries;
CREATE TRIGGER investigation_entries_touch BEFORE UPDATE ON public.investigation_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_investigation();

-- ---------------------------------------------------------------------------
-- 4. Summary view
-- ---------------------------------------------------------------------------
-- security_invoker so the view is filtered by the caller's own RLS rather than
-- the owner's; 073 removed fourteen views that bypassed it.
DROP VIEW IF EXISTS public.v_investigation_summary;
CREATE VIEW public.v_investigation_summary WITH (security_invoker = true) AS
SELECT i.id, i.user_id, i.team_id, i.title, i.description, i.status, i.priority,
       i.category, i.tags, i.tlp, i.created_at, i.updated_at, i.closed_at,
       count(e.id)                                                AS entry_count,
       count(*) FILTER (WHERE e.entry_type = 'entity')             AS entity_count,
       count(*) FILTER (WHERE e.entry_type = 'finding')            AS finding_count
FROM public.investigations i
LEFT JOIN public.investigation_entries e ON e.investigation_id = i.id
GROUP BY i.id;

GRANT SELECT ON public.v_investigation_summary TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Starting templates
-- ---------------------------------------------------------------------------
INSERT INTO public.investigation_templates (name, description, category, default_entries, checklist, is_system)
SELECT * FROM (VALUES
  ('Ransomware Incident', 'Template for investigating ransomware attacks', 'ransomware',
   '[{"entry_type":"note","content":{"text":"## Initial Assessment\n\n- Affected systems:\n- Ransom note observed:\n- Encryption extension:\n"}},
     {"entry_type":"note","content":{"text":"## Containment Actions\n\n- [ ] Isolated affected systems\n- [ ] Disabled compromised accounts\n- [ ] Blocked C2 domains/IPs\n"}}]'::jsonb,
   '[{"item":"Identify the ransomware variant","required":true},
     {"item":"Document affected systems and data","required":true},
     {"item":"Identify initial access vector","required":true},
     {"item":"Check for data exfiltration","required":false},
     {"item":"Engage law enforcement if required","required":false},
     {"item":"Document lessons learned","required":true}]'::jsonb,
   true),
  ('Phishing Investigation', 'Template for investigating phishing campaigns', 'phishing',
   '[{"entry_type":"note","content":{"text":"## Email Analysis\n\n- Subject:\n- Sender:\n- Recipients:\n- Links:\n- Attachments:\n"}},
     {"entry_type":"note","content":{"text":"## Impact Assessment\n\n- Users who clicked:\n- Credentials entered:\n- Malware downloaded:\n"}}]'::jsonb,
   '[{"item":"Analyze email headers","required":true},
     {"item":"Extract and analyze IOCs","required":true},
     {"item":"Identify affected users","required":true},
     {"item":"Reset compromised credentials","required":false}]'::jsonb,
   true)
) AS v(name, description, category, default_entries, checklist, is_system)
WHERE NOT EXISTS (SELECT 1 FROM public.investigation_templates WHERE is_system);
