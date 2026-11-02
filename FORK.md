# Jord's TREK fork

Runs trek.jord.cloud. Upstream: https://github.com/liketrek/TREK

## Branches

- `main`: mirror of upstream `main`, never committed to.
- `jord`: the upstream release we run (a `vX.Y.Z` tag) plus our changes. Every
  push builds `ghcr.io/jord38/trek:<version>-jord.<run>` (.github/workflows/jord-image.yml).
- `feat/*`: one change each, based on the release tag; merged into `jord`, and
  rebased onto upstream `dev` when it goes upstream as a PR (pitch it in their
  Discord `#github-pr` first).

## Taking a new upstream release

    git fetch upstream --tags
    git switch jord && git merge vX.Y.Z
    # run the client and shared tests, then push; the workflow builds the image

Then set the new tag in the instance's docker-compose.yml.

## Our changes

- Atlas: "Show place names" switch (desktop and mobile), off by default,
  remembered per browser.
- Welcome: new users get a pop-up with the intro video on their first login.
  The video is not in git or the image: the instance mounts a folder at
  `/app/server/public/media` (read-only) holding `trek-intro.mp4`.
