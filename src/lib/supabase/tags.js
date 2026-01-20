/**
 * Tags Module
 * Database queries for entity tagging system
 */

import { supabase } from './client'

export const tags = {
  async getAll(userId = 'anonymous') {
    return supabase
      .from('tags')
      .select(
        `
        *,
        entity_tags(count)
      `
      )
      .eq('user_id', userId)
      .order('name', { ascending: true })
  },

  async create(tag) {
    return supabase.from('tags').insert(tag).select().single()
  },

  async update(id, updates) {
    return supabase.from('tags').update(updates).eq('id', id).select().single()
  },

  async delete(id) {
    return supabase.from('tags').delete().eq('id', id)
  },

  async addToEntity(tagId, entityType, entityId) {
    return supabase
      .from('entity_tags')
      .insert({ tag_id: tagId, entity_type: entityType, entity_id: entityId })
      .select()
      .single()
  },

  async removeFromEntity(tagId, entityType, entityId) {
    return supabase
      .from('entity_tags')
      .delete()
      .eq('tag_id', tagId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
  },

  async getForEntity(entityType, entityId) {
    return supabase
      .from('entity_tags')
      .select(
        `
        *,
        tag:tags(*)
      `
      )
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
  },

  async getEntitiesByTag(tagId) {
    return supabase.from('entity_tags').select('*').eq('tag_id', tagId)
  },
}

export default tags
