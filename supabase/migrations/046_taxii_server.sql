-- Migration: TAXII 2.1 Server
-- Created: 2026-01-16
-- Description: Implements TAXII 2.1 server for threat intelligence sharing

-- ============================================
-- TAXII API ROOTS
-- ============================================

CREATE TABLE IF NOT EXISTS taxii_api_roots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  versions TEXT[] DEFAULT ARRAY['taxii-2.1'],
  max_content_length INTEGER DEFAULT 10485760, -- 10MB
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TAXII COLLECTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS taxii_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_root_id UUID NOT NULL REFERENCES taxii_api_roots(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  alias TEXT UNIQUE, -- URL-friendly name
  can_read BOOLEAN DEFAULT TRUE,
  can_write BOOLEAN DEFAULT FALSE,
  media_types TEXT[] DEFAULT ARRAY['application/stix+json;version=2.1'],
  -- Access control
  is_public BOOLEAN DEFAULT FALSE,
  allowed_teams UUID[] DEFAULT '{}',
  -- Auto-population rules
  auto_populate BOOLEAN DEFAULT FALSE,
  populate_sources TEXT[] DEFAULT '{}', -- 'actors', 'iocs', 'vulnerabilities', 'incidents'
  populate_filters JSONB DEFAULT '{}', -- Additional filters
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TAXII OBJECTS (STIX Objects in Collections)
-- ============================================

CREATE TABLE IF NOT EXISTS taxii_objects (
  id TEXT NOT NULL, -- STIX ID (e.g., "indicator--uuid")
  collection_id UUID NOT NULL REFERENCES taxii_collections(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- STIX type
  spec_version TEXT DEFAULT '2.1',
  created TIMESTAMPTZ NOT NULL,
  modified TIMESTAMPTZ NOT NULL,
  created_by_ref TEXT,
  revoked BOOLEAN DEFAULT FALSE,
  labels TEXT[],
  confidence INTEGER,
  lang TEXT DEFAULT 'en',
  external_references JSONB DEFAULT '[]',
  object_marking_refs TEXT[],
  granular_markings JSONB DEFAULT '[]',
  -- Full STIX object
  stix_object JSONB NOT NULL,
  -- Metadata
  added_at TIMESTAMPTZ DEFAULT NOW(),
  version TEXT DEFAULT '1',

  PRIMARY KEY (id, collection_id)
);

-- ============================================
-- TAXII MANIFESTS
-- ============================================

CREATE TABLE IF NOT EXISTS taxii_manifests (
  id TEXT NOT NULL,
  collection_id UUID NOT NULL REFERENCES taxii_collections(id) ON DELETE CASCADE,
  date_added TIMESTAMPTZ DEFAULT NOW(),
  version TEXT DEFAULT '1',
  media_type TEXT DEFAULT 'application/stix+json;version=2.1',

  PRIMARY KEY (id, collection_id, version)
);

-- ============================================
-- TAXII STATUS (for async operations)
-- ============================================

CREATE TABLE IF NOT EXISTS taxii_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'complete', 'failed')),
  request_timestamp TIMESTAMPTZ DEFAULT NOW(),
  total_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  pending_count INTEGER DEFAULT 0,
  successes JSONB DEFAULT '[]',
  failures JSONB DEFAULT '[]',
  pendings JSONB DEFAULT '[]'
);

-- ============================================
-- TAXII SUBSCRIPTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS taxii_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES taxii_collections(id) ON DELETE CASCADE,
  subscriber_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  callback_url TEXT,
  -- Filters
  added_after TIMESTAMPTZ,
  match_id TEXT[],
  match_type TEXT[],
  match_version TEXT,
  -- Status
  enabled BOOLEAN DEFAULT TRUE,
  last_delivered TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Get discovery information
