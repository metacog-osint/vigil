/**
 * Components Barrel Export
 *
 * Re-exports all components from organized subdirectories.
 * Maintains backward compatibility with existing imports.
 *
 * Directory structure:
 * - common/: Shared UI components (EmptyState, ErrorBoundary, Skeleton, etc.)
 * - badges/: Status indicators (TrendBadge, SeverityBadge, etc.)
 * - charts/: Data visualizations (ActivityChart, SectorChart, etc.)
 * - panels/: Detail panels (CorrelationPanel, EnrichmentPanel, etc.)
 * - widgets/: Dashboard widgets (TopActors, RecentIncidents, etc.)
 * - settings/: Settings page components
 */

// ============================================
// COMMON UI COMPONENTS
// ============================================
export {
  EmptyState,
  ErrorBoundary,
  Skeleton,
  SkeletonDashboard,
  Sparkline,
  StatCard,
  TimeDisplay,
  TimeAgo,
  formatRelativeTime,
  formatAbsoluteTime,
  Tooltip,
} from './common'

// Additional exports from EmptyState
export {
  EmptyIncidents,
  EmptyActors,
  EmptyVulnerabilities,
  EmptyIOCs,
  EmptySearch,
} from './common/EmptyState'

// Additional exports from ErrorBoundary
export { ErrorFallback, ErrorMessage } from './common/ErrorBoundary'

// Additional exports from Skeleton
export {
  SkeletonLine,
  SkeletonCard,
  SkeletonTable,
  SkeletonStats,
  SkeletonList,
} from './common/Skeleton'

// Additional exports from TimeDisplay
export {
  SmartTime,
  DateBadge,
  FullDate,
  Timestamp,
  smartFormatDate,
} from './common/TimeDisplay'

// Additional exports from Sparkline
export { SparklineBar } from './common/Sparkline'

// ============================================
// BADGE COMPONENTS
// ============================================
export {
  TrendBadge,
  SeverityBadge,
  EventTypeBadge,
  NewIndicator,
  RelevanceBadge,
} from './badges'

// Additional exports from TrendBadge
export { TrendIndicator } from './badges/TrendBadge'

// Additional exports from SeverityBadge
export {
  SeverityDot,
  SeverityBar,
  EPSSBadge,
  classifyBySeverity,
} from './badges/SeverityBadge'

// Additional exports from NewIndicator
export {
  NewBadge,
  NewDot,
  isNew,
} from './badges/NewIndicator'

// Additional exports from RelevanceBadge
export { RelevanceIndicator, RelevancePanel } from './badges/RelevanceBadge'

// ============================================
// CHART COMPONENTS
// ============================================
export {
  ActivityCalendar,
  ActivityChart,
  AttackMatrixHeatmap,
  CalendarHeatmap,
  SectorChart,
  SectorTrendChart,
  ThreatGauge,
  VulnerabilityTreemap,
  VulnTreemap,
  ActorTrajectoryChart,
} from './charts'

// Additional exports from ThreatGauge
export { ThreatGaugeMini, calculateThreatScore } from './charts/ThreatGauge'

// Additional exports from ActivityCalendar
export { ActivityCalendarMini } from './charts/ActivityCalendar'

// Additional exports from SectorChart
export { SectorBarChart } from './charts/SectorChart'

// Additional exports from AttackMatrixHeatmap
export { AttackMatrixMini } from './charts/AttackMatrixHeatmap'

// Additional exports from VulnTreemap
export { VulnTreemapMini } from './charts/VulnTreemap'

// Additional exports from ActorTrajectoryChart
export { ActorTrajectoryMini, ActorSelector } from './charts/ActorTrajectoryChart'

// Additional exports from SectorTrendChart
export {
  SectorTrendMini,
  ActivityTrendChart,
  ActivityTrendMini,
} from './charts/SectorTrendChart'

// ============================================
// PANEL COMPONENTS
// ============================================
export {
  CorrelationPanel,
  DataSourcesPanel,
  EnrichmentPanel,
  EventDetailPanel,
  SectorDrilldown,
  CountryAttackPanel,
  ActorQuickProfile,
  ActorRelationshipGraph,
  AttackPathDiagram,
} from './panels'

