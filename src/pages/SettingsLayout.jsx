/**
 * Settings Layout
 *
 * Unified settings experience with sub-navigation for:
 * - General settings
 * - Integrations (Webhooks, Chat, Vendors)
 * - Admin (Audit Logs, Status, Benchmarks, Ops)
 */
import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { clsx } from 'clsx'

// Import existing pages as content components
import SettingsContent from './settings/SettingsContent'
import WebhooksContent from './settings/WebhooksContent'
import ChatContent from './settings/ChatContent'
import VendorsContent from './settings/VendorsContent'
import ApiDocsContent from './settings/ApiDocsContent'
import AuditLogsContent from './settings/AuditLogsContent'
import StatusContent from './settings/StatusContent'
import BenchmarksContent from './settings/BenchmarksContent'
import OpsContent from './settings/OpsContent'

const TABS = [
  {
    id: 'general',
    name: 'General',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'webhooks',
    name: 'Webhooks',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
  {
    id: 'chat',
    name: 'Chat Bots',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    id: 'vendors',
    name: 'Vendors',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    id: 'api',
    name: 'API Docs',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
]

const ADMIN_TABS = [
  {
    id: 'audit',
    name: 'Audit Logs',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    id: 'status',
    name: 'Status',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'benchmarks',
    name: 'Benchmarks',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'ops',
    name: 'Operations',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    adminOnly: true,
  },
]

export default function SettingsLayout() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'general')
  const { profile } = useAuth()

  // Check if user is admin (simplified check)
  const isAdmin = profile?.role === 'admin' || profile?.tier === 'enterprise'

  const allTabs = [...TABS, ...ADMIN_TABS.filter(t => !t.adminOnly || isAdmin)]

  useEffect(() => {
    if (activeTab !== 'general') {
      setSearchParams({ tab: activeTab })
    } else {
      setSearchParams({})
    }
  }, [activeTab, setSearchParams])

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab')
    if (tabFromUrl && allTabs.find(t => t.id === tabFromUrl)) {
      setActiveTab(tabFromUrl)
    }
  }, [])

  return (
    <div className="flex gap-6 min-h-[calc(100vh-8rem)]">
      {/* Sidebar Navigation */}
      <div className="w-48 flex-shrink-0">
        <div className="sticky top-6">
          <h1 className="text-xl font-bold text-white mb-1">Settings</h1>
          <p className="text-gray-500 text-xs mb-4">Configure your workspace</p>

          <nav className="space-y-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-left',
                  activeTab === tab.id
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )}
              >
                {tab.icon}
                {tab.name}
              </button>
            ))}

            {/* Admin section divider */}
            {ADMIN_TABS.filter(t => !t.adminOnly || isAdmin).length > 0 && (
              <div className="pt-4 mt-4 border-t border-gray-800">
                <div className="px-3 py-1 text-xs font-semibold text-gray-600 uppercase">Admin</div>
              </div>
            )}

            {ADMIN_TABS.filter(t => !t.adminOnly || isAdmin).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-left',
                  activeTab === tab.id
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )}
              >
                {tab.icon}
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {activeTab === 'general' && <SettingsContent />}
        {activeTab === 'webhooks' && <WebhooksContent />}
        {activeTab === 'chat' && <ChatContent />}
        {activeTab === 'vendors' && <VendorsContent />}
        {activeTab === 'api' && <ApiDocsContent />}
        {activeTab === 'audit' && <AuditLogsContent />}
        {activeTab === 'status' && <StatusContent />}
        {activeTab === 'benchmarks' && <BenchmarksContent />}
        {activeTab === 'ops' && <OpsContent />}
      </div>
    </div>
  )
}
