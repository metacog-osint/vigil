-- Migration 014: Scheduled Reports
-- Phase 1A: Automated intelligence reports

-- ============================================
-- Scheduled Reports Configuration
-- ============================================
CREATE TABLE IF NOT EXISTS scheduled_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

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
    user_id VARCHAR(255) NOT NULL,

    -- Generation details
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    time_range_start TIMESTAMP WITH TIME ZONE,
    time_range_end TIMESTAMP WITH TIME ZONE,

    -- Content summary
    stats JSONB DEFAULT '{}',
    -- Example: { "incidents": 15, "actors": 5, "vulnerabilities": 8, "iocs": 120 }

    -- Delivery status
    delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed', 'partial')),
    recipients_sent TEXT[] DEFAULT '{}',
    recipients_failed TEXT[] DEFAULT '{}',
    error_message TEXT,

    -- Storage
    pdf_url TEXT, -- Supabase Storage URL
    file_size INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_history_report ON report_history(report_id);
CREATE INDEX IF NOT EXISTS idx_report_history_user ON report_history(user_id);

COMMENT ON TABLE report_history IS 'History of generated reports with delivery status';

-- ============================================
-- Helper function to calculate next scheduled time
-- ============================================
CREATE OR REPLACE FUNCTION calculate_next_report_time(
    p_frequency VARCHAR,
    p_delivery_day INTEGER,
    p_delivery_time TIME,
    p_timezone VARCHAR DEFAULT 'UTC'
)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
    v_now TIMESTAMP WITH TIME ZONE;
    v_next TIMESTAMP WITH TIME ZONE;
    v_target_dow INTEGER;
BEGIN
    v_now := NOW() AT TIME ZONE p_timezone;

    CASE p_frequency
        WHEN 'daily' THEN
            -- Next occurrence of delivery_time
            v_next := (v_now::DATE + p_delivery_time)::TIMESTAMP AT TIME ZONE p_timezone;
            IF v_next <= NOW() THEN
                v_next := v_next + INTERVAL '1 day';
            END IF;

        WHEN 'weekly' THEN
            -- Next occurrence of delivery_day (0=Sunday) at delivery_time
            v_target_dow := COALESCE(p_delivery_day, 1); -- Default to Monday
            v_next := (v_now::DATE + p_delivery_time)::TIMESTAMP AT TIME ZONE p_timezone;
            -- Adjust to target day of week
            v_next := v_next + ((v_target_dow - EXTRACT(DOW FROM v_next)::INTEGER + 7) % 7) * INTERVAL '1 day';
            IF v_next <= NOW() THEN
                v_next := v_next + INTERVAL '7 days';
            END IF;

        WHEN 'monthly' THEN
            -- Next occurrence of delivery_day (1-28) at delivery_time
            v_next := (DATE_TRUNC('month', v_now) + (COALESCE(p_delivery_day, 1) - 1) * INTERVAL '1 day' + p_delivery_time)::TIMESTAMP AT TIME ZONE p_timezone;
            IF v_next <= NOW() THEN
                v_next := (DATE_TRUNC('month', v_now) + INTERVAL '1 month' + (COALESCE(p_delivery_day, 1) - 1) * INTERVAL '1 day' + p_delivery_time)::TIMESTAMP AT TIME ZONE p_timezone;
            END IF;
    END CASE;

    RETURN v_next;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Trigger to update next_scheduled_at
-- ============================================
CREATE OR REPLACE FUNCTION update_report_schedule()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();

    IF NEW.is_enabled THEN
        NEW.next_scheduled_at := calculate_next_report_time(
            NEW.frequency,
            NEW.delivery_day,
            NEW.delivery_time,
            COALESCE(NEW.timezone, 'UTC')
        );
    ELSE
        NEW.next_scheduled_at := NULL;
    END IF;

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
    FOR ALL USING (user_id = current_setting('app.user_id', true));

CREATE POLICY report_history_user_policy ON report_history
    FOR ALL USING (user_id = current_setting('app.user_id', true));
