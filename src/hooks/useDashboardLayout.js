/**
 * useDashboardLayout Hook
 *
 * Manages dashboard widget layouts with persistence to Supabase.
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase/client'
import { useAuth } from './useAuth'
import { DEFAULT_LAYOUT } from '../lib/widgetRegistry'

const STORAGE_KEY = 'vigil_dashboard_layout'

export function useDashboardLayout() {
  const { user } = useAuth()
  const [layout, setLayout] = useState(null)
  const [layouts, setLayouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Load layouts on mount
  useEffect(() => {
    if (user) {
      loadLayouts()
    } else {
      // Use local storage for anonymous users
      loadLocalLayout()
    }
  }, [user])

  // Load layouts from Supabase
  async function loadLayouts() {
    try {
      const { data, error } = await supabase
        .from('dashboard_layouts')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('name')

      if (error && !error.message?.includes('does not exist')) {
        console.error('Error loading layouts:', error)
      }

      if (data && data.length > 0) {
        setLayouts(data)
        // Use default layout or first one
        const defaultLayout = data.find((l) => l.is_default) || data[0]
        setLayout(defaultLayout.layout)
      } else {
        // No saved layouts, use default
        setLayout(DEFAULT_LAYOUT)
      }
    } catch (err) {
      console.error('Error loading layouts:', err)
      setLayout(DEFAULT_LAYOUT)
    } finally {
      setLoading(false)
    }
  }

  // Load from local storage
  function loadLocalLayout() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setLayout(JSON.parse(stored))
      } else {
        setLayout(DEFAULT_LAYOUT)
      }
    } catch {
      setLayout(DEFAULT_LAYOUT)
    }
    setLoading(false)
  }

  // Save layout
  const saveLayout = useCallback(
    async (newLayout, name = null) => {
      setSaving(true)

      try {
        if (user) {
          // Save to Supabase
          const layoutData = {
            user_id: user.id,
            name: name || layout?.name || 'Default',
            layout: newLayout,
            updated_at: new Date().toISOString(),
          }

          // Check if updating existing or creating new
          const existingLayout = layouts.find((l) => l.name === layoutData.name)

          if (existingLayout) {
            const { error } = await supabase
              .from('dashboard_layouts')
              .update(layoutData)
              .eq('id', existingLayout.id)

            if (error && !error.message?.includes('does not exist')) {
              throw error
            }
          } else {
            layoutData.is_default = layouts.length === 0
            const { error } = await supabase.from('dashboard_layouts').insert(layoutData)

            if (error && !error.message?.includes('does not exist')) {
              throw error
            }
          }

          // Reload layouts
          await loadLayouts()
        } else {
          // Save to local storage
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayout))
        }

        setLayout(newLayout)
      } catch (err) {
        console.error('Error saving layout:', err)
      } finally {
        setSaving(false)
      }
    },
    [user, layout, layouts]
  )

  // Update widget position/size
  const updateWidget = useCallback(
    (widgetId, updates) => {
      if (!layout) return

      const newWidgets = layout.widgets.map((w) => (w.id === widgetId ? { ...w, ...updates } : w))

      const newLayout = { ...layout, widgets: newWidgets }
      setLayout(newLayout)
      saveLayout(newLayout)
    },
    [layout, saveLayout]
  )

  // Add widget
  const addWidget = useCallback(
    (widgetDef) => {
      if (!layout) return

      // Find a free position
      const newWidget = {
        id: widgetDef.id,
        x: 0,
        y: Math.max(...layout.widgets.map((w) => w.y + w.h), 0),
        w: widgetDef.defaultW,
        h: widgetDef.defaultH,
        config: widgetDef.defaultConfig || {},
      }

      const newLayout = {
        ...layout,
        widgets: [...layout.widgets, newWidget],
      }
      setLayout(newLayout)
      saveLayout(newLayout)
    },
    [layout, saveLayout]
  )

  // Remove widget
  const removeWidget = useCallback(
    (widgetId) => {
      if (!layout) return

      const newWidgets = layout.widgets.filter((w) => w.id !== widgetId)
      const newLayout = { ...layout, widgets: newWidgets }
      setLayout(newLayout)
      saveLayout(newLayout)
    },
    [layout, saveLayout]
  )

  // Update widget config
  const updateWidgetConfig = useCallback(
    (widgetId, configUpdates) => {
      if (!layout) return

      const newWidgets = layout.widgets.map((w) =>
        w.id === widgetId ? { ...w, config: { ...w.config, ...configUpdates } } : w
      )

      const newLayout = { ...layout, widgets: newWidgets }
      setLayout(newLayout)
      saveLayout(newLayout)
    },
    [layout, saveLayout]
  )

  // Reset to default
  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT)
    saveLayout(DEFAULT_LAYOUT)
  }, [saveLayout])

  // Switch to a different layout
  const switchLayout = useCallback(
    (layoutId) => {
      const target = layouts.find((l) => l.id === layoutId)
      if (target) {
        setLayout(target.layout)
      }
    },
    [layouts]
  )

  // Delete a layout
  const deleteLayout = useCallback(
    async (layoutId) => {
      if (!user) return

      try {
        const { error } = await supabase.from('dashboard_layouts').delete().eq('id', layoutId)

        if (error) {
          throw error
        }

        // Reload layouts
        await loadLayouts()
      } catch (err) {
        console.error('Error deleting layout:', err)
      }
    },
    [user]
  )

  return {
    layout,
    layouts,
    loading,
    saving,
    saveLayout,
    updateWidget,
    addWidget,
    removeWidget,
    updateWidgetConfig,
    resetLayout,
    switchLayout,
    deleteLayout,
  }
}

export default useDashboardLayout
