/**
 * ThreatsTab Component
 *
 * Dashboard tab showing threat actor information:
 * - Top actors
 * - Sector distribution
 * - Sector drilldown
 * - Kill chain mini
 * - Threat gauge
 */
import { Link } from 'react-router-dom'
import {
  TopActors,
  SectorChart,
  SectorDrilldown,
  KillChainMini,
  ThreatGauge,
} from '../../../components'

export default function ThreatsTab({
  topActors,
  sectorData,
  sectorDetails,
  widgetsLoading,
  userProfile,
  threatLevel,
}) {
  return (
    <div className="space-y-6">
      {/* Threat Level + Sectors Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Threat Level Gauge */}
        <ThreatGauge
          score={threatLevel}
          trend={threatLevel > 60 ? 'up' : 'stable'}
        />

        {/* Sector Distribution */}
        <div className="cyber-card sm:col-span-2">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">Targeted Sectors</h2>
          <SectorChart data={sectorData} height={200} />
        </div>

        {/* Top Actors */}
        <div className="cyber-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400">Top Actors</h2>
            <Link to="/actors" className="text-cyber-accent text-xs hover:underline">
              View all
            </Link>
          </div>
          <TopActors actors={topActors} />
        </div>
      </div>

      {/* Sector Drilldown */}
      <SectorDrilldown
        sectors={sectorDetails}
        loading={widgetsLoading}
        userSector={userProfile?.sector}
        onSectorClick={(sector) => console.log('Sector clicked:', sector.name)}
      />

      {/* Kill Chain Overview */}
      <KillChainMini onViewFull={() => console.log('View full kill chain')} />
    </div>
  )
}
