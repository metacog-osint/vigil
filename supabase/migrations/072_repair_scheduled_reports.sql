-- Migration 072: Repair scheduled_reports table
-- The original migration 014 failed because it referenced the teams table
-- which doesn't exist. This migration creates the table without that FK.

-- ============================================
-- Scheduled Reports Configuration
-- ============================================
CREATE TABLE IF NOT EXISTS scheduled_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    team_id UUID, -- Removed FK constraint to non-existent teams table

    -- Report settings
    name VARCHAR(100) NOT NULL,
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    delivery_day INTEGER, -- 0-6 for weekly (0=Sunday), 1-28 for monthly
    delivery_time TIME DEFAULT '08:00:00', -- UTC
    timezone VARCHAR(50) DEFAULT 'UTC',

    -- Content sections to include
    sections JSONB NOT NULL DEFAULT '["summary", "incidents", "actors", "vulnerabilities"]',
    -- Available: summary, incidents, actors, vulnerabilities, iocs, trends, watchlist

    -- Filters
    filters JSONB DEFAULT '{}',
    -- Example: { "sectors": ["healthcare"], "severity_min": "medium", "time_range": "7d" }

    -- Delivery
    recipients TEXT[] NOT NULL DEFAULT '{}', -- Email addresses
    format VARCHAR(10) DEFAULT 'pdf' CHECK (format IN ('pdf', 'html', 'both')),

    -- Branding (for team/enterprise)
    branding JSONB DEFAULT '{}',
    -- Example: { "logo_url": "...", "company_name": "...", "primary_color": "#..." }

    -- Status
    is_enabled BOOLEAN DEFAULT true,
    last_sent_at TIMESTAMP WITH TIME ZONE,
    next_scheduled_at TIMESTAMP WITH TIME ZONE,
    send_count INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_user ON scheduled_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next ON scheduled_reports(next_scheduled_at) WHERE is_enabled = true;

COMMENT ON TABLE scheduled_reports IS 'User-configured scheduled intelligence reports';

-- ============================================
-- Report Generation History
-- ============================================
CREATE TABLE IF NOT EXISTS report_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES scheduled_reports(id) ON DELETE CASCADE,

    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'sent', 'failed')),
    error_message TEXT,

    -- Delivery tracking
    recipients_sent TEXT[] DEFAULT '{}',
    delivery_status JSONB DEFAULT '{}', -- { "email@example.com": "delivered" }

    -- Report content snapshot
    report_data JSONB, -- Summary of what was included
    file_url TEXT, -- S3/storage URL if we store PDFs

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_history_report ON report_history(report_id);
CREATE INDEX IF NOT EXISTS idx_report_history_generated ON report_history(generated_at);

-- ============================================
-- Auto-update next_scheduled_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_report_schedule()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate next scheduled time based on frequency
    IF NEW.is_enabled THEN
        NEW.next_scheduled_at = CASE NEW.frequency
            WHEN 'daily' THEN
                (CURRENT_DATE + 1) + NEW.delivery_time
            WHEN 'weekly' THEN
                (CURRENT_DATE + (7 - EXTRACT(DOW FROM CURRENT_DATE) + COALESCE(NEW.delivery_day, 1))::INTEGER % 7 + 1) + NEW.delivery_time
            WHEN 'monthly' THEN
                (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' + (COALESCE(NEW.delivery_day, 1) - 1) * INTERVAL '1 day') + NEW.delivery_time
            ELSE NEW.next_scheduled_at
        END;
    ELSE
        NEW.next_scheduled_at = NULL;
    END IF;

    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS report_schedule_trigger ON scheduled_reports;
CREATE TRIGGER report_schedule_trigger
    BEFORE INSERT OR UPDATE ON scheduled_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_report_schedule();

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_history ENABLE ROW LEVEL SECURITY;

-- Users can manage their own reports
CREATE POLICY scheduled_reports_user_policy ON scheduled_reports
    FOR ALL USING (user_id = auth.uid()::text);

CREATE POLICY report_history_user_policy ON report_history
    FOR ALL USING (
        report_id IN (SELECT id FROM scheduled_reports WHERE user_id = auth.uid()::text)
    );

-- Service role can do everything
CREATE POLICY scheduled_reports_service_policy ON scheduled_reports
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY report_history_service_policy ON report_history
    FOR ALL USING (auth.role() = 'service_role');
