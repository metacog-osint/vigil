/**
 * Widget Registry
 *
 * Defines available dashboard widgets and their configurations.
 */

export const WIDGET_TYPES = {
  BLUF: 'bluf',
  PRIORITIES: 'priorities',
  ESCALATING: 'escalating',
  STATS: 'stats',
  ACTIVITY_CHART: 'activity-chart',
  TOP_ACTORS: 'top-actors',
  SECTOR_CHART: 'sector-chart',
  CALENDAR: 'calendar',
  MAP: 'map',
  KEVS: 'kevs',
  INCIDENTS: 'incidents',
  WHATS_NEW: 'whats-new',
  COMPARISON: 'comparison',
}

/**
 * Widget definitions with metadata and default configs
 */
export const WIDGETS = {
  [WIDGET_TYPES.BLUF]: {
    id: WIDGET_TYPES.BLUF,
    name: 'AI Summary',
    description: 'AI-generated executive summary of current threat landscape',
    icon: 'sparkles',
    category: 'overview',
    minW: 4,
    minH: 2,
    defaultW: 12,
    defaultH: 2,
    defaultConfig: {
      autoRefresh: true,
      refreshInterval: 3600, // 1 hour
    },
    configOptions: [
      { key: 'autoRefresh', label: 'Auto refresh', type: 'boolean' },
    ],
  },

  [WIDGET_TYPES.PRIORITIES]: {
    id: WIDGET_TYPES.PRIORITIES,
    name: 'Priorities for You',
    description: 'Threats and vulnerabilities relevant to your organization',
    icon: 'target',
    category: 'personalized',
    minW: 4,
    minH: 3,
    defaultW: 6,
    defaultH: 4,
    requiresProfile: true,
    defaultConfig: {
      actorCount: 3,
      vulnCount: 3,
    },
    configOptions: [
      { key: 'actorCount', label: 'Actors to show', type: 'number', min: 1, max: 10 },
      { key: 'vulnCount', label: 'CVEs to show', type: 'number', min: 1, max: 10 },
    ],
  },

  [WIDGET_TYPES.ESCALATING]: {
    id: WIDGET_TYPES.ESCALATING,
    name: 'Escalating Actors',
    description: 'Threat actors with increasing activity',
    icon: 'trending-up',
    category: 'threats',
    minW: 3,
    minH: 3,
    defaultW: 6,
    defaultH: 4,
    defaultConfig: {
      count: 5,
      threshold: 25, // % increase
    },
    configOptions: [
      { key: 'count', label: 'Number of actors', type: 'number', min: 3, max: 10 },
      { key: 'threshold', label: 'Escalation threshold %', type: 'number', min: 10, max: 100 },
    ],
  },

  [WIDGET_TYPES.STATS]: {
    id: WIDGET_TYPES.STATS,
    name: 'Stats Row',
    description: 'Key metrics at a glance',
    icon: 'chart-bar',
    category: 'overview',
    minW: 6,
    minH: 1,
    defaultW: 12,
    defaultH: 1,
    defaultConfig: {
      metrics: ['incidents_7d', 'actors', 'kevs', 'iocs', 'watchlist'],
    },
    configOptions: [
      {
        key: 'metrics',
        label: 'Metrics to show',
        type: 'multiselect',
        options: [
          { value: 'incidents_7d', label: 'Incidents (7d)' },
          { value: 'actors', label: 'Total Actors' },
          { value: 'kevs', label: 'Active KEVs' },
          { value: 'iocs', label: 'IOCs' },
          { value: 'watchlist', label: 'Watchlist Items' },
        ],
      },
    ],
  },

  [WIDGET_TYPES.ACTIVITY_CHART]: {
    id: WIDGET_TYPES.ACTIVITY_CHART,
    name: 'Activity Chart',
    description: 'Incident activity over time',
    icon: 'chart-line',
    category: 'analytics',
    minW: 4,
    minH: 3,
    defaultW: 8,
    defaultH: 4,
    defaultConfig: {
      days: 30,
      chartType: 'area',
    },
    configOptions: [
      { key: 'days', label: 'Time range (days)', type: 'number', min: 7, max: 90 },
      {
        key: 'chartType',
        label: 'Chart type',
        type: 'select',
        options: [
          { value: 'area', label: 'Area' },
          { value: 'bar', label: 'Bar' },
          { value: 'line', label: 'Line' },
        ],
      },
    ],
  },

  [WIDGET_TYPES.TOP_ACTORS]: {
    id: WIDGET_TYPES.TOP_ACTORS,
    name: 'Top Actors',
    description: 'Most active threat actors',
    icon: 'users',
    category: 'threats',
    minW: 3,
    minH: 3,
    defaultW: 4,
    defaultH: 4,
    defaultConfig: {
      count: 5,
      timeRange: 7,
    },
    configOptions: [
      { key: 'count', label: 'Number of actors', type: 'number', min: 3, max: 15 },
      { key: 'timeRange', label: 'Time range (days)', type: 'number', min: 7, max: 30 },
    ],
  },

  [WIDGET_TYPES.SECTOR_CHART]: {
    id: WIDGET_TYPES.SECTOR_CHART,
    name: 'Sector Distribution',
    description: 'Incidents by sector',
    icon: 'pie-chart',
    category: 'analytics',
    minW: 3,
    minH: 3,
    defaultW: 4,
    defaultH: 4,
    defaultConfig: {
      chartType: 'pie',
    },
    configOptions: [
      {
        key: 'chartType',
        label: 'Chart type',
        type: 'select',
        options: [
          { value: 'pie', label: 'Pie' },
          { value: 'donut', label: 'Donut' },
          { value: 'bar', label: 'Bar' },
        ],
      },
    ],
  },

  [WIDGET_TYPES.CALENDAR]: {
    id: WIDGET_TYPES.CALENDAR,
    name: 'Activity Calendar',
    description: 'Heatmap of daily activity',
    icon: 'calendar',
    category: 'analytics',
    minW: 4,
    minH: 2,
    defaultW: 6,
    defaultH: 3,
    defaultConfig: {
      days: 90,
    },
    configOptions: [
      { key: 'days', label: 'Days to show', type: 'number', min: 30, max: 365 },
    ],
  },

  [WIDGET_TYPES.MAP]: {
    id: WIDGET_TYPES.MAP,
    name: 'Threat Map',
    description: 'Geographic distribution of threats',
    icon: 'globe',
    category: 'analytics',
    minW: 4,
    minH: 3,
    defaultW: 6,
    defaultH: 4,
    defaultConfig: {
      view: 'world',
      showAttribution: true,
    },
    configOptions: [
      {
        key: 'view',
        label: 'Default view',
        type: 'select',
        options: [
          { value: 'world', label: 'World' },
          { value: 'north_america', label: 'North America' },
          { value: 'europe', label: 'Europe' },
          { value: 'asia', label: 'Asia' },
        ],
      },
      { key: 'showAttribution', label: 'Show attribution data', type: 'boolean' },
    ],
  },

  [WIDGET_TYPES.KEVS]: {
    id: WIDGET_TYPES.KEVS,
    name: 'Recent KEVs',
    description: 'Latest known exploited vulnerabilities',
    icon: 'shield-exclamation',
    category: 'vulnerabilities',
    minW: 3,
    minH: 3,
    defaultW: 4,
    defaultH: 4,
    defaultConfig: {
      count: 5,
      severityFilter: null,
    },
    configOptions: [
      { key: 'count', label: 'Number to show', type: 'number', min: 3, max: 15 },
      {
        key: 'severityFilter',
        label: 'Minimum severity',
        type: 'select',
        options: [
          { value: null, label: 'All' },
          { value: 'CRITICAL', label: 'Critical' },
          { value: 'HIGH', label: 'High+' },
          { value: 'MEDIUM', label: 'Medium+' },
        ],
      },
    ],
  },

  [WIDGET_TYPES.INCIDENTS]: {
    id: WIDGET_TYPES.INCIDENTS,
    name: 'Recent Incidents',
    description: 'Latest ransomware incidents',
    icon: 'fire',
    category: 'incidents',
    minW: 4,
    minH: 3,
    defaultW: 6,
    defaultH: 4,
    defaultConfig: {
      count: 5,
      sectorFilter: null,
    },
    configOptions: [
      { key: 'count', label: 'Number to show', type: 'number', min: 3, max: 15 },
      {
        key: 'sectorFilter',
        label: 'Sector filter',
        type: 'select',
        options: [
          { value: null, label: 'All sectors' },
          { value: 'healthcare', label: 'Healthcare' },
          { value: 'finance', label: 'Finance' },
          { value: 'technology', label: 'Technology' },
          { value: 'government', label: 'Government' },
        ],
      },
    ],
  },

  [WIDGET_TYPES.WHATS_NEW]: {
    id: WIDGET_TYPES.WHATS_NEW,
    name: "What's New",
    description: 'New items since your last visit',
    icon: 'bell',
    category: 'personalized',
    minW: 3,
    minH: 2,
    defaultW: 4,
    defaultH: 3,
    defaultConfig: {
      categories: ['incidents', 'actors', 'kevs', 'iocs'],
    },
    configOptions: [
      {
        key: 'categories',
        label: 'Categories to track',
        type: 'multiselect',
        options: [
          { value: 'incidents', label: 'Incidents' },
          { value: 'actors', label: 'Actors' },
          { value: 'kevs', label: 'KEVs' },
          { value: 'iocs', label: 'IOCs' },
        ],
      },
    ],
  },

  [WIDGET_TYPES.COMPARISON]: {
    id: WIDGET_TYPES.COMPARISON,
    name: 'Week Comparison',
    description: 'Compare current week to previous',
    icon: 'scale',
    category: 'analytics',
    minW: 3,
    minH: 2,
    defaultW: 6,
    defaultH: 3,
    defaultConfig: {},
    configOptions: [],
  },
}

