import { useState, useEffect } from 'react'
import { onAuthChange, getUserPreferences } from '../lib/firebase'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [preferences, setPreferences] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser)

      if (firebaseUser) {
        try {
          const prefs = await getUserPreferences(firebaseUser.uid)
          setPreferences(prefs)
        } catch (error) {
          console.error('Error loading preferences:', error)
        }
      } else {
        setPreferences(null)
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  return { user, preferences, loading }
}

export default useAuth
