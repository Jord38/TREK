import type { ListPreviewPlace } from '@trek/shared';

import type { useTranslation } from '../../i18n';
import { formatListDistance } from './formatListDistance';

type Translate = ReturnType<typeof useTranslation>['t'];

/** The line under a previewed place that says what it was matched with, or null when nothing was. */
export function matchReason(place: ListPreviewPlace, t: Translate, language: string): string | null {
  const { match, hint } = place;
  if (match) {
    if (match.distanceM === null) return t('places.listPreview.matchedLinked', { name: match.name });
    const distance = formatListDistance(match.distanceM, language);
    if (place.bucket === 'existing') return t('places.listPreview.matched', { name: match.name, distance });
    return t(match.reason === 'core-far' ? 'places.listPreview.sameNameFar' : 'places.listPreview.similar', {
      name: match.name,
      distance,
    });
  }
  if (hint) {
    return t(
      hint.kind === 'same-name-far'
        ? 'places.listPreview.hintSameNameFar'
        : hint.kind === 'similar-nearby'
          ? 'places.listPreview.hintSimilarNearby'
          : 'places.listPreview.hintNextTo',
      { name: hint.name, distance: formatListDistance(hint.distanceM, language) }
    );
  }
  return null;
}
