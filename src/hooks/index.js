// Hooks barrel export

// Authentication & User
export { useAuth } from './useAuth'
export { useOnlineStatus } from './useOnlineStatus'
export { useKeyboardShortcuts } from './useKeyboardShortcuts'
export { default as useAnalytics } from './useAnalytics'
export { useLastVisit } from './useLastVisit'
export { useFocusMode, FocusModeProvider } from './useFocusMode.jsx'
export { useDashboardLayout } from './useDashboardLayout'

// Filter State Management
export { useFilters, useSearchFilter, useDateRangeFilter } from './useFilters'

// Data Loading
export { useDataLoading, usePaginatedData, useInfiniteData } from './useDataLoading'

// Table State Management
export { useTableState, useTableKeyboard, useColumnResize } from './useTableState'
