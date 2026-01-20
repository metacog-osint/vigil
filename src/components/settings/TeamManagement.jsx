import { useState, useEffect } from 'react'
import { teams } from '../../lib/supabase'
import { formatDistanceToNow } from 'date-fns'

const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  analyst: 'Analyst',
  viewer: 'Viewer',
}

const ROLE_COLORS = {
  owner: 'badge-critical',
  admin: 'badge-high',
  analyst: 'badge-medium',
  viewer: 'badge-info',
}

function CreateTeamModal({ isOpen, onClose, onCreated, userId }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    setError(null)

    const { data, error: createError } = await teams.createTeam(
      userId,
      name.trim(),
      description.trim()
    )

    if (createError) {
      setError(createError.message)
      setLoading(false)
      return
    }

    onCreated(data)
    onClose()
    setName('')
    setDescription('')
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="cyber-card w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold text-white mb-4">Create Team</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Team Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="cyber-input w-full"
              placeholder="e.g., Security Operations"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="cyber-input w-full h-20 resize-none"
              placeholder="What does this team do?"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="cyber-button flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="cyber-button-primary flex-1"
            >
              {loading ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function InviteMemberModal({ isOpen, onClose, onInvited, teamId, userId }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('analyst')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setError(null)

    const { data, error: inviteError } = await teams.createInvitation(
      teamId,
      email.trim(),
      role,
      userId
    )

    if (inviteError) {
      setError(inviteError.message)
      setLoading(false)
      return
    }

    onInvited(data)
    onClose()
    setEmail('')
    setRole('analyst')
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="cyber-card w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold text-white mb-4">Invite Team Member</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="cyber-input w-full"
              placeholder="colleague@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="cyber-input w-full"
            >
              <option value="admin">Admin - Can manage team and members</option>
              <option value="analyst">Analyst - Can edit watchlists</option>
              <option value="viewer">Viewer - Read-only access</option>
            </select>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="cyber-button flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="cyber-button-primary flex-1"
            >
              {loading ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TeamMemberList({ teamId, userRole, currentUserId }) {
  const [members, setMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)

  const canManageMembers = userRole === 'owner' || userRole === 'admin'

  useEffect(() => {
    loadMembers()
  }, [teamId])

  async function loadMembers() {
    setLoading(true)
    const [membersResult, invitesResult] = await Promise.all([
      teams.getMembers(teamId),
      teams.getPendingInvitations(teamId),
    ])

    if (membersResult.data) setMembers(membersResult.data)
    if (invitesResult.data) setInvitations(invitesResult.data)
    setLoading(false)
  }

  async function handleRoleChange(userId, newRole) {
    const { error } = await teams.updateMemberRole(teamId, userId, newRole)
    if (!error) loadMembers()
  }

  async function handleRemoveMember(userId) {
    if (!confirm('Are you sure you want to remove this member?')) return
    const { error } = await teams.removeMember(teamId, userId)
    if (!error) loadMembers()
  }

  async function handleCancelInvite(inviteId) {
    const { error } = await teams.cancelInvitation(inviteId)
    if (!error) loadMembers()
  }

  if (loading) {
    return <div className="text-gray-400 text-sm">Loading members...</div>
  }

  return (
    <div className="space-y-4">
      {/* Active Members */}
      <div>
        <h4 className="text-sm font-medium text-gray-400 mb-2">Members ({members.length})</h4>
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-cyber-accent/20 flex items-center justify-center text-cyber-accent text-sm font-medium">
                  {(member.display_name || member.email || '?')[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-white text-sm">
                    {member.display_name || member.email || 'Unknown'}
                    {member.user_id === currentUserId && (
                      <span className="text-gray-500 ml-2">(you)</span>
                    )}
                  </div>
                  {member.joined_at && (
                    <div className="text-gray-500 text-xs">
                      Joined {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canManageMembers && member.role !== 'owner' && member.user_id !== currentUserId ? (
                  <>
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                      className="cyber-input text-xs py-1"
                    >
                      <option value="admin">Admin</option>
                      <option value="analyst">Analyst</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      onClick={() => handleRemoveMember(member.user_id)}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <span className={`${ROLE_COLORS[member.role]} text-xs`}>
                    {ROLE_LABELS[member.role]}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">
            Pending Invitations ({invitations.length})
          </h4>
          <div className="space-y-2">
            {invitations.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg border border-dashed border-gray-700"
              >
                <div>
                  <div className="text-gray-300 text-sm">{invite.email}</div>
                  <div className="text-gray-500 text-xs">
                    Expires {formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`${ROLE_COLORS[invite.role]} text-xs`}>
                    {ROLE_LABELS[invite.role]}
                  </span>
                  {canManageMembers && (
                    <button
                      onClick={() => handleCancelInvite(invite.id)}
                      className="text-gray-400 hover:text-white text-xs"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function TeamManagement({ user }) {
  const [userTeams, setUserTeams] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)

  useEffect(() => {
    if (user?.uid) {
      loadTeams()
    }
  }, [user?.uid])

  async function loadTeams() {
    setLoading(true)
    const { data, error } = await teams.getUserTeams(user.uid)
    if (!error && data) {
      setUserTeams(data)
      if (data.length > 0 && !selectedTeam) {
        setSelectedTeam(data[0])
      }
    }
    setLoading(false)
  }

  function handleTeamCreated(team) {
    const newTeam = { ...team, role: 'owner' }
    setUserTeams([newTeam, ...userTeams])
    setSelectedTeam(newTeam)
  }

  if (!user) {
    return (
      <div className="cyber-card">
        <h3 className="text-lg font-semibold text-white mb-2">Team Collaboration</h3>
        <p className="text-gray-400 text-sm">Sign in to create or join a team.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="cyber-card">
        <h3 className="text-lg font-semibold text-white mb-2">Team Collaboration</h3>
        <p className="text-gray-400 text-sm">Loading teams...</p>
      </div>
    )
  }

  return (
    <div className="cyber-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Team Collaboration</h3>
        <button onClick={() => setShowCreateModal(true)} className="cyber-button text-sm">
          + Create Team
        </button>
      </div>

      {userTeams.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-4">
            <svg
              className="w-12 h-12 mx-auto mb-2 opacity-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p>No teams yet</p>
          </div>
          <p className="text-gray-500 text-sm mb-4">
            Create a team to collaborate with colleagues on threat intelligence.
          </p>
          <button onClick={() => setShowCreateModal(true)} className="cyber-button-primary">
            Create Your First Team
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Team Selector */}
          {userTeams.length > 1 && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Select Team</label>
              <select
                value={selectedTeam?.id || ''}
                onChange={(e) => {
                  const team = userTeams.find((t) => t.id === e.target.value)
                  setSelectedTeam(team)
                }}
                className="cyber-input w-full"
              >
                {userTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({ROLE_LABELS[team.role]})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Selected Team Details */}
          {selectedTeam && (
            <div className="border-t border-gray-800 pt-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-white font-medium">{selectedTeam.name}</h4>
                  {selectedTeam.description && (
                    <p className="text-gray-500 text-sm">{selectedTeam.description}</p>
                  )}
                </div>
                {(selectedTeam.role === 'owner' || selectedTeam.role === 'admin') && (
                  <button onClick={() => setShowInviteModal(true)} className="cyber-button text-sm">
                    + Invite Member
                  </button>
                )}
              </div>

              <TeamMemberList
                teamId={selectedTeam.id}
                userRole={selectedTeam.role}
                currentUserId={user.uid}
              />
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateTeamModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleTeamCreated}
        userId={user.uid}
      />

      {selectedTeam && (
        <InviteMemberModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          onInvited={() => {}}
          teamId={selectedTeam.id}
          userId={user.uid}
        />
      )}
    </div>
  )
}
