# LENS LAB 0.5.0 — Frontend experience system

## Design direction

The interface is a compact photography workstation, not a decorative dashboard. The theme, sound, and motion layers are designed to support long editing sessions:

- Two coordinated themes: Light Studio and Dark Studio.
- Photographic content is color-accurate; theme changes affect application chrome and controls, not source pixels.
- Short, low-volume synthesized cues communicate interaction types without turning every action into a notification.
- Motion is brief and positional changes are avoided. Reduced-motion settings always win.
- The visual tour highlights one target at a time, lowers the visual emphasis of unrelated controls, and leaves the target itself click-through and usable.

## Themes

For a demo build, run `npm run demo`; it creates the production bundle and serves it on `http://127.0.0.1:4173`. The active theme is stored in `lenslab-preferences-v1` as `theme: "light" | "dark"` and applied to the root `data-theme` attribute. Shared surface, text, border, and focus tokens live in `src/frontend.css`. The Settings view and top-bar toggle use the same Zustand preference, so a theme change is applied across the entire application immediately.

The `viewfinder-shell`, `photo-image-stage`, source photograph, and processed image canvas preserve their original display colors. Interface theme styles must never use global filters or image inversion.

## Sound map

All sounds are generated locally by `src/utils/sound.ts` through Web Audio. No audio assets, third-party service, or network call is involved.

| Interaction | Cue | Purpose |
|---|---|---|
| General control | `click` | Subtle acknowledgement |
| Workspace navigation | `navigation` | Two-note directional cue |
| Switch / select | `toggle` | State-change cue |
| Continuous range | `slider` | Very short, throttled tick |
| Focus / focal-distance range | `focus` | Higher two-note focus cue |
| Camera capture | `shutter` | Quiet transient plus low shutter body |
| Successful operation | `success` | Rising three-note confirmation |
| Destructive / caution action | `warning` | Lower two-note caution |
| Error pathway | `error` | Descending alert tone for uncaught browser errors and rejected promises |

Sound preferences are stored with existing preferences: `soundEnabled` and `soundVolume` (0–1). Default master volume is 0.65. Muting is immediate. The sound engine catches unsupported or blocked AudioContext behavior and never gates the underlying action. Three automated tests cover all nine cue types, disabled/muted silence, and graceful fallback when Web Audio is unavailable.

## Motion system

`motion-on` enables short workspace and panel entrances, control transitions, hover/active feedback, and a restrained guide highlight. `motion-off`, `prefers-reduced-motion: reduce`, and the root `no-motion` class disable animations and transitions. Avoid perpetual animation outside the current guided spotlight. Do not animate canvas pixels or large image layers as part of interface feedback.

## Guided walkthrough

`src/components/GuidedTour.tsx` positions a step card relative to the highlighted target. Four dimming panels create a true transparent opening around the target; this avoids the prior stacked overlay that could dim the target itself. It updates on scroll and resize, clamps the instruction card to the viewport, shows progress, traps keyboard focus, and closes with Escape. A missing target falls back to a centered instruction card. The tour is not automatically repeated after completion or dismissal; Settings provides a deliberate replay action.

## Suggested demo sequence

1. Open Studio and switch from Dark to Light using the top bar.
2. Open Settings and demonstrate theme persistence, the sound palette, volume, and animation toggle.
3. Replay the visual guide and show how the rest of the workspace dims while the highlighted target remains clear.
4. Move to Photo Lab, adjust a slider, use the before/after wipe, and demonstrate the dark photographic stage within a light application theme.
5. Switch to Dark Studio, use Lens Compare, then open Diagnostics to show the local-first workflow.

## UI acceptance checklist

- Theme selection persists after browser refresh and old preference records migrate by defaulting missing fields.
- No light-theme text is rendered in low-contrast gray on white or dark text on dark surfaces.
- A theme change never modifies source photo/canvas pixels.
- Sound can be muted and volume can be set to zero. Rapid slider changes are rate-limited.
- Disabling animation or using OS reduced motion removes non-essential movement.
- Guided-tour spotlight is visually clear and click-through; unrelated areas are dimmed and blocked. The card remains within the viewport and has a clear close/skip path.
- Top bar, sidebar reopen handle, modals, inspector, and guide card retain distinct stacking order.
- Layout remains usable at 320 px through desktop widths without overlapping primary controls.