// Additional exports from AttackPathDiagram
export { AttackPathMini } from './panels/AttackPathDiagram'

// ============================================
// WIDGET COMPONENTS
// ============================================
export {
  ActiveExploitationWidget,
  ChangeSummaryCard,
  IOCQuickLookupCard,
  TargetedServicesWidget,
  ThreatHuntCard,
  WeekComparisonCard,
  TopActors,
  RecentIncidents,
} from './widgets'

// ============================================
// SETTINGS COMPONENTS
// ============================================
export {
  AlertRulesSection,
  ApiKeysSection,
  BrandingConfigSection,
  IntegrationsSection,
  SecuritySettings,
  SSOConfigSection,
  TeamManagement,
} from './settings'

// ============================================
// REMAINING ROOT-LEVEL COMPONENTS
// ============================================
export { default as Sidebar } from './Sidebar'
export { default as Header } from './Header'
export { default as SearchModal } from './SearchModal'
export { default as OrganizationProfileSetup } from './OrganizationProfileSetup'
export { default as PersonalizationWizard } from './PersonalizationWizard'
export { default as AnalyticsDashboard } from './AnalyticsDashboard'
export { default as NotificationBell } from './NotificationBell'
export { default as OnboardingTour } from './OnboardingTour'
export { default as SavedSearches } from './SavedSearches'
export { default as UpgradePrompt } from './UpgradePrompt'
export { default as KillChainVisualization } from './KillChainVisualization'
export { default as ThreatAttributionMap } from './ThreatAttributionMap'
export { default as Timeline } from './Timeline'
export { default as IncidentFlow } from './IncidentFlow'

// Additional exports from Timeline
export { TimelineMini, ActorTimeline } from './Timeline'

// Additional exports from IncidentFlow
export { IncidentFlowSimple, AttackChain } from './IncidentFlow'

// User features
export { WatchButton } from './WatchButton'
export { TagSelector, TagBadges } from './TagSelector'

// Export functionality
export { ExportButton, QuickExportButton } from './ExportButton'

// Keyboard shortcuts
export { KeyboardShortcutsModal, useKeyboardShortcutsModal } from './KeyboardShortcutsModal'

// Alert and Report builders
export { default as AlertRuleBuilder, createCondition, createGroup, FIELD_OPTIONS, OPERATORS } from './AlertRuleBuilder'
export { default as ReportBuilder, SECTION_TYPES, DATA_SOURCES, CHART_TYPES } from './ReportBuilder'

// Entity analysis
export { default as EntityThreatSummary, generateSummary, generateRecommendations } from './EntityThreatSummary'
export {
  default as ScoringExplanation,
  ScoreGauge,
  FactorBar,
  ContributionChart,
  ScoreBreakdownCard,
  WeightEditor,
  SCORE_LEVELS,
  FACTOR_LABELS,
  getScoreColors,
} from './ScoringExplanation'

// Investigation Notebook
export {
  default as InvestigationNotebook,
  ActivityItem,
  ChecklistItem,
  CommentItem,
  LinkedEntity,
  ACTIVITY_TYPES,
  PRIORITIES,
} from './InvestigationNotebook'

// IOC Correlation Graph
export {
  default as IOCCorrelationGraph,
  NODE_TYPES,
  IOC_SUBTYPES,
  EDGE_TYPES,
  forceDirectedLayout,
} from './IOCCorrelationGraph'

// Entity Relationship Graph
export {
  default as EntityRelationshipGraph,
  ENTITY_CONFIGS,
  RELATIONSHIP_TYPES,
  circularLayout,
  hierarchicalLayout,
} from './EntityRelationshipGraph'

// Bulk IOC Import
export {
  default as BulkIOCImport,
  parseIOCInput,
  detectIOCType,
  IOC_PATTERNS,
} from './BulkIOCImport'

// Alert Analytics Dashboard
export {
  default as AlertAnalyticsDashboard,
  MetricCard,
  ChannelEffectivenessChart,
  AlertFatigueIndicator,
  ResponseTimeChart,
  NoisyRulesTable,
  AlertVolumeTrend,
} from './AlertAnalyticsDashboard'
