# dj-card-preview

![License](https://img.shields.io/badge/license-MIT-00d2ff?style=flat)
![Dependencies](https://img.shields.io/badge/dependencies-0-00d2ff?style=flat)
![Audio](https://img.shields.io/badge/audio-iTunes%20previews-00d2ff?style=flat)
![EQ](https://img.shields.io/badge/EQ-real%20Web%20Audio%20frequencies-00d2ff?style=flat)

**[Try it live](https://bryanhamiltondev.github.io/dj-card-preview/)** - hover the card and David Guetta actually plays.

The homepage hover preview from [The DJ Calendar](https://thedjcalendar.com),
extracted as a standalone, open-source widget. Roll over an artist photo and
a 30-second iTunes preview starts playing - while an 8-bar EQ, drawn on
canvas, reacts to the audio's *actual frequencies* via the Web Audio API.
A black overlay fades in: "You are now listening to:" and the track name.
Roll off, and everything stops.

This is not an animation pretending to be sound. `createMediaElementSource`
feeds a real analyser (`fftSize 64`, smoothing 0.8), and each of the eight
bars reads its own frequency bin every frame. The code is extracted verbatim
from production, where it runs on all 99 artist cards.

## The contract (markup)

The widget binds itself to a grid - `#djGrid` or any `.genre-artists-grid` -
and expects each card to look like this:

```html
<a class="dj-card" href="/artist-slug/"
   data-id="davidguetta"
   data-name="David Guetta"
   data-image="https://.../artist.jpg"
   data-preview-url="https://audio-ssl.itunes.apple.com/...m4a"  <!-- optional cache -->
   data-preview-title="Titanium (feat. Sia)">                     <!-- optional cache -->
  <span class="card-image">
    <img class="card-image-photo" src="..." alt="...">
    <span class="card-image-overlay">
      <span class="card-overlay-label">You are now listening to:</span>
      <span class="card-overlay-track"></span>
    </span>
    <canvas class="waveform-canvas" width="280" height="40"></canvas>
  </span>
  <span class="dj-card-name">David Guetta</span>
</a>
```

If a card has no cached `data-preview-url`, the widget looks the track up
live against the iTunes Search API (`entity=musicTrack`, limit 12), takes
the first result with a preview, and caches it on the card for next time.

## The "no" states (this is the design)

Most hover-preview widgets fail loudly on the devices where hover doesn't
exist. This one treats every "no" as a first-class answer:

- **Touch devices** (`hover: none, pointer: coarse`): hover preview never
  fires. Instead, a tap on the photo toggles play/stop - and the tap is
  also the user gesture, so autoplay policy is satisfied by design.
- **Reduced motion** (`prefers-reduced-motion: reduce`): no hover preview
  at all. Motion-reactive feedback is exactly what these visitors asked
  the OS to skip.
- **A conflicting audio session** (the site's favorites player): card
  previews stand down and resume it when done.
- **No preview found**: the card is marked `data-preview-miss` and silently
  skipped forever - no repeated failing lookups on every hover.

## The race-condition guard

Sweep your cursor across a row of cards fast and three things race: the
audio load, the canvas draw loop, and your mouse leaving. Every card carries
a generation counter (`_djcPreviewGen`); any stale async callback checks its
generation before touching the DOM or the audio, and a new hover bumps the
counter, orphaning everything the previous hover started.

## When audio needs permission

Browsers only allow audible audio after a user gesture. On the production
site the visitor has almost always clicked something first, so hover just
works. The demo says it plainly: **click the page once, then hover.** On
touch, the tap itself is the gesture.

## Extras that come free

- While a preview plays, the document title becomes `Artist - Track` and
  restores when it stops.
- `navigator.mediaSession` gets real metadata - the track shows up in the
  OS media controls with artwork (via the site's image proxy in production;
  gracefully absent without it).
- The audio element is `crossOrigin: anonymous`, which is what makes the
  analyser legal on cross-origin preview files.

## Demo note

The hosted demo (at this repo's Pages root, also under `/demo/`) hardcodes
one cached preview URL (David Guetta, "Titanium (feat. Sia)") so it always
works with zero backend. Production does the live lookup for 99 artists;
the demo shows the cached path, which is also the path production hits
after a card's first hover.

## Requirements

Any browser from the last decade with Web Audio support. No build step,
no framework, no dependencies.

## Origin

Extracted from The DJ Calendar (https://thedjcalendar.com), where hovering
any of the 99 homepage artist cards previews their music. Like everything
published under this account, it is a production-derived pattern: what
ships here is the idea, not the infrastructure.

Sibling repos: [eq-visualizer](https://github.com/bryanhamiltondev/eq-visualizer)
(the decorative pure-CSS EQ) and [next-show-radar](https://github.com/bryanhamiltondev/next-show-radar)
(the consent-first tour map).

## License

MIT
