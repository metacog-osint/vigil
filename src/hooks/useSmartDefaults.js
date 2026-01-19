/**
 * Smart Defaults Hook
 *
 * Provides personalization-based defaults for the UI based on:
 * - User's sector/industry
 * - Tech vendors they use
 * - Their role (inferred from behavior or explicit selection)
 *
 * This helps tailor the interface to each user's needs without manual configuration.
 */

import { useState, useEffect, useMemo } from 'react'
import { orgProfile as orgProfileApi } from '../lib/supabase'

// Sector-based configuration presets
const SECTOR_PRESETS = {
  healthcare: {
    pinnedItems: ['/', '/vulnerabilities', '/advisories', '/alerts'],
    expandedGroups: ['intelligence', 'workspace'],
    quickSearches: ['HIPAA', 'healthcare ransomware', 'medical device CVE'],
    priority: 'compliance', // Focus on compliance and advisories
  },
  finance: {
    pinnedItems: ['/', '/actors', '/trends', '/alerts'],
    expandedGroups: ['intelligence', 'analysis'],
    quickSearches: ['financial sector', 'banking trojan', 'PCI DSS'],
    priority: 'risk', // Focus on risk and threat actors
  },
  technology: {
    pinnedItems: ['/', '/iocs', '/techniques', '/threat-hunts'],
    expandedGroups: ['intelligence', 'hunting'],
    quickSearches: ['supply chain', 'zero day', 'APT'],
    priority: 'hunting', // Focus on threat hunting
  },
  government: {
    pinnedItems: ['/', '/advisories', '/actors', '/alerts'],
    expandedGroups: ['intelligence', 'workspace'],
    quickSearches: ['nation state', 'CISA KEV', 'critical infrastructure'],
    priority: 'compliance', // Focus on compliance
  },
  education: {
    pinnedItems: ['/', '/events', '/vulnerabilities', '/alerts'],
    expandedGroups: ['intelligence', 'workspace'],
    quickSearches: ['education sector', 'ransomware', 'phishing'],
    priority: 'awareness', // Focus on awareness and incidents
  },
  retail: {
    pinnedItems: ['/', '/iocs', '/actors', '/alerts'],
    expandedGroups: ['intelligence', 'hunting'],
    quickSearches: ['POS malware', 'retail breach', 'Magecart'],
    priority: 'hunting',
  },
  manufacturing: {
    pinnedItems: ['/', '/vulnerabilities', '/advisories', '/assets'],
    expandedGroups: ['intelligence', 'workspace'],
    quickSearches: ['ICS', 'SCADA', 'OT security'],
    priority: 'assets',
  },
  energy: {
    pinnedItems: ['/', '/advisories', '/actors', '/vulnerabilities'],
    expandedGroups: ['intelligence', 'analysis'],
    quickSearches: ['critical infrastructure', 'ICS', 'nation state'],
    priority: 'compliance',
  },
  // Default for unknown sectors
  default: {
    pinnedItems: ['/', '/actors', '/alerts'],
    expandedGroups: ['intelligence', 'workspace'],
    quickSearches: ['ransomware', 'CVE', 'threat actor'],
    priority: 'general',
  },
}

// Quick actions based on priority/role
const QUICK_ACTIONS = {
  compliance: [
    { label: 'View CISA KEV', path: '/vulnerabilities?filter=kev', icon: 'shield' },
    { label: 'Check Advisories', path: '/advisories', icon: 'document' },
    { label: 'My Alerts', path: '/alerts', icon: 'bell' },
  ],
  risk: [
    { label: 'Escalating Actors', path: '/actors?trend=ESCALATING', icon: 'trending' },
    { label: 'View Trends', path: '/trends', icon: 'chart' },
    { label: 'Recent Incidents', path: '/events?view=ransomware', icon: 'alert' },
  ],
  hunting: [
    { label: 'IOC Search', path: '/iocs', icon: 'search' },
    { label: 'ATT&CK Matrix', path: '/techniques', icon: 'grid' },
    { label: 'Threat Hunts', path: '/threat-hunts', icon: 'target' },
  ],
  assets: [
    { label: 'My Assets', path: '/assets', icon: 'server' },
    { label: 'Vendor Vulns', path: '/vulnerabilities', icon: 'shield' },
    { label: 'My Alerts', path: '/alerts', icon: 'bell' },
  ],
  awareness: [
    { label: 'Latest Activity', path: '/events', icon: 'activity' },
    { label: 'Threat Actors', path: '/actors', icon: 'users' },
    { label: 'My Watchlists', path: '/watchlists', icon: 'star' },
  ],
  general: [
    { label: 'Dashboard', path: '/', icon: 'home' },
    { label: 'Threat Actors', path: '/actors', icon: 'users' },
    { label: 'Vulnerabilities', path: '/vulnerabilities', icon: 'shield' },
  ],
}

