# State Management Patterns

> **Last Updated:** January 17, 2026
> **Related:** CLAUDE.md, Architecture Improvements Plan

This document outlines the state management patterns used in Vigil and provides guidance for maintaining consistency.

---

## Overview

Vigil uses a layered approach to state management:

1. **React Context** - Global application state (auth, tenant, subscriptions, toasts)
2. **Local Component State** - UI state, form inputs, temporary data
3. **Supabase Direct Calls** - Data fetching and mutations
4. **URL State** - Filter parameters, pagination, view modes

---

## Context Providers

### Available Contexts

| Context | Location | Purpose |
|---------|----------|---------|
| `TenantContext` | `src/contexts/TenantContext.jsx` | Multi-tenant organization data |
| `SubscriptionContext` | `src/contexts/SubscriptionContext.jsx` | User subscription tier and features |
| `ToastContext` | `src/contexts/ToastContext.jsx` | Global notifications |

### Usage Pattern

```jsx
import { useTenant } from '../contexts/TenantContext'
import { useSubscription } from '../contexts/SubscriptionContext'
import { useToast } from '../contexts/ToastContext'

function MyComponent() {
  const { tenant, loading: tenantLoading } = useTenant()
  const { tier, hasFeature } = useSubscription()
  const { showToast, showError, showSuccess } = useToast()

  // Use context values...
}
```

### When to Use Context

Use React Context when:
- Data is needed by many components across the tree
- Data changes infrequently
- You need to avoid prop drilling

Don't use Context for:
- Frequently changing data (use local state)
- Data specific to one component or feature
- Server state that can be fetched directly

---

## Data Fetching Patterns

### Standard Pattern (Recommended)

Use this pattern for most data fetching:

```jsx
import { useState, useEffect, useCallback } from 'react'
import { threatActors } from '../lib/supabase'
import { withRetry } from '../lib/retry'

function ThreatActorsPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await withRetry(() => threatActors.getAll())
      if (result.error) throw result.error
      setData(result.data || [])
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <LoadingState
      loading={loading}
      error={error}
      data={data}
      onRetry={loadData}
    >
      {/* Render data */}
    </LoadingState>
  )
}
```

### With Dependencies

When data depends on filters or other state:

```jsx
function FilteredList({ sector, country }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await incidents.getFiltered({ sector, country })
      setData(result.data || [])
    } finally {
      setLoading(false)
    }
  }, [sector, country]) // Dependencies trigger reload

  useEffect(() => {
    loadData()
  }, [loadData])

  // ...
}
```

### Optimistic Updates

For better UX on mutations:

```jsx
async function handleToggleWatchlist(actorId) {
  // Optimistic update
  const previousData = [...data]
  setData(data.map(item =>
    item.id === actorId
      ? { ...item, isWatched: !item.isWatched }
      : item
  ))

  try {
    await watchlists.toggle(actorId)
  } catch (err) {
    // Revert on error
    setData(previousData)
    showError('Failed to update watchlist')
  }
}
```

---

## Real-time Subscriptions

### Pattern

```jsx
import { useEffect } from 'react'
import { subscribeToTable } from '../lib/supabase'

function LiveData() {
  const [data, setData] = useState([])

  useEffect(() => {
    // Load initial data
    loadData()

    // Subscribe to real-time updates
    const unsubscribe = subscribeToTable('incidents', (payload) => {
      if (payload.eventType === 'INSERT') {
        setData(prev => [payload.new, ...prev])
      } else if (payload.eventType === 'UPDATE') {
        setData(prev => prev.map(item =>
          item.id === payload.new.id ? payload.new : item
        ))
      } else if (payload.eventType === 'DELETE') {
        setData(prev => prev.filter(item => item.id !== payload.old.id))
      }
    })

    // IMPORTANT: Always clean up subscriptions
    return () => unsubscribe()
  }, [])

  // ...
}
```

### Subscription Cleanup Checklist

- [ ] Every `subscribeToTable` call has a cleanup in the useEffect return
- [ ] Subscription is only created once (empty dependency array or stable deps)
- [ ] No stale closures over component state

---

## URL State Pattern

### Using URL for Filters

