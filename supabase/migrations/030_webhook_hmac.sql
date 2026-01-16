-- Migration 030: Add HMAC signature support to alert webhooks
-- Enables signature verification for generic webhook endpoints

-- ============================================
-- Add secret column to alert_webhooks
-- ============================================
ALTER TABLE alert_webhooks
ADD COLUMN IF NOT EXISTS secret VARCHAR(255),
ADD COLUMN IF NOT EXISTS hmac_header VARCHAR(100) DEFAULT 'X-Vigil-Signature';

COMMENT ON COLUMN alert_webhooks.secret IS 'HMAC secret for signature verification (generic webhooks only)';
COMMENT ON COLUMN alert_webhooks.hmac_header IS 'Header name for HMAC signature';

-- ============================================
-- Add more tracking columns to alert_deliveries
-- ============================================
ALTER TABLE alert_deliveries
ADD COLUMN IF NOT EXISTS event_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS response_code INTEGER,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

COMMENT ON COLUMN alert_deliveries.event_type IS 'Type of event that triggered this delivery';
COMMENT ON COLUMN alert_deliveries.response_code IS 'HTTP response code from webhook endpoint';
COMMENT ON COLUMN alert_deliveries.retry_count IS 'Number of retry attempts';

-- ============================================
-- Function to generate webhook secret
-- ============================================
CREATE OR REPLACE FUNCTION generate_webhook_secret()
RETURNS VARCHAR(64) AS $$
DECLARE
    chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result VARCHAR(64) := '';
    i INTEGER;
BEGIN
    FOR i IN 1..64 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Trigger to auto-generate secret for generic webhooks
-- ============================================
CREATE OR REPLACE FUNCTION auto_generate_webhook_secret()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.webhook_type = 'generic' AND NEW.secret IS NULL THEN
        NEW.secret := generate_webhook_secret();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_webhook_secret ON alert_webhooks;
CREATE TRIGGER trigger_webhook_secret
    BEFORE INSERT OR UPDATE ON alert_webhooks
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_webhook_secret();

-- Generate secrets for existing generic webhooks that don't have one
UPDATE alert_webhooks
SET secret = generate_webhook_secret()
WHERE webhook_type = 'generic' AND secret IS NULL;