CREATE OR REPLACE FUNCTION taxii_discovery()
RETURNS JSONB AS $$
BEGIN
  RETURN jsonb_build_object(
    'title', 'Vigil TAXII Server',
    'description', 'TAXII 2.1 server for Vigil Threat Intelligence Platform',
    'contact', 'security@theintelligence.company',
    'default', '/taxii2/',
    'api_roots', (
      SELECT jsonb_agg('/taxii2/' || name || '/')
      FROM taxii_api_roots
      WHERE enabled = true
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Get API root information
CREATE OR REPLACE FUNCTION taxii_api_root_info(p_root_name TEXT)
RETURNS JSONB AS $$
DECLARE
  v_root taxii_api_roots%ROWTYPE;
BEGIN
  SELECT * INTO v_root FROM taxii_api_roots WHERE name = p_root_name AND enabled = true;

  IF v_root.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'title', v_root.title,
    'description', v_root.description,
    'versions', v_root.versions,
    'max_content_length', v_root.max_content_length
  );
END;
$$ LANGUAGE plpgsql;

-- Get collections for an API root
CREATE OR REPLACE FUNCTION taxii_get_collections(
  p_root_name TEXT,
  p_user_id UUID DEFAULT NULL,
  p_team_ids UUID[] DEFAULT '{}'
)
RETURNS JSONB AS $$
DECLARE
  v_root_id UUID;
BEGIN
  SELECT id INTO v_root_id FROM taxii_api_roots WHERE name = p_root_name AND enabled = true;

  IF v_root_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'collections', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id,
        'title', c.title,
        'description', c.description,
        'alias', c.alias,
        'can_read', c.can_read,
        'can_write', c.can_write,
        'media_types', c.media_types
      ))
      FROM taxii_collections c
      WHERE c.api_root_id = v_root_id
        AND (c.is_public = true OR c.allowed_teams && p_team_ids)
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Get objects from a collection
CREATE OR REPLACE FUNCTION taxii_get_objects(
  p_collection_id UUID,
  p_added_after TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_next TEXT DEFAULT NULL,
  p_match_id TEXT[] DEFAULT NULL,
  p_match_type TEXT[] DEFAULT NULL,
  p_match_spec_version TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_objects JSONB;
  v_more BOOLEAN := false;
  v_next TEXT;
BEGIN
  WITH filtered_objects AS (
    SELECT
      o.stix_object,
      o.added_at,
      o.id
    FROM taxii_objects o
    WHERE o.collection_id = p_collection_id
      AND (p_added_after IS NULL OR o.added_at > p_added_after)
      AND (p_match_id IS NULL OR o.id = ANY(p_match_id))
      AND (p_match_type IS NULL OR o.type = ANY(p_match_type))
      AND (p_match_spec_version IS NULL OR o.spec_version = p_match_spec_version)
      AND (p_next IS NULL OR o.added_at > p_next::timestamptz)
    ORDER BY o.added_at ASC
    LIMIT p_limit + 1
  )
  SELECT
    jsonb_agg(stix_object ORDER BY added_at),
    COUNT(*) > p_limit,
    MAX(added_at)::text
  INTO v_objects, v_more, v_next
  FROM (SELECT * FROM filtered_objects LIMIT p_limit) sub;

  RETURN jsonb_build_object(
    'objects', COALESCE(v_objects, '[]'::jsonb),
    'more', v_more,
    'next', CASE WHEN v_more THEN v_next ELSE NULL END
  );
END;
$$ LANGUAGE plpgsql;

-- Add objects to a collection
CREATE OR REPLACE FUNCTION taxii_add_objects(
  p_collection_id UUID,
  p_objects JSONB
)
RETURNS UUID AS $$
DECLARE
  v_status_id UUID;
  v_obj JSONB;
  v_success_count INTEGER := 0;
  v_failure_count INTEGER := 0;
  v_successes JSONB := '[]'::jsonb;
  v_failures JSONB := '[]'::jsonb;
BEGIN
  -- Create status record
  INSERT INTO taxii_status (status, total_count)
  VALUES ('pending', jsonb_array_length(p_objects))
  RETURNING id INTO v_status_id;

  -- Process each object
  FOR v_obj IN SELECT * FROM jsonb_array_elements(p_objects)
  LOOP
    BEGIN
      INSERT INTO taxii_objects (
        id, collection_id, type, spec_version,
        created, modified, created_by_ref, revoked,
        labels, confidence, external_references,
        object_marking_refs, stix_object
      ) VALUES (
        v_obj->>'id',
        p_collection_id,
        v_obj->>'type',
        COALESCE(v_obj->>'spec_version', '2.1'),
        (v_obj->>'created')::timestamptz,
        (v_obj->>'modified')::timestamptz,
        v_obj->>'created_by_ref',
        COALESCE((v_obj->>'revoked')::boolean, false),
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_obj->'labels', '[]'::jsonb))),
        (v_obj->>'confidence')::integer,
        COALESCE(v_obj->'external_references', '[]'::jsonb),
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_obj->'object_marking_refs', '[]'::jsonb))),
        v_obj
      )
      ON CONFLICT (id, collection_id) DO UPDATE SET
        modified = EXCLUDED.modified,
        stix_object = EXCLUDED.stix_object,
        version = (taxii_objects.version::integer + 1)::text;

      v_success_count := v_success_count + 1;
      v_successes := v_successes || jsonb_build_object('id', v_obj->>'id', 'version', '1');

      -- Add to manifest
      INSERT INTO taxii_manifests (id, collection_id, version)
      VALUES (v_obj->>'id', p_collection_id, '1')
      ON CONFLICT DO NOTHING;

    EXCEPTION WHEN OTHERS THEN
      v_failure_count := v_failure_count + 1;
      v_failures := v_failures || jsonb_build_object(
        'id', v_obj->>'id',
        'message', SQLERRM
      );
    END;
  END LOOP;

  -- Update status
  UPDATE taxii_status SET
    status = 'complete',
    success_count = v_success_count,
    failure_count = v_failure_count,
    pending_count = 0,
    successes = v_successes,
    failures = v_failures
  WHERE id = v_status_id;

  RETURN v_status_id;
