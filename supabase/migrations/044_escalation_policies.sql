-- Migration: Escalation Policies
-- Created: 2026-01-16
-- Description: Alert escalation policies with time-based escalation and on-call support

-- ============================================
-- ESCALATION POLICIES
-- ============================================

-- Main escalation policy definition
CREATE TABLE IF NOT EXISTS escalation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  enabled BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Escalation levels (steps in the escalation chain)
CREATE TABLE IF NOT EXISTS escalation_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES escalation_policies(id) ON DELETE CASCADE,
  level_order INTEGER NOT NULL DEFAULT 1,
  escalate_after_minutes INTEGER NOT NULL DEFAULT 30,
  notification_channels JSONB DEFAULT '["email"]'::jsonb,
  repeat_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(policy_id, level_order)
);

-- Escalation targets (who to notify at each level)
CREATE TABLE IF NOT EXISTS escalation_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id UUID NOT NULL REFERENCES escalation_levels(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('user', 'team', 'schedule', 'webhook')),
  target_id UUID, -- user_id, team_id, or schedule_id depending on type
  webhook_url TEXT, -- for webhook type
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- On-call schedules
CREATE TABLE IF NOT EXISTS oncall_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  timezone TEXT DEFAULT 'UTC',
  rotation_type TEXT NOT NULL CHECK (rotation_type IN ('daily', 'weekly', 'custom')),
  handoff_time TIME DEFAULT '09:00:00',
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schedule participants (rotation members)
CREATE TABLE IF NOT EXISTS schedule_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES oncall_schedules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 1, -- order in rotation
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(schedule_id, user_id),
  UNIQUE(schedule_id, position)
);

-- Schedule overrides (temporary coverage changes)
CREATE TABLE IF NOT EXISTS schedule_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES oncall_schedules(id) ON DELETE CASCADE,
  override_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CHECK (end_time > start_time)
);

-- ============================================
-- ESCALATION TRACKING
-- ============================================

-- Track active escalations
CREATE TABLE IF NOT EXISTS alert_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_queue_id UUID NOT NULL REFERENCES alert_queue(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES escalation_policies(id) ON DELETE CASCADE,
  current_level INTEGER DEFAULT 1,
  escalated_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'timeout')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Escalation history (audit trail)
CREATE TABLE IF NOT EXISTS escalation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escalation_id UUID NOT NULL REFERENCES alert_escalations(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'escalated', 'acknowledged', 'resolved', 'timeout', 'notified')),
  from_level INTEGER,
  to_level INTEGER,
  user_id UUID REFERENCES auth.users(id),
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Get current on-call user for a schedule
CREATE OR REPLACE FUNCTION get_current_oncall(p_schedule_id UUID)
RETURNS UUID AS $$
DECLARE
  v_schedule oncall_schedules%ROWTYPE;
  v_participant_count INTEGER;
  v_current_position INTEGER;
  v_oncall_user_id UUID;
  v_override_user_id UUID;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Check for active override first
  SELECT override_user_id INTO v_override_user_id
  FROM schedule_overrides
  WHERE schedule_id = p_schedule_id
    AND v_now >= start_time
    AND v_now < end_time
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_override_user_id IS NOT NULL THEN
    RETURN v_override_user_id;
  END IF;

  -- Get schedule details
  SELECT * INTO v_schedule FROM oncall_schedules WHERE id = p_schedule_id;

  IF v_schedule.id IS NULL OR NOT v_schedule.enabled THEN
    RETURN NULL;
  END IF;

  -- Count participants
  SELECT COUNT(*) INTO v_participant_count FROM schedule_participants WHERE schedule_id = p_schedule_id;

  IF v_participant_count = 0 THEN
    RETURN NULL;
  END IF;

  -- Calculate current position based on rotation type
  IF v_schedule.rotation_type = 'daily' THEN
    v_current_position := (EXTRACT(DOY FROM v_now AT TIME ZONE v_schedule.timezone)::INTEGER % v_participant_count) + 1;
  ELSIF v_schedule.rotation_type = 'weekly' THEN
    v_current_position := (EXTRACT(WEEK FROM v_now AT TIME ZONE v_schedule.timezone)::INTEGER % v_participant_count) + 1;
  ELSE
    v_current_position := 1; -- Default to first for custom
  END IF;

  -- Get the on-call user
  SELECT user_id INTO v_oncall_user_id
  FROM schedule_participants
  WHERE schedule_id = p_schedule_id AND position = v_current_position;

  RETURN v_oncall_user_id;
END;
$$ LANGUAGE plpgsql;

