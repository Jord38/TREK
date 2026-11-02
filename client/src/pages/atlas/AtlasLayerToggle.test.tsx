import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../tests/helpers/render';
import type { TranslationFn } from '../../types';
import AtlasLayerToggle from './AtlasLayerToggle';

// FE-ATLAS-TOGGLE-001 to FE-ATLAS-TOGGLE-006

const t = ((key: string) => key) as TranslationFn;
const placeNames = { showPlaceNames: false, onTogglePlaceNames: vi.fn(), canShowPlaceNames: true };

describe('AtlasLayerToggle', () => {
  it('FE-ATLAS-TOGGLE-001: leaves the planned switch out while nothing is planned', () => {
    render(<AtlasLayerToggle t={t} showPlanned={false} onToggle={vi.fn()} plannedCount={0} {...placeNames} />);

    expect(screen.queryByRole('button', { name: 'atlas.showPlanned' })).not.toBeInTheDocument();
  });

  it('FE-ATLAS-TOGGLE-002: shows the label and how many countries the layer would add', () => {
    render(<AtlasLayerToggle t={t} showPlanned={false} onToggle={vi.fn()} plannedCount={4} {...placeNames} />);

    expect(screen.getByText('atlas.showPlanned')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'atlas.showPlanned' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('FE-ATLAS-TOGGLE-003: reports the flip and reflects the current state', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <AtlasLayerToggle t={t} showPlanned={false} onToggle={onToggle} plannedCount={4} {...placeNames} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'atlas.showPlanned' }));
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(<AtlasLayerToggle t={t} showPlanned onToggle={onToggle} plannedCount={4} {...placeNames} />);
    expect(screen.getByRole('button', { name: 'atlas.showPlanned' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('FE-ATLAS-TOGGLE-004: offers the place names switch even with nothing planned', () => {
    render(<AtlasLayerToggle t={t} showPlanned={false} onToggle={vi.fn()} plannedCount={0} {...placeNames} />);

    expect(screen.getByText('atlas.showPlaceNames')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'atlas.showPlaceNames' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('FE-ATLAS-TOGGLE-005: reports the place names flip and reflects the current state', () => {
    const onTogglePlaceNames = vi.fn();
    const { rerender } = render(
      <AtlasLayerToggle t={t} showPlanned={false} onToggle={vi.fn()} plannedCount={0} showPlaceNames={false} onTogglePlaceNames={onTogglePlaceNames} canShowPlaceNames />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'atlas.showPlaceNames' }));
    expect(onTogglePlaceNames).toHaveBeenCalledTimes(1);

    rerender(<AtlasLayerToggle t={t} showPlanned={false} onToggle={vi.fn()} plannedCount={0} showPlaceNames onTogglePlaceNames={onTogglePlaceNames} canShowPlaceNames />);
    expect(screen.getByRole('button', { name: 'atlas.showPlaceNames' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('FE-ATLAS-TOGGLE-006: leaves the place names switch out when the basemap cannot hide its labels', () => {
    render(<AtlasLayerToggle t={t} showPlanned={false} onToggle={vi.fn()} plannedCount={4} {...placeNames} canShowPlaceNames={false} />);

    expect(screen.queryByRole('button', { name: 'atlas.showPlaceNames' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'atlas.showPlanned' })).toBeInTheDocument();
  });
});