// Navigation pages for quick jump
const NAV_PAGES = [
  { label: 'Dashboard', path: '/', keywords: ['home', 'dashboard', 'overview'] },
  { label: 'Activity', path: '/events', keywords: ['events', 'timeline', 'activity'] },
  { label: 'Ransomware', path: '/events?view=ransomware', keywords: ['ransomware', 'incidents'] },
  { label: 'Threat Actors', path: '/actors', keywords: ['actors', 'groups', 'apt'] },
  { label: 'Vulnerabilities', path: '/vulnerabilities', keywords: ['cve', 'vulnerabilities', 'vulns'] },
  { label: 'Advisories', path: '/advisories', keywords: ['advisories', 'bulletins'] },
  { label: 'IOC Search', path: '/iocs', keywords: ['ioc', 'indicators', 'search'] },
  { label: 'ATT&CK Matrix', path: '/techniques', keywords: ['mitre', 'attack', 'techniques', 'ttps'] },
  { label: 'Threat Hunts', path: '/threat-hunts', keywords: ['hunt', 'hunting'] },
  { label: 'Trends', path: '/trends', keywords: ['trends', 'analysis'] },
  { label: 'Reports', path: '/reports', keywords: ['reports', 'export'] },
  { label: 'Investigations', path: '/investigations', keywords: ['investigations', 'cases'] },
  { label: 'Watchlists', path: '/watchlists', keywords: ['watchlist', 'watch', 'monitor'] },
  { label: 'Alerts', path: '/alerts', keywords: ['alerts', 'notifications'] },
  { label: 'Assets', path: '/assets', keywords: ['assets', 'inventory'] },
  { label: 'Settings', path: '/settings', keywords: ['settings', 'preferences', 'config'] },
]

/**
 * Hook to get smart defaults based on user's personalization
 */
export function useSmartDefaults() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hasCustomized, setHasCustomized] = useState(false)

  // Load profile on mount
  useEffect(() => {
    async function loadProfile() {
      try {
        // Check if user has customized their sidebar
        const customPinned = localStorage.getItem('vigil_sidebar_pinned')
        setHasCustomized(!!customPinned)

        // Load org profile
        const data = await orgProfileApi.get()
        setProfile(data)
      } catch (error) {
        console.error('Error loading profile for smart defaults:', error)
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [])

  // Compute smart defaults based on profile
  const defaults = useMemo(() => {
    const sector = profile?.sector || 'default'
    const preset = SECTOR_PRESETS[sector] || SECTOR_PRESETS.default

    return {
      sector,
      pinnedItems: preset.pinnedItems,
      expandedGroups: preset.expandedGroups.reduce((acc, id) => {
        acc[id] = true
        return acc
      }, {}),
      quickSearches: preset.quickSearches,
      priority: preset.priority,
      quickActions: QUICK_ACTIONS[preset.priority] || QUICK_ACTIONS.general,
      vendors: profile?.tech_vendors || [],
    }
  }, [profile])

  return {
    ...defaults,
    loading,
    hasCustomized,
    profile,
  }
}

/**
 * Get navigation pages for quick jump in search
 */
export function getNavPages() {
  return NAV_PAGES
}

/**
 * Filter nav pages by search query
 */
export function filterNavPages(query) {
  if (!query) return NAV_PAGES.slice(0, 6)

  const lower = query.toLowerCase()
  return NAV_PAGES.filter(page =>
    page.label.toLowerCase().includes(lower) ||
    page.keywords.some(kw => kw.includes(lower))
  )
}

/**
 * Get preset for a specific sector
 */
export function getSectorPreset(sector) {
  return SECTOR_PRESETS[sector] || SECTOR_PRESETS.default
}

export default useSmartDefaults
