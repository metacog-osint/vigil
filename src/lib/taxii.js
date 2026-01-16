/**
 * TAXII 2.1 Server Module
 *
 * Implements TAXII 2.1 protocol for threat intelligence sharing.
 * Provides server-side functions for discovery, collections, and object management.
 */

import { supabase } from './supabase'

// ============================================
// CONSTANTS
// ============================================

export const TAXII_VERSION = '2.1'
export const TAXII_MEDIA_TYPE = 'application/taxii+json;version=2.1'
export const STIX_MEDIA_TYPE = 'application/stix+json;version=2.1'

export const STIX_TYPES = {
  ATTACK_PATTERN: 'attack-pattern',
  CAMPAIGN: 'campaign',
  COURSE_OF_ACTION: 'course-of-action',
  GROUPING: 'grouping',
  IDENTITY: 'identity',
  INDICATOR: 'indicator',
  INFRASTRUCTURE: 'infrastructure',
  INTRUSION_SET: 'intrusion-set',
  LOCATION: 'location',
  MALWARE: 'malware',
  MALWARE_ANALYSIS: 'malware-analysis',
  NOTE: 'note',
  OBSERVED_DATA: 'observed-data',
  OPINION: 'opinion',
  REPORT: 'report',
  THREAT_ACTOR: 'threat-actor',
  TOOL: 'tool',
  VULNERABILITY: 'vulnerability',
  RELATIONSHIP: 'relationship',
  SIGHTING: 'sighting',
}

// ============================================
// DISCOVERY API
// ============================================

/**
 * Get TAXII server discovery information
 */
