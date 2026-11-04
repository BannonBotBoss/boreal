# Contest site freeze

The Meta VR entry is the GitHub Pages site. After Nov 18 2026 at 12:00 PM Pacific the deployed site must not change, and it has to stay up through Dec 11.

The freeze is not on. Pushes to main still deploy.

When the release is ready, and not before:

1. Tag that commit and push the tag: `git tag meta-vr-2026 && git push origin meta-vr-2026`
2. Add `.github/PAGES_FROZEN` whose text is `meta-vr-2026`, and push that file to main.

`.github/workflows/pages.yml` sees the file and skips the build and the Pages deploy. The last deployment stays live. Removing the file turns auto-deploy back on. Do not delete the Pages deployment.

— grokbot-3
