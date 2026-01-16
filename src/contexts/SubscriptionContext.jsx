import { createContext, useContext, useState, useEffect } from 'react'
import { getUserSubscription } from '../lib/stripe'
import { canAccess, isLimitReached, getLimit, getTierFeatures } from '../lib/features'
import { useAuth } from '../hooks/useAuth'

const SubscriptionContext = createContext(null)

export function SubscriptionProvider({ children }) {
  const { user } = useAuth()
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSubscription() {
      if (!user?.uid) {
        setSubscription({ tier: 'free', status: 'active' })
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const sub = await getUserSubscription(user.uid)
        setSubscription(sub)
      } catch (error) {
        console.error('Error loading subscription:', error)
        setSubscription({ tier: 'free', status: 'active' })
      }
      setLoading(false)
    }

    loadSubscription()
  }, [user?.uid])

  const tier = subscription?.tier || 'free'

  const value = {
    subscription,
    tier,
    loading,
    // Convenience methods that use current tier
    canAccess: (feature) => canAccess(tier, feature),
    isLimitReached: (limitType, currentCount) => isLimitReached(tier, limitType, currentCount),
    getLimit: (limitType) => getLimit(tier, limitType),
    features: getTierFeatures(tier),
    // Refresh subscription (after payment, etc.)
    refresh: async () => {
      if (user?.uid) {
        const sub = await getUserSubscription(user.uid)
        setSubscription(sub)
      }
    },
  }

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  const context = useContext(SubscriptionContext)
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider')
  }
  return context
}

export default SubscriptionContext