/**
 * Widget categories for organization
 */
export const WIDGET_CATEGORIES = {
  overview: { name: 'Overview', icon: 'home' },
  personalized: { name: 'Personalized', icon: 'user' },
  threats: { name: 'Threats', icon: 'shield' },
  vulnerabilities: { name: 'Vulnerabilities', icon: 'bug' },
  incidents: { name: 'Incidents', icon: 'fire' },
  analytics: { name: 'Analytics', icon: 'chart' },
}

/**
 * Default dashboard layout
 */
export const DEFAULT_LAYOUT = {
  name: 'Default',
  widgets: [
    { id: WIDGET_TYPES.BLUF, x: 0, y: 0, w: 12, h: 2, config: {} },
    { id: WIDGET_TYPES.PRIORITIES, x: 0, y: 2, w: 6, h: 4, config: {} },
    { id: WIDGET_TYPES.ESCALATING, x: 6, y: 2, w: 6, h: 4, config: {} },
    { id: WIDGET_TYPES.STATS, x: 0, y: 6, w: 12, h: 1, config: {} },
    { id: WIDGET_TYPES.ACTIVITY_CHART, x: 0, y: 7, w: 8, h: 4, config: {} },
    { id: WIDGET_TYPES.TOP_ACTORS, x: 8, y: 7, w: 4, h: 4, config: {} },
  ],
}

/**
 * Get widget definition by ID
 */
export function getWidgetById(id) {
  return WIDGETS[id] || null
}

/**
 * Get widgets by category
 */
export function getWidgetsByCategory(category) {
  return Object.values(WIDGETS).filter((w) => w.category === category)
}

/**
 * Get all available widgets
 */
export function getAllWidgets() {
  return Object.values(WIDGETS)
}

export default {
  WIDGET_TYPES,
  WIDGETS,
  WIDGET_CATEGORIES,
  DEFAULT_LAYOUT,
  getWidgetById,
  getWidgetsByCategory,
  getAllWidgets,
}