-- Process escalation (move to next level if needed)
CREATE OR REPLACE FUNCTION process_escalation(p_escalation_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_escalation alert_escalations%ROWTYPE;
  v_next_level escalation_levels%ROWTYPE;
  v_max_level INTEGER;
  v_result JSONB := '{}'::jsonb;
BEGIN
  -- Get current escalation
  SELECT * INTO v_escalation FROM alert_escalations WHERE id = p_escalation_id;

  IF v_escalation.id IS NULL OR v_escalation.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Escalation not found or not active');
  END IF;

  -- Get max level for this policy
  SELECT MAX(level_order) INTO v_max_level
  FROM escalation_levels
  WHERE policy_id = v_escalation.policy_id;

  IF v_escalation.current_level >= v_max_level THEN
    -- Already at max level, mark as timeout
    UPDATE alert_escalations
    SET status = 'timeout', resolved_at = NOW()
    WHERE id = p_escalation_id;

    INSERT INTO escalation_history (escalation_id, action, from_level, details)
    VALUES (p_escalation_id, 'timeout', v_escalation.current_level,
            jsonb_build_object('reason', 'Max escalation level reached'));

    RETURN jsonb_build_object('success', true, 'action', 'timeout', 'level', v_escalation.current_level);
  END IF;

  -- Move to next level
  SELECT * INTO v_next_level
  FROM escalation_levels
  WHERE policy_id = v_escalation.policy_id AND level_order = v_escalation.current_level + 1;

  UPDATE alert_escalations
  SET current_level = v_next_level.level_order, escalated_at = NOW()
  WHERE id = p_escalation_id;

  -- Log the escalation
  INSERT INTO escalation_history (escalation_id, action, from_level, to_level, details)
  VALUES (p_escalation_id, 'escalated', v_escalation.current_level, v_next_level.level_order,
          jsonb_build_object('channels', v_next_level.notification_channels));

  RETURN jsonb_build_object(
    'success', true,
    'action', 'escalated',
    'from_level', v_escalation.current_level,
    'to_level', v_next_level.level_order,
    'channels', v_next_level.notification_channels
  );
END;
$$ LANGUAGE plpgsql;

-- Acknowledge an escalation
CREATE OR REPLACE FUNCTION acknowledge_escalation(p_escalation_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE alert_escalations
  SET status = 'acknowledged', acknowledged_at = NOW(), acknowledged_by = p_user_id
  WHERE id = p_escalation_id AND status = 'active';

  IF FOUND THEN
    INSERT INTO escalation_history (escalation_id, action, user_id)
    VALUES (p_escalation_id, 'acknowledged', p_user_id);
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Resolve an escalation
CREATE OR REPLACE FUNCTION resolve_escalation(p_escalation_id UUID, p_user_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE alert_escalations
  SET status = 'resolved', resolved_at = NOW(), resolved_by = p_user_id, resolution_notes = p_notes
  WHERE id = p_escalation_id AND status IN ('active', 'acknowledged');

  IF FOUND THEN
    INSERT INTO escalation_history (escalation_id, action, user_id, details)
    VALUES (p_escalation_id, 'resolved', p_user_id,
            CASE WHEN p_notes IS NOT NULL THEN jsonb_build_object('notes', p_notes) ELSE '{}'::jsonb END);
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Create escalation for an alert
CREATE OR REPLACE FUNCTION create_escalation(p_alert_queue_id UUID, p_policy_id UUID)
RETURNS UUID AS $$
DECLARE
  v_escalation_id UUID;
BEGIN
  INSERT INTO alert_escalations (alert_queue_id, policy_id, current_level, status)
  VALUES (p_alert_queue_id, p_policy_id, 1, 'active')
  RETURNING id INTO v_escalation_id;

  INSERT INTO escalation_history (escalation_id, action, to_level)
  VALUES (v_escalation_id, 'created', 1);

  RETURN v_escalation_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_escalation_policies_team ON escalation_policies(team_id);
CREATE INDEX IF NOT EXISTS idx_escalation_levels_policy ON escalation_levels(policy_id);
CREATE INDEX IF NOT EXISTS idx_escalation_targets_level ON escalation_targets(level_id);
CREATE INDEX IF NOT EXISTS idx_oncall_schedules_team ON oncall_schedules(team_id);
CREATE INDEX IF NOT EXISTS idx_schedule_participants_schedule ON schedule_participants(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_overrides_schedule ON schedule_overrides(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_overrides_active ON schedule_overrides(schedule_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_alert_escalations_status ON alert_escalations(status);
CREATE INDEX IF NOT EXISTS idx_alert_escalations_policy ON alert_escalations(policy_id);
CREATE INDEX IF NOT EXISTS idx_escalation_history_escalation ON escalation_history(escalation_id);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE escalation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE oncall_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_history ENABLE ROW LEVEL SECURITY;

-- Policies for team members
CREATE POLICY "Team members can view escalation policies" ON escalation_policies
  FOR SELECT USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

CREATE POLICY "Team admins can manage escalation policies" ON escalation_policies
  FOR ALL USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner')));

CREATE POLICY "Team members can view escalation levels" ON escalation_levels
  FOR SELECT USING (policy_id IN (SELECT id FROM escalation_policies WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())));

CREATE POLICY "Team members can view oncall schedules" ON oncall_schedules
  FOR SELECT USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

CREATE POLICY "Team admins can manage oncall schedules" ON oncall_schedules
  FOR ALL USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner')));

CREATE POLICY "Team members can view their escalations" ON alert_escalations
  FOR SELECT USING (policy_id IN (SELECT id FROM escalation_policies WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())));