```jsx
import { useSearchParams } from 'react-router-dom'

function FilteredPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const sector = searchParams.get('sector') || ''
  const page = parseInt(searchParams.get('page')) || 1

  const updateFilter = (key, value) => {
    const newParams = new URLSearchParams(searchParams)
    if (value) {
      newParams.set(key, value)
    } else {
      newParams.delete(key)
    }
    // Reset to page 1 when filters change
    if (key !== 'page') {
      newParams.set('page', '1')
    }
    setSearchParams(newParams)
  }

  // Use sector, page in data fetching...
}
```

Benefits:
- Shareable/bookmarkable URLs
- Browser back/forward works
- State persists on refresh

---

## Form State Pattern

### Controlled Forms

```jsx
function SettingsForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate
    const newErrors = {}
    if (!formData.name) newErrors.name = 'Name is required'
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setSubmitting(true)
    try {
      await saveSettings(formData)
      showSuccess('Settings saved')
    } catch (err) {
      showError('Failed to save settings')
    } finally {
      setSubmitting(false)
    }
  }

  // Render form...
}
```

---

## Custom Hooks Pattern

### Creating Reusable Data Hooks

```jsx
// src/hooks/useThreatActors.js
import { useState, useEffect, useCallback } from 'react'
import { threatActors } from '../lib/supabase'

export function useThreatActors(options = {}) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const { trendStatus, sector } = options

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await threatActors.getAll({
        trendStatus,
        sector,
      })
      if (result.error) throw result.error
      setData(result.data || [])
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [trendStatus, sector])

  useEffect(() => {
    load()
  }, [load])

  return {
    data,
    loading,
    error,
    refetch: load,
  }
}
```

### Using Custom Hooks

```jsx
function MyComponent() {
  const { data, loading, error, refetch } = useThreatActors({
    trendStatus: 'ESCALATING',
  })

  // ...
}
```

---

## Anti-Patterns to Avoid

### 1. Fetching in Render

```jsx
// BAD - Will cause infinite loops
function BadComponent() {
  const [data, setData] = useState([])
  fetchData().then(setData) // Called on every render!
  return <div>{/* ... */}</div>
}

// GOOD - Fetch in useEffect
function GoodComponent() {
  const [data, setData] = useState([])
  useEffect(() => {
    fetchData().then(setData)
  }, [])
  return <div>{/* ... */}</div>
}
```

### 2. Missing Subscription Cleanup

```jsx
// BAD - Memory leak
useEffect(() => {
  subscribeToTable('incidents', handleUpdate)
  // No cleanup!
}, [])

// GOOD - Proper cleanup
useEffect(() => {
  const unsubscribe = subscribeToTable('incidents', handleUpdate)
  return () => unsubscribe()
}, [])
```

### 3. Stale Closures

```jsx
// BAD - count will be stale in the callback
const [count, setCount] = useState(0)
useEffect(() => {
  const interval = setInterval(() => {
    setCount(count + 1) // Always 0 + 1
  }, 1000)
  return () => clearInterval(interval)
}, []) // Empty deps, count is stale

// GOOD - Use functional update
useEffect(() => {
  const interval = setInterval(() => {
    setCount(prev => prev + 1) // Uses previous value
  }, 1000)
  return () => clearInterval(interval)
}, [])
```

### 4. Props in Initial State

```jsx
// BAD - Won't update when prop changes
function BadComponent({ initialValue }) {
  const [value, setValue] = useState(initialValue)
  // value won't change when initialValue prop changes
}

// GOOD - Derive from props or use key
function GoodComponent({ value, onChange }) {
  // Controlled component - parent owns the state
}

// OR - Reset on prop change
function GoodComponent2({ initialValue }) {
  const [value, setValue] = useState(initialValue)
  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])
}
```

---

## State Debugging Tips

### React DevTools

Install React DevTools browser extension to:
- Inspect component state and props
- Track context values
- Profile performance

### Console Logging State Changes

```jsx
useEffect(() => {
  console.log('[State Update] data:', data)
}, [data])
```

### Network Tab

Use browser DevTools Network tab to verify:
- API calls are made at the right time
- No duplicate calls
- Correct request parameters

---

*Last Updated: January 17, 2026*
