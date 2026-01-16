/**
 * Teams & Collaboration Module
 * Database queries for team management and collaboration
 */

import { supabase } from './client'

export const teams = {
  async getUserTeams(userId) {
    const { data, error } = await supabase
      .from('team_members')
      .select(`
        team_id,
        role,
        joined_at,
        teams (
          id,
          name,
          slug,
          description,
          owner_id,
          settings,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('joined_at', { ascending: false })

    if (error) return { data: null, error }
    return { data: data?.map(m => ({ ...m.teams, role: m.role, joined_at: m.joined_at })), error: null }
  },

  async getTeam(teamId) {
    return supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single()
  },

  async createTeam(userId, name, description = '') {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name,
        slug,
        description,
        owner_id: userId,
      })
      .select()
      .single()

    if (teamError) return { data: null, error: teamError }

    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: userId,
        email: '',
        role: 'owner',
        joined_at: new Date().toISOString(),
      })

    if (memberError) return { data: null, error: memberError }

    return { data: team, error: null }
  },

  async updateTeam(teamId, updates) {
    return supabase
      .from('teams')
      .update(updates)
      .eq('id', teamId)
      .select()
      .single()
  },

  async deleteTeam(teamId) {
    return supabase
      .from('teams')
      .delete()
      .eq('id', teamId)
  },

  async getMembers(teamId) {
    return supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .order('role', { ascending: true })
      .order('joined_at', { ascending: true })
  },

  async addMember(teamId, email, role = 'viewer', invitedBy) {
    return supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: '',
        email,
        role,
        invited_by: invitedBy,
      })
      .select()
      .single()
  },

  async updateMemberRole(teamId, userId, role) {
    return supabase
      .from('team_members')
      .update({ role })
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .select()
      .single()
  },

  async removeMember(teamId, userId) {
    return supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId)
  },

  async createInvitation(teamId, email, role, invitedBy) {
    const token = crypto.randomUUID() + crypto.randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    return supabase
      .from('team_invitations')
      .upsert({
        team_id: teamId,
        email,
        role,
        token,
        invited_by: invitedBy,
        expires_at: expiresAt.toISOString(),
      }, { onConflict: 'team_id,email' })
      .select()
      .single()
  },

  async acceptInvitation(token, userId, displayName) {
    const { data: invite, error: inviteError } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('token', token)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (inviteError || !invite) {
      return { data: null, error: { message: 'Invalid or expired invitation' } }
    }

    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: invite.team_id,
        user_id: userId,
        email: invite.email,
        display_name: displayName,
        role: invite.role,
        invited_by: invite.invited_by,
        joined_at: new Date().toISOString(),
      })

    if (memberError) return { data: null, error: memberError }

    await supabase
      .from('team_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id)

    return { data: invite, error: null }
  },

  async getPendingInvitations(teamId) {
    return supabase
      .from('team_invitations')
      .select('*')
      .eq('team_id', teamId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
  },

  async cancelInvitation(invitationId) {
    return supabase
      .from('team_invitations')
      .delete()
      .eq('id', invitationId)
  },

  async logActivity(teamId, userId, action, entityType = null, entityId = null, details = {}) {
    return supabase
      .from('team_activity_log')
      .insert({
        team_id: teamId,
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details,
      })
  },

  async getActivityLog(teamId, limit = 50) {
    return supabase
      .from('team_activity_log')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(limit)
  },
}

export default teams
