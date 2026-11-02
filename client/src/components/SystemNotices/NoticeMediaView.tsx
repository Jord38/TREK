import React from 'react';
import type { SystemNoticeDTO } from '../../store/systemNoticeStore.js';

type NoticeMedia = NonNullable<SystemNoticeDTO['media']>;

interface NoticeMediaViewProps {
  media: NoticeMedia;
  isDark: boolean;
  label: string;
  /** The hero image is the first thing the notice shows, so it loads first. */
  hero?: boolean;
}

// A video waits for the reader to press play: a notice that starts talking on
// its own would ambush whoever just signed in.
export function NoticeMediaView({ media, isDark, label, hero = false }: NoticeMediaViewProps): React.ReactElement {
  const src = isDark && media.srcDark ? media.srcDark : media.src;
  if (media.kind === 'video') {
    return (
      <video
        src={src}
        aria-label={label}
        controls
        playsInline
        preload="metadata"
        className="h-full w-full object-contain"
      />
    );
  }
  return (
    <img
      src={src}
      alt={label}
      className="h-full w-full object-cover"
      fetchPriority={hero ? 'high' : undefined}
      decoding="async"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}
