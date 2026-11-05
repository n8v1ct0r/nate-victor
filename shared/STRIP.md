# Shared honesty strip (all 6 prototypes)

One visual signature across every sidequest, and the on-screen data label the brief requires.

- A 32px bar fixed to the top of the viewport (or the top of the embed). It never overlaps content: the app below gets 32px top padding.
- Background `#0B0B0C`, 1px bottom border `rgba(255,255,255,0.08)`, text `rgba(237,237,237,0.72)`.
- Font: `IBM Plex Mono`, 11px, uppercase, letter-spacing 0.06em. Self-host or Google Fonts with `display=swap`.
- Left: `NATE VICTOR / SIDEQUEST 0N` as a link to https://nate-victor.com (opens same tab).
- Center or after a `·`: the project name.
- Right: a 6px dot + data label + source. Exactly one of:
  - `LIVE` (dot `#3DDC84`): real data fetched now. Name the source, e.g. `LIVE · USGS`.
  - `RECORDED` (dot `#F5B83D`): real data, replayed. e.g. `RECORDED · comma2k19 drive`.
  - `SIMULATED` (dot `#9B8CFF`): generated data. e.g. `SIMULATED · fictional mission`.
  - `DEMO` (dot `#9B8CFF`): sample content or recorded model responses.
- If a screen mixes kinds, show the most synthetic one and list the rest in its `title` tooltip.
- At 390px: hide the center project name; keep left link and right label. No horizontal scroll.
- `role="banner"`-free: use `<div data-honesty-strip>` so the harness can assert it: selector `[data-honesty-strip]`.
