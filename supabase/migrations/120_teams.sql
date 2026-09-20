-- Migration: teams
-- Decided: September 20, 2026
--
-- Four tables have been referenced across a dozen migrations and by
-- src/lib/supabase/teams.js since January, and none of them existed. Every
-- migration that wanted a team_id carried a foreign key to nothing, which is why
-- 016, 017, 018 and 040 could not be applied as written, and why 117-119 left
-- team_id as a bare uuid.
--
-- Vigil has teams. The columns below are the ones teams.js already reads and
-- writes, not a new design.
--
-- The access rules need care, because the obvious expression of them does not
-- work. "A team is visible to its members" has to consult team_members, and
-- "a member row is visible to co-members" has to consult team_members again -
-- a policy on a table that queries the same table is infinite recursion, and
-- Postgres raises rather than looping. Both lookups are therefore SECURITY
-- DEFINER functions, which run without RLS and terminate.
--
-- Two moments need more than "is a member":
--
--   * createTeam inserts the team, then inserts the owner's own member row. In
--     between, the caller owns a team they are not yet a member of, so the
--     member insert is allowed for a team admin, where admin includes
--     teams.owner_id.
--   * acceptInvitation inserts a member row for the caller before they are a
--     member of anything. That is allowed only when an unaccepted, unexpired
--     invitation exists for that team addressed to the caller's own email.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  description text,
  owner_id    text NOT NULL,
  settings    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teams_owner ON public.teams (owner_id);

COMMENT ON TABLE public.teams IS
  'A group of users sharing investigations, assets, watchlists and audit settings';