END;
$$ LANGUAGE plpgsql;

-- Get manifest for a collection
CREATE OR REPLACE FUNCTION taxii_get_manifest(
  p_collection_id UUID,
  p_added_after TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS JSONB AS $$
BEGIN
  RETURN jsonb_build_object(
    'objects', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id,
        'date_added', m.date_added,
        'version', m.version,
        'media_type', m.media_type
      ) ORDER BY m.date_added)
      FROM taxii_manifests m
      WHERE m.collection_id = p_collection_id
        AND (p_added_after IS NULL OR m.date_added > p_added_after)
      LIMIT p_limit
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Populate collection from Vigil data
CREATE OR REPLACE FUNCTION taxii_populate_collection(p_collection_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_collection taxii_collections%ROWTYPE;
  v_count INTEGER := 0;
BEGIN
  SELECT * INTO v_collection FROM taxii_collections WHERE id = p_collection_id;

  IF NOT v_collection.auto_populate THEN
    RETURN 0;
  END IF;

  -- Populate from IOCs
  IF 'iocs' = ANY(v_collection.populate_sources) THEN
    INSERT INTO taxii_objects (id, collection_id, type, spec_version, created, modified, stix_object)
    SELECT
      'indicator--' || i.id,
      p_collection_id,
      'indicator',
      '2.1',
      i.first_seen,
      i.last_seen,
      jsonb_build_object(
        'type', 'indicator',
        'spec_version', '2.1',
        'id', 'indicator--' || i.id,
        'created', i.first_seen,
        'modified', i.last_seen,
        'name', i.value,
        'pattern', '[' ||
          CASE i.type
            WHEN 'ip' THEN 'ipv4-addr:value'
            WHEN 'domain' THEN 'domain-name:value'
            WHEN 'url' THEN 'url:value'
            WHEN 'hash_md5' THEN 'file:hashes.MD5'
            WHEN 'hash_sha1' THEN 'file:hashes.SHA-1'
            WHEN 'hash_sha256' THEN 'file:hashes.SHA-256'
            ELSE 'artifact:payload_bin'
          END || ' = ''' || i.value || ''']',
        'pattern_type', 'stix',
        'valid_from', i.first_seen,
        'labels', COALESCE(i.tags, ARRAY[]::text[])
      )
    FROM iocs i
    WHERE i.created_at > NOW() - INTERVAL '30 days'
    ON CONFLICT (id, collection_id) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  -- Populate from threat actors
  IF 'actors' = ANY(v_collection.populate_sources) THEN
    INSERT INTO taxii_objects (id, collection_id, type, spec_version, created, modified, stix_object)
    SELECT
      'threat-actor--' || a.id,
      p_collection_id,
      'threat-actor',
      '2.1',
      a.first_seen,
      COALESCE(a.last_seen, a.first_seen),
      jsonb_build_object(
        'type', 'threat-actor',
        'spec_version', '2.1',
        'id', 'threat-actor--' || a.id,
        'created', a.first_seen,
        'modified', COALESCE(a.last_seen, a.first_seen),
        'name', a.name,
        'description', a.description,
        'aliases', COALESCE(a.aliases, ARRAY[]::text[]),
        'threat_actor_types', ARRAY[COALESCE(a.actor_type, 'unknown')],
        'primary_motivation', COALESCE(a.motivation, 'unknown')
      )
    FROM threat_actors a
    ON CONFLICT (id, collection_id) DO NOTHING;

    GET DIAGNOSTICS v_count = v_count + ROW_COUNT;
  END IF;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_taxii_objects_collection ON taxii_objects(collection_id);
CREATE INDEX IF NOT EXISTS idx_taxii_objects_type ON taxii_objects(type);
CREATE INDEX IF NOT EXISTS idx_taxii_objects_added ON taxii_objects(added_at);
CREATE INDEX IF NOT EXISTS idx_taxii_objects_created ON taxii_objects(created);
CREATE INDEX IF NOT EXISTS idx_taxii_manifests_collection ON taxii_manifests(collection_id);
CREATE INDEX IF NOT EXISTS idx_taxii_collections_api_root ON taxii_collections(api_root_id);

-- ============================================
-- DEFAULT DATA
-- ============================================

-- Create default API root
INSERT INTO taxii_api_roots (name, title, description)
VALUES ('default', 'Vigil Default API Root', 'Default TAXII API root for Vigil threat intelligence')
ON CONFLICT (name) DO NOTHING;

-- Create default public collection
INSERT INTO taxii_collections (api_root_id, title, description, alias, is_public, auto_populate, populate_sources)
SELECT
  id,
  'Public Threat Intelligence',
  'Publicly shared threat indicators and actor information',
  'public-intel',
  true,
  true,
  ARRAY['iocs', 'actors']
FROM taxii_api_roots WHERE name = 'default'
ON CONFLICT (alias) DO NOTHING;

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE taxii_api_roots ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxii_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxii_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxii_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxii_subscriptions ENABLE ROW LEVEL SECURITY;

-- Public read for enabled API roots
CREATE POLICY "Anyone can view enabled API roots" ON taxii_api_roots
  FOR SELECT USING (enabled = true);

-- Collection access based on public flag or team membership
CREATE POLICY "Users can view accessible collections" ON taxii_collections
  FOR SELECT USING (
    is_public = true OR
    allowed_teams && ARRAY(SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

-- Object access follows collection access
CREATE POLICY "Users can view objects in accessible collections" ON taxii_objects
  FOR SELECT USING (
    collection_id IN (
      SELECT id FROM taxii_collections WHERE
        is_public = true OR
        allowed_teams && ARRAY(SELECT team_id FROM team_members WHERE user_id = auth.uid())
    )
  );
