-- Fix alert triggers to use correct column names
-- The original trigger in 028_realtime_alerts.sql used wrong column names

-- Drop and recreate the incident alert trigger with correct column names
CREATE OR REPLACE FUNCTION trigger_queue_incident_alert()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_name TEXT := NULL;
BEGIN
    -- Only queue if this is a new incident (not an update)
    IF TG_OP = 'INSERT' THEN
        -- Get actor name if actor_id is set
        IF NEW.actor_id IS NOT NULL THEN
            SELECT name INTO v_actor_name
            FROM threat_actors
            WHERE id = NEW.actor_id;
        END IF;

        PERFORM queue_alert_event(
            'ransomware',
            NEW.id::TEXT,
            jsonb_build_object(
                'victim_name', NEW.victim_name,
                'threat_actor', v_actor_name,
                'actor_id', NEW.actor_id,
                'sector', NEW.victim_sector,
                'country', NEW.victim_country,
                'discovered_date', NEW.discovered_date,
                'source', NEW.source
            ),
            3  -- High priority
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS auto_queue_incident_alert ON incidents;
CREATE TRIGGER auto_queue_incident_alert
    AFTER INSERT ON incidents
    FOR EACH ROW
    EXECUTE FUNCTION trigger_queue_incident_alert();