CREATE TABLE IF NOT EXISTS public.team_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id      text NOT NULL,
  email        text NOT NULL DEFAULT '',
  display_name text,
  role         text NOT NULL DEFAULT 'member'
               CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by   text,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members (user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members (team_id);

CREATE TABLE IF NOT EXISTS public.team_invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'member'
              CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  token       text NOT NULL UNIQUE,
  invited_by  text,
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, email)
);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON public.team_invitations (token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON public.team_invitations (lower(email));

CREATE TABLE IF NOT EXISTS public.team_activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id     text,
  action      text NOT NULL,
  entity_type text,
  entity_id   text,
  details     jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_team_activity_team
  ON public.team_activity_log (team_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. Membership lookups that do not recurse
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_team_member(p_team uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM team_members m
                 WHERE m.team_id = p_team AND m.user_id = (auth.uid())::text);
$$;

-- Admin includes the owner recorded on the team itself, so that createTeam can
-- insert the owner's member row before that row exists.
CREATE OR REPLACE FUNCTION public.is_team_admin(p_team uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM teams t
                 WHERE t.id = p_team AND t.owner_id = (auth.uid())::text)
      OR EXISTS (SELECT 1 FROM team_members m
                 WHERE m.team_id = p_team AND m.user_id = (auth.uid())::text
                   AND m.role IN ('owner', 'admin'));
$$;

COMMENT ON FUNCTION public.is_team_member(uuid) IS
  'SECURITY DEFINER: a policy on team_members cannot query team_members without recursing.';
COMMENT ON FUNCTION public.is_team_admin(uuid) IS
  'Owner on teams, or a member holding owner/admin. SECURITY DEFINER for the same reason.';

GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_admin(uuid)  TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Policies
-- ---------------------------------------------------------------------------
ALTER TABLE public.teams             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teams_select ON public.teams;
CREATE POLICY teams_select ON public.teams FOR SELECT TO authenticated
  USING (owner_id = (auth.uid())::text OR public.is_team_member(id));

DROP POLICY IF EXISTS teams_insert ON public.teams;
CREATE POLICY teams_insert ON public.teams FOR INSERT TO authenticated
  WITH CHECK (owner_id = (auth.uid())::text);

DROP POLICY IF EXISTS teams_update ON public.teams;
CREATE POLICY teams_update ON public.teams FOR UPDATE TO authenticated
  USING (public.is_team_admin(id)) WITH CHECK (public.is_team_admin(id));

-- Deleting a team cascades to its members, invitations and activity, so it is
-- the owner's alone - not an admin's.
DROP POLICY IF EXISTS teams_delete ON public.teams;
CREATE POLICY teams_delete ON public.teams FOR DELETE TO authenticated
  USING (owner_id = (auth.uid())::text);

DROP POLICY IF EXISTS team_members_select ON public.team_members;
CREATE POLICY team_members_select ON public.team_members FOR SELECT TO authenticated
  USING (user_id = (auth.uid())::text OR public.is_team_member(team_id));

-- An admin may add anyone; a person may add only themselves, and only against an
-- invitation addressed to them that is neither accepted nor expired.
DROP POLICY IF EXISTS team_members_insert ON public.team_members;
CREATE POLICY team_members_insert ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_team_admin(team_id)
    OR ( user_id = (auth.uid())::text
         AND EXISTS (SELECT 1 FROM public.team_invitations i
                     WHERE i.team_id = team_members.team_id
                       AND lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
                       AND i.accepted_at IS NULL
                       AND i.expires_at > now())));

DROP POLICY IF EXISTS team_members_update ON public.team_members;
CREATE POLICY team_members_update ON public.team_members FOR UPDATE TO authenticated
  USING (public.is_team_admin(team_id)) WITH CHECK (public.is_team_admin(team_id));

-- An admin may remove anyone; anyone may remove themselves.
DROP POLICY IF EXISTS team_members_delete ON public.team_members;
CREATE POLICY team_members_delete ON public.team_members FOR DELETE TO authenticated
  USING (public.is_team_admin(team_id) OR user_id = (auth.uid())::text);

DROP POLICY IF EXISTS team_invitations_select ON public.team_invitations;
CREATE POLICY team_invitations_select ON public.team_invitations FOR SELECT TO authenticated
  USING (public.is_team_admin(team_id)
         OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

DROP POLICY IF EXISTS team_invitations_write ON public.team_invitations;
CREATE POLICY team_invitations_write ON public.team_invitations FOR INSERT TO authenticated
  WITH CHECK (public.is_team_admin(team_id));

-- The invitee marks their own invitation accepted; an admin may change any.
DROP POLICY IF EXISTS team_invitations_update ON public.team_invitations;
CREATE POLICY team_invitations_update ON public.team_invitations FOR UPDATE TO authenticated
  USING (public.is_team_admin(team_id)
         OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

DROP POLICY IF EXISTS team_invitations_delete ON public.team_invitations;
CREATE POLICY team_invitations_delete ON public.team_invitations FOR DELETE TO authenticated
  USING (public.is_team_admin(team_id));

DROP POLICY IF EXISTS team_activity_select ON public.team_activity_log;
CREATE POLICY team_activity_select ON public.team_activity_log FOR SELECT TO authenticated
  USING (public.is_team_member(team_id));

DROP POLICY IF EXISTS team_activity_insert ON public.team_activity_log;
CREATE POLICY team_activity_insert ON public.team_activity_log FOR INSERT TO authenticated
  WITH CHECK (public.is_team_member(team_id));

-- ---------------------------------------------------------------------------
-- 4. Close the foreign keys that 117-119 left open
-- ---------------------------------------------------------------------------
-- Those three migrations kept team_id as a bare uuid because there was nothing
-- to point at. There is now.
ALTER TABLE public.investigations
  DROP CONSTRAINT IF EXISTS investigations_team_id_fkey,
  ADD  CONSTRAINT investigations_team_id_fkey
       FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

ALTER TABLE public.assets
  DROP CONSTRAINT IF EXISTS assets_team_id_fkey,
  ADD  CONSTRAINT assets_team_id_fkey
       FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

ALTER TABLE public.asset_groups
  DROP CONSTRAINT IF EXISTS asset_groups_team_id_fkey,
  ADD  CONSTRAINT asset_groups_team_id_fkey
       FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

ALTER TABLE public.custom_ioc_lists
  DROP CONSTRAINT IF EXISTS custom_ioc_lists_team_id_fkey,
  ADD  CONSTRAINT custom_ioc_lists_team_id_fkey
       FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

-- team_watchlists has pointed at a teams table that did not exist since 2026-01,
-- and has no policies at all, so it has always returned empty. Both are fixed.
ALTER TABLE public.team_watchlists
  DROP CONSTRAINT IF EXISTS team_watchlists_team_id_fkey,
  ADD  CONSTRAINT team_watchlists_team_id_fkey
       FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS team_watchlists_member ON public.team_watchlists;
CREATE POLICY team_watchlists_member ON public.team_watchlists FOR ALL TO authenticated
  USING (public.is_team_member(team_id)) WITH CHECK (public.is_team_member(team_id));

DROP POLICY IF EXISTS team_watchlist_items_member ON public.team_watchlist_items;
CREATE POLICY team_watchlist_items_member ON public.team_watchlist_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_watchlists w
                 WHERE w.id = team_watchlist_items.watchlist_id
                   AND public.is_team_member(w.team_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.team_watchlists w
                      WHERE w.id = team_watchlist_items.watchlist_id
                        AND public.is_team_member(w.team_id)));
