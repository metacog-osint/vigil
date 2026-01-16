-- Migration 043: Advanced Alert Rule Builder
-- Adds complex AND/OR conditions, grouping, and batching

-- Create alert rule conditions table for complex rules
CREATE TABLE IF NOT EXISTS alert_rule_conditions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES alert_rule_conditions(id) ON DELETE CASCADE, -- For nested groups
  condition_type TEXT NOT NULL, -- 'field', 'group'
  boolean_op TEXT DEFAULT 'AND', -- 'AND', 'OR', 'NOT'
  field_name TEXT, -- For field conditions
  operator TEXT, -- 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'starts_with', 'ends_with', 'in', 'not_in', 'is_null', 'is_not_null'
  field_value TEXT,
  field_values TEXT[], -- For 'in' and 'not_in' operators
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add advanced fields to alert_rules
ALTER TABLE alert_rules
ADD COLUMN IF NOT EXISTS condition_mode TEXT DEFAULT 'simple', -- 'simple' or 'advanced'
ADD COLUMN IF NOT EXISTS conditions_json JSONB, -- JSON representation of complex conditions
ADD COLUMN IF NOT EXISTS batch_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS batch_window_minutes INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS batch_max_items INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS cooldown_minutes INTEGER DEFAULT 0, -- Don't re-alert for same entity
ADD COLUMN IF NOT EXISTS last_batch_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS severity_override TEXT, -- Override entity severity
ADD COLUMN IF NOT EXISTS title_template TEXT, -- Custom alert title template
ADD COLUMN IF NOT EXISTS body_template TEXT; -- Custom alert body template

-- Alert batching queue
CREATE TABLE IF NOT EXISTS alert_batch_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  entity_data JSONB NOT NULL,
  severity TEXT,
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  batch_key TEXT, -- For grouping batches
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ
);

