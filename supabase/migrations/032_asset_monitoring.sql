-- Migration: Asset monitoring helpers
-- Date: January 15, 2026
-- Purpose: Add helper functions for asset monitoring

BEGIN;

-- Function to increment asset match count and update timestamps
CREATE OR REPLACE FUNCTION increment_asset_match_count(p_asset_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE assets
    SET
        match_count = match_count + 1,
        last_match_at = NOW(),
        last_checked_at = NOW()
    WHERE id = p_asset_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_asset_match_count IS 'Increments match count and updates timestamps for an asset';

-- Trigger to auto-queue alerts for new asset matches
CREATE OR REPLACE FUNCTION trigger_queue_asset_match_alert()
RETURNS TRIGGER AS $$
DECLARE
    v_asset RECORD;
BEGIN
    -- Get asset details
    SELECT id, user_id, asset_type, value, name, criticality, notify_on_match
    INTO v_asset
    FROM assets
    WHERE id = NEW.asset_id;

    -- Only queue if notifications are enabled
    IF v_asset.notify_on_match THEN
        PERFORM queue_alert_event(
            'ioc.matched_asset',
            NEW.id::VARCHAR,
            jsonb_build_object(
                'user_id', v_asset.user_id,
                'asset_id', v_asset.id,
                'asset_value', v_asset.value,
                'asset_type', v_asset.asset_type,
                'asset_name', v_asset.name,
                'asset_criticality', v_asset.criticality,
                'match_id', NEW.id,
                'match_type', NEW.match_type,
                'matched_value', NEW.matched_value,
                'severity', NEW.severity,
                'context', NEW.context
            ),
            CASE v_asset.criticality
                WHEN 'critical' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 5
                ELSE 8
            END
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-alerting on asset matches (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'asset_matches') THEN
        DROP TRIGGER IF EXISTS trigger_asset_match_alert ON asset_matches;
        CREATE TRIGGER trigger_asset_match_alert
            AFTER INSERT ON asset_matches
            FOR EACH ROW
            EXECUTE FUNCTION trigger_queue_asset_match_alert();
    END IF;
END $$;

COMMIT;
