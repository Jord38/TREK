import { readEnv } from './env';
import { imageBuild } from './image-version';

/**
 * The running TREK version: the image's VERSION file or APP_VERSION (both behind
 * `readEnv().app.appVersion`), else server/package.json. The websocket welcome
 * frame and the plugin host-compatibility checks both announce it, so it lives
 * here rather than inside either domain.
 */
export function runningVersion(): string {
  return readEnv().app.appVersion || (require('../../package.json') as { version: string }).version;
}

/**
 * The build name of this image, announced next to the version so clients can tell
 * two builds of the same version apart. `runningVersion()` stays the version
 * plugins and issuers bind to; this never feeds a compatibility check.
 */
export function runningBuild(): string | null {
  return imageBuild();
}