-- Alert cooldown tracking
CREATE TABLE IF NOT EXISTS alert_cooldowns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  last_alerted_at TIMESTAMPTZ NOT NULL,
  alert_count INTEGER DEFAULT 1,

  UNIQUE(rule_id, entity_type, entity_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alert_rule_conditions_rule
ON alert_rule_conditions(rule_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_alert_batch_queue_pending
ON alert_batch_queue(rule_id, queued_at)
WHERE processed = false;

CREATE INDEX IF NOT EXISTS idx_alert_cooldowns_lookup
ON alert_cooldowns(rule_id, entity_type, entity_id);

-- Function to evaluate complex conditions
CREATE OR REPLACE FUNCTION evaluate_alert_conditions(
  p_rule_id UUID,
  p_entity JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  v_rule RECORD;
  v_result BOOLEAN := true;
BEGIN
  SELECT * INTO v_rule FROM alert_rules WHERE id = p_rule_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Simple mode: use existing logic
  IF v_rule.condition_mode = 'simple' OR v_rule.conditions_json IS NULL THEN
    RETURN true; -- Simple rules evaluated elsewhere
  END IF;

  -- Advanced mode: evaluate JSON conditions
  v_result := evaluate_condition_group(v_rule.conditions_json, p_entity);

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Helper function to evaluate a condition group
CREATE OR REPLACE FUNCTION evaluate_condition_group(
  p_conditions JSONB,
  p_entity JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  v_op TEXT;
  v_items JSONB;
  v_item JSONB;
  v_result BOOLEAN;
  v_item_result BOOLEAN;
BEGIN
  v_op := COALESCE(p_conditions->>'operator', 'AND');
  v_items := p_conditions->'conditions';

  IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
    RETURN true;
  END IF;

  -- Initialize based on operator
  v_result := CASE v_op WHEN 'OR' THEN false ELSE true END;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    IF v_item->>'type' = 'group' THEN
      v_item_result := evaluate_condition_group(v_item, p_entity);
    ELSE
      v_item_result := evaluate_single_condition(v_item, p_entity);
    END IF;

    IF v_op = 'AND' THEN
      v_result := v_result AND v_item_result;
      IF NOT v_result THEN
        RETURN false; -- Short circuit
      END IF;
    ELSIF v_op = 'OR' THEN
      v_result := v_result OR v_item_result;
      IF v_result THEN
        RETURN true; -- Short circuit
      END IF;
    ELSIF v_op = 'NOT' THEN
      RETURN NOT v_item_result;
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Helper function to evaluate a single condition
CREATE OR REPLACE FUNCTION evaluate_single_condition(
  p_condition JSONB,
  p_entity JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  v_field TEXT;
  v_operator TEXT;
  v_value TEXT;
  v_entity_value TEXT;
BEGIN
  v_field := p_condition->>'field';
  v_operator := p_condition->>'operator';
  v_value := p_condition->>'value';

  -- Get entity value (supports nested fields with dot notation)
  v_entity_value := p_entity #>> string_to_array(v_field, '.');

  CASE v_operator
    WHEN 'eq' THEN
      RETURN v_entity_value = v_value;
    WHEN 'neq' THEN
      RETURN v_entity_value != v_value OR v_entity_value IS NULL;
    WHEN 'gt' THEN
      RETURN v_entity_value::NUMERIC > v_value::NUMERIC;
    WHEN 'gte' THEN
      RETURN v_entity_value::NUMERIC >= v_value::NUMERIC;
    WHEN 'lt' THEN
      RETURN v_entity_value::NUMERIC < v_value::NUMERIC;
    WHEN 'lte' THEN
      RETURN v_entity_value::NUMERIC <= v_value::NUMERIC;
    WHEN 'contains' THEN
      RETURN v_entity_value ILIKE '%' || v_value || '%';
    WHEN 'starts_with' THEN
      RETURN v_entity_value ILIKE v_value || '%';
    WHEN 'ends_with' THEN
      RETURN v_entity_value ILIKE '%' || v_value;
    WHEN 'in' THEN
      RETURN v_entity_value = ANY(ARRAY(SELECT jsonb_array_elements_text(p_condition->'values')));
    WHEN 'not_in' THEN
      RETURN NOT (v_entity_value = ANY(ARRAY(SELECT jsonb_array_elements_text(p_condition->'values'))));
    WHEN 'is_null' THEN
      RETURN v_entity_value IS NULL;
    WHEN 'is_not_null' THEN
      RETURN v_entity_value IS NOT NULL;
    ELSE
      RETURN true;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to check cooldown
CREATE OR REPLACE FUNCTION check_alert_cooldown(
  p_rule_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_rule RECORD;
  v_cooldown RECORD;
BEGIN
  SELECT cooldown_minutes INTO v_rule FROM alert_rules WHERE id = p_rule_id;

  IF v_rule.cooldown_minutes IS NULL OR v_rule.cooldown_minutes = 0 THEN
    RETURN true; -- No cooldown
  END IF;

  SELECT * INTO v_cooldown FROM alert_cooldowns
  WHERE rule_id = p_rule_id
    AND entity_type = p_entity_type
    AND entity_id = p_entity_id;

  IF NOT FOUND THEN
    RETURN true; -- Never alerted
  END IF;

  IF v_cooldown.last_alerted_at + (v_rule.cooldown_minutes || ' minutes')::INTERVAL < NOW() THEN
    RETURN true; -- Cooldown expired
  END IF;

  RETURN false; -- Still in cooldown
END;
$$ LANGUAGE plpgsql;

-- Function to update cooldown
CREATE OR REPLACE FUNCTION update_alert_cooldown(
  p_rule_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID
) RETURNS void AS $$
BEGIN
  INSERT INTO alert_cooldowns (rule_id, entity_type, entity_id, last_alerted_at)
  VALUES (p_rule_id, p_entity_type, p_entity_id, NOW())
  ON CONFLICT (rule_id, entity_type, entity_id)
  DO UPDATE SET
    last_alerted_at = NOW(),
    alert_count = alert_cooldowns.alert_count + 1;
END;
$$ LANGUAGE plpgsql;

-- Function to process batch queue
CREATE OR REPLACE FUNCTION process_alert_batches() RETURNS INTEGER AS $$
DECLARE
  v_batch RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Find rules with pending batches that are ready
  FOR v_batch IN
    SELECT
      abq.rule_id,
      ar.user_id,
      ar.batch_window_minutes,
      ar.batch_max_items,
      MIN(abq.queued_at) as first_queued,
      COUNT(*) as item_count
    FROM alert_batch_queue abq
    JOIN alert_rules ar ON ar.id = abq.rule_id
    WHERE abq.processed = false
      AND ar.batch_enabled = true
    GROUP BY abq.rule_id, ar.user_id, ar.batch_window_minutes, ar.batch_max_items
    HAVING MIN(abq.queued_at) + (ar.batch_window_minutes || ' minutes')::INTERVAL < NOW()
       OR COUNT(*) >= ar.batch_max_items
  LOOP
    -- Mark items as processed
    UPDATE alert_batch_queue
    SET processed = true, processed_at = NOW()
    WHERE rule_id = v_batch.rule_id
      AND processed = false;

    -- Update last batch sent
    UPDATE alert_rules
    SET last_batch_sent_at = NOW()
    WHERE id = v_batch.rule_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE alert_rule_conditions IS 'Complex conditions for advanced alert rules';
COMMENT ON TABLE alert_batch_queue IS 'Queue for batched alerts';
COMMENT ON TABLE alert_cooldowns IS 'Tracks cooldown periods per entity';
