import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BasemapLayer } from '../../components/Map/VectorBasemap';
import { setLabelLayersVisible } from '../../components/Map/VectorBasemap';
import { useAtlasPlaceNames } from './useAtlasPlaceNames';

// FE-HOOK-ATLASNAMES-001 to FE-HOOK-ATLASNAMES-004

// Only the GL layer below can toggle its labels; anything else is the raster stand-in.
vi.mock('../../components/Map/VectorBasemap', () => ({
  setLabelLayersVisible: vi.fn((l: unknown) => l === layer),
}));

const layer = {} as BasemapLayer;

beforeEach(() => {
  localStorage.clear();
  vi.mocked(setLabelLayersVisible).mockClear();
});

describe('useAtlasPlaceNames', () => {
  it('FE-HOOK-ATLASNAMES-001: hands every flip to the basemap and keeps the ref current', () => {
    const { result } = renderHook(() => useAtlasPlaceNames({ current: layer }));
    expect(setLabelLayersVisible).toHaveBeenLastCalledWith(layer, false);

    act(() => result.current.togglePlaceNames());

    expect(setLabelLayersVisible).toHaveBeenLastCalledWith(layer, true);
    expect(result.current.showPlaceNamesRef.current).toBe(true);
  });

  it('FE-HOOK-ATLASNAMES-002: waits for the basemap when it is not loaded yet', () => {
    const { result } = renderHook(() => useAtlasPlaceNames({ current: null }));

    act(() => result.current.togglePlaceNames());

    expect(setLabelLayersVisible).not.toHaveBeenCalled();
    expect(result.current.showPlaceNamesRef.current).toBe(true);
  });

  it('FE-HOOK-ATLASNAMES-003: an attached GL basemap gets the current choice and enables the switch', () => {
    localStorage.setItem('trek_atlas_show_place_names', '1');
    const { result } = renderHook(() => useAtlasPlaceNames({ current: layer }));
    expect(result.current.canShowPlaceNames).toBe(false);
    vi.mocked(setLabelLayersVisible).mockClear();

    act(() => result.current.onBasemapAttached());

    expect(setLabelLayersVisible).toHaveBeenCalledWith(layer, true);
    expect(result.current.canShowPlaceNames).toBe(true);
  });

  it('FE-HOOK-ATLASNAMES-004: the raster stand-in keeps the switch away, its tiles carry their labels', () => {
    const raster = {} as BasemapLayer;
    const { result } = renderHook(() => useAtlasPlaceNames({ current: raster }));

    act(() => result.current.onBasemapAttached());

    expect(result.current.canShowPlaceNames).toBe(false);
  });
});
