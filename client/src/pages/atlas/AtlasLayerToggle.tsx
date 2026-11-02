import React from 'react'
import ToggleSwitch from '../../components/Settings/ToggleSwitch'
import type { TranslationFn } from '../../types'

interface AtlasLayerToggleProps {
  t: TranslationFn
  showPlanned: boolean
  onToggle: () => void
  plannedCount: number
  showPlaceNames: boolean
  onTogglePlaceNames: () => void
  canShowPlaceNames: boolean
}

const PILL_STYLE: React.CSSProperties = {
  padding: '8px 14px',
  background: 'var(--bg-elevated)',
  boxShadow: 'var(--shadow-popover)',
  backdropFilter: 'blur(18px) saturate(180%)',
  WebkitBackdropFilter: 'blur(18px) saturate(180%)',
}

// Floating switches over the globe: the basemap's place names, and the countries you
// only plan to visit (#1048). Place names need a GL basemap; the planned one is left
// out while there is nothing planned — an always-present control for an empty set is just clutter. Sits on the
// desktop map only; the mobile atlas has its own compact toggles in MAtlas.
export default function AtlasLayerToggle({
  t, showPlanned, onToggle, plannedCount, showPlaceNames, onTogglePlaceNames, canShowPlaceNames,
}: AtlasLayerToggleProps): React.ReactElement {
  return (
    <div
      className="absolute z-20 hidden md:flex flex-col items-end gap-2"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 14px)', right: 18 }}
    >
      {plannedCount > 0 && (
        <div className="flex items-center gap-3 rounded-full border border-edge" style={PILL_STYLE}>
          <span className="text-caption font-semibold text-content whitespace-nowrap">
            {t('atlas.showPlanned')}
          </span>
          <span className="text-caption font-bold tabular-nums text-content-muted">{plannedCount}</span>
          <ToggleSwitch on={showPlanned} onToggle={onToggle} label={t('atlas.showPlanned')} />
        </div>
      )}
      {canShowPlaceNames && (
        <div className="flex items-center gap-3 rounded-full border border-edge" style={PILL_STYLE}>
          <span className="text-caption font-semibold text-content whitespace-nowrap">
            {t('atlas.showPlaceNames')}
          </span>
          <ToggleSwitch on={showPlaceNames} onToggle={onTogglePlaceNames} label={t('atlas.showPlaceNames')} />
        </div>
      )}
    </div>
  )
}