export async function getDiscovery() {
  const { data, error } = await supabase.rpc('taxii_discovery')

  if (error) {
    console.error('TAXII discovery error:', error)
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Get API root information
 */
export async function getApiRoot(rootName) {
  const { data, error } = await supabase.rpc('taxii_api_root_info', {
    p_root_name: rootName,
  })

  if (error) {
    console.error('TAXII API root error:', error)
    return { data: null, error }
  }

  return { data, error: null }
}

// ============================================
// COLLECTIONS API
// ============================================

/**
 * Get all collections for an API root
 */
export async function getCollections(rootName, options = {}) {
  const { teamIds = [] } = options

  const { data, error } = await supabase.rpc('taxii_get_collections', {
    p_root_name: rootName,
    p_team_ids: teamIds,
  })

  if (error) {
    console.error('TAXII collections error:', error)
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Get a single collection by ID
 */
export async function getCollection(collectionId) {
  const { data, error } = await supabase
    .from('taxii_collections')
    .select('*')
    .eq('id', collectionId)
    .single()

  if (error) {
    console.error('TAXII collection error:', error)
    return { data: null, error }
  }

  // Format as TAXII response
  return {
    data: {
      id: data.id,
      title: data.title,
      description: data.description,
      alias: data.alias,
      can_read: data.can_read,
      can_write: data.can_write,
      media_types: data.media_types,
    },
    error: null,
  }
}

/**
 * Create a new collection
 */
export async function createCollection(apiRootId, collection) {
  const { data, error } = await supabase
    .from('taxii_collections')
    .insert({
      api_root_id: apiRootId,
      title: collection.title,
      description: collection.description,
      alias: collection.alias,
      can_read: collection.can_read ?? true,
      can_write: collection.can_write ?? false,
      is_public: collection.is_public ?? false,
      allowed_teams: collection.allowed_teams ?? [],
      auto_populate: collection.auto_populate ?? false,
      populate_sources: collection.populate_sources ?? [],
    })
    .select()
    .single()

  return { data, error }
}

/**
 * Update a collection
 */
export async function updateCollection(collectionId, updates) {
  const { data, error } = await supabase
    .from('taxii_collections')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', collectionId)
    .select()
    .single()

  return { data, error }
}

/**
 * Delete a collection
 */
export async function deleteCollection(collectionId) {
  const { error } = await supabase.from('taxii_collections').delete().eq('id', collectionId)

  return { error }
}

// ============================================
// OBJECTS API
// ============================================

/**
 * Get objects from a collection
 */
export async function getObjects(collectionId, options = {}) {
  const {
    addedAfter = null,
    limit = 100,
    next = null,
    matchId = null,
    matchType = null,
    matchSpecVersion = null,
  } = options

  const { data, error } = await supabase.rpc('taxii_get_objects', {
    p_collection_id: collectionId,
    p_added_after: addedAfter,
    p_limit: limit,
    p_next: next,
    p_match_id: matchId,
    p_match_type: matchType,
    p_match_spec_version: matchSpecVersion,
  })

  if (error) {
    console.error('TAXII get objects error:', error)
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Get a specific object by ID
 */
export async function getObject(collectionId, objectId, options = {}) {
  const { matchSpecVersion = null } = options

  const { data, error } = await supabase
    .from('taxii_objects')
    .select('stix_object')
    .eq('collection_id', collectionId)
    .eq('id', objectId)
    .single()

  if (error) {
    return { data: null, error }
  }

  return {
    data: {
      objects: [data.stix_object],
    },
    error: null,
  }
}

/**
 * Add objects to a collection
 */
export async function addObjects(collectionId, objects) {
  const { data: statusId, error } = await supabase.rpc('taxii_add_objects', {
    p_collection_id: collectionId,
    p_objects: objects,
  })

  if (error) {
    console.error('TAXII add objects error:', error)
    return { data: null, error }
  }

  // Get the status
  const { data: status } = await supabase
    .from('taxii_status')
    .select('*')
    .eq('id', statusId)
    .single()

  return { data: status, error: null }
}

/**
 * Delete an object from a collection
 */
export async function deleteObject(collectionId, objectId) {
  const { error } = await supabase
    .from('taxii_objects')
    .delete()
    .eq('collection_id', collectionId)
    .eq('id', objectId)

  return { error }
}

// ============================================
// MANIFEST API
// ============================================

/**
 * Get manifest for a collection
 */
export async function getManifest(collectionId, options = {}) {
  const { addedAfter = null, limit = 100 } = options

  const { data, error } = await supabase.rpc('taxii_get_manifest', {
    p_collection_id: collectionId,
    p_added_after: addedAfter,
    p_limit: limit,
  })

  if (error) {
    console.error('TAXII manifest error:', error)
    return { data: null, error }
  }

  return { data, error: null }
}

// ============================================
// STATUS API
// ============================================

/**
 * Get status of an async operation
 */
export async function getStatus(statusId) {
  const { data, error } = await supabase.from('taxii_status').select('*').eq('id', statusId).single()

  if (error) {
    return { data: null, error }
  }

  return {
    data: {
      id: data.id,
      status: data.status,
      request_timestamp: data.request_timestamp,
      total_count: data.total_count,
      success_count: data.success_count,
      failure_count: data.failure_count,
      pending_count: data.pending_count,
      successes: data.successes,
      failures: data.failures,
      pendings: data.pendings,
    },
    error: null,
  }
}

// ============================================
// POPULATION HELPERS
// ============================================

/**
 * Populate a collection from Vigil data
 */
export async function populateCollection(collectionId) {
  const { data, error } = await supabase.rpc('taxii_populate_collection', {
    p_collection_id: collectionId,
  })

  return { data, error }
}

/**
 * Get all API roots
 */
export async function getApiRoots() {
  const { data, error } = await supabase
    .from('taxii_api_roots')
    .select('*')
    .eq('enabled', true)
    .order('created_at')

  return { data, error }
}

/**
 * Create an API root
 */
export async function createApiRoot(root) {
  const { data, error } = await supabase
    .from('taxii_api_roots')
    .insert({
      name: root.name,
      title: root.title,
      description: root.description,
      max_content_length: root.max_content_length ?? 10485760,
    })
    .select()
    .single()

  return { data, error }
}

// ============================================
// SUBSCRIPTION HELPERS
// ============================================

/**
 * Subscribe to a collection
 */
export async function subscribe(collectionId, options = {}) {
  const { callbackUrl, addedAfter, matchId, matchType } = options

  const { data, error } = await supabase
    .from('taxii_subscriptions')
    .insert({
      collection_id: collectionId,
      callback_url: callbackUrl,
      added_after: addedAfter,
      match_id: matchId,
      match_type: matchType,
    })
    .select()
    .single()

  return { data, error }
}

/**
 * Unsubscribe from a collection
 */
export async function unsubscribe(subscriptionId) {
  const { error } = await supabase.from('taxii_subscriptions').delete().eq('id', subscriptionId)

  return { error }
}

/**
 * Get subscriptions for a collection
 */
export async function getSubscriptions(collectionId) {
  const { data, error } = await supabase
    .from('taxii_subscriptions')
    .select('*')
    .eq('collection_id', collectionId)
    .eq('enabled', true)

  return { data, error }
}

export default {
  // Discovery
  getDiscovery,
  getApiRoot,
  getApiRoots,
  createApiRoot,
  // Collections
  getCollections,
  getCollection,
  createCollection,
  updateCollection,
  deleteCollection,
  populateCollection,
  // Objects
  getObjects,
  getObject,
  addObjects,
  deleteObject,
  // Manifest
  getManifest,
  // Status
  getStatus,
  // Subscriptions
  subscribe,
  unsubscribe,
  getSubscriptions,
  // Constants
  TAXII_VERSION,
  TAXII_MEDIA_TYPE,
  STIX_MEDIA_TYPE,
  STIX_TYPES,
}
