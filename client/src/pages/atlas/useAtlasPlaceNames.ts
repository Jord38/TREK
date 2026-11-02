import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { setLabelLayersVisible, type BasemapLayer } from '../../components/Map/VectorBasemap';
import { useStoredToggle } from '../../hooks/useStoredToggle';

const PLACE_NAMES_KEY = 'trek_atlas_show_place_names';

/**
 * The atlas's place names switch: the basemap labels, off by default because the
 * atlas is about the country fills. Only offered on a GL basemap: the raster
 * stand-in has its labels baked into the tiles. The ref is for code that runs
 * outside a render, such as the restyle on a theme switch.
 */
export function useAtlasPlaceNames(glLayerRef: MutableRefObject<BasemapLayer | null>) {
  const [showPlaceNames, togglePlaceNames] = useStoredToggle(PLACE_NAMES_KEY);
  const [canShowPlaceNames, setCanShowPlaceNames] = useState(false);
  const showPlaceNamesRef = useRef(showPlaceNames);

  useEffect(() => {
    showPlaceNamesRef.current = showPlaceNames;
    if (glLayerRef.current) setLabelLayersVisible(glLayerRef.current, showPlaceNames);
  }, [glLayerRef, showPlaceNames]);

  const onBasemapAttached = useCallback(() => {
    const layer = glLayerRef.current;
    setCanShowPlaceNames(!!layer && setLabelLayersVisible(layer, showPlaceNamesRef.current));
  }, [glLayerRef]);

  return { showPlaceNames, togglePlaceNames, showPlaceNamesRef, canShowPlaceNames, onBasemapAttached };
}
