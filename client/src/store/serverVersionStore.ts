import { create } from 'zustand'
import { asReleaseTag } from '../utils/versionHandover'

/**
 * The version the server says it runs: first from the app config at launch,
 * then from its realtime socket on every (re)connect. A deploy restarts the
 * server, so a client that stayed open across one reconnects and learns the
 * new version here (NewVersionNotice).
 */
interface ServerVersionState {
  /** The first version this page heard of. A different build at that point is the launch handover's to fix. */
  first: string | null
  /** The last version the server reported, or null before its first report. */
  reported: string | null
  /** The fork build name that came with `first`, or null when the server has none. */
  firstBuild: string | null
  /** The fork build name that came with `reported`, or null when the server has none. */
  reportedBuild: string | null
  /** Takes a reported version and its build name; anything but a release tag is ignored. */
  note: (value: unknown, build?: unknown) => void
}

export const useServerVersionStore = create<ServerVersionState>()((set, get) => ({
  first: null,
  reported: null,
  firstBuild: null,
  reportedBuild: null,
  note(value, buildValue) {
    const version = asReleaseTag(value)
    if (!version) return
    const build = asReleaseTag(buildValue)
    const { reported, reportedBuild, first, firstBuild } = get()
    if (version === reported && build === reportedBuild) return
    set({
      reported: version,
      reportedBuild: build,
      first: first ?? version,
      firstBuild: first === null ? build : firstBuild,
    })
  },
}))
