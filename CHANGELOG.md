# Changelog

All notable changes to dj-card-preview.

## Unreleased

- **Docs:** demo notes clarified (overlay CSS in the demo is reconstructed;
  production overlay CSS was never published)

## 1.0.0 - 2026-09-28

- Initial public release: `src/dj-card-preview.js` - production-verbatim hover
  preview system: iTunes Search live lookup, Web Audio analyser (fftSize 64,
  smoothing 0.8) driving 8 canvas EQ bars, generation-counter race guard,
  touch click-toggle, reduced-motion/hover:none no-states, MediaSession,
  document.title swap
- GitHub Pages demo enabled (single-card David Guetta demo)
- Known autoplay-gate behavior documented: browsers require a first user
  gesture before audio - hover alone cannot start playback until then
