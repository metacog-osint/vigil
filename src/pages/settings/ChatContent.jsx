/**
 * Chat Content - Wrapper for ChatIntegrations page within Settings
 */
import { lazy, Suspense } from 'react'

const ChatPage = lazy(() => import('../ChatIntegrations'))

export default function ChatContent() {
  return (
    <Suspense fallback={<div className="animate-pulse text-gray-400">Loading...</div>}>
      <div className="settings-content-wrapper">
        <ChatPage />
      </div>
    </Suspense>
  )
}
