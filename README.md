# NEGATIVE

Film-style looks for ordinary photos. Design on one JPEG/PNG/WebP, then apply the same recipe to a whole folder.

NEGATIVE by MENiAC. No RAW. No video. Local-only — the batch route talks to your filesystem and only accepts requests from this machine.

![NEGATIVE UI](docs/NEGATIVE.png)

## What you can do

- Open a photo, pick a built-in look, then add / reorder / tweak modifiers.
- Built-in looks: Neutral, Negative, Portra, Kodachrome, Ektar, Tri-X, Faded 70s, Cross process.
- **Mine**: save, rename, duplicate, delete, **export** and **import** your own looks. They live in this browser (`localStorage`); the JSON file is for backup or another machine.
- Stack modifiers (only stacked effects run): white balance, saturation, brightness, **exposure**, contrast, **clarity**, fade, tone, vignette, grain, black & white, split tone, radial / linear blur, border, light leak, **halation**, **bloom**, **dust & scratches**, **date stamp**, **chromatic smear**, **coffee stain**, **halftone**.
- Grain has a Color slider (luma → chroma) and a Seed. Black & white can use Luma / Red / Orange / Yellow / Green filters. Light leak, dust and coffee also have a seed; folder batch mixes that seed with each filename so grain, leaks, dust and stains vary per photo.
- Radial blur uses a disc mask (sharp centre). Linear blur is a rotatable band (tilt-shift). Drag Center / Shift sliders to see a gizmo on the photo; it hides on mouse up.
- Border scales the photo into the frame: **Print** (even paper), **Polaroid** (thick bottom), **Film** (rebate + sprockets). Tone is paper / stock (white → black); Warmth tints it cream.
- Light leak fogs the frame like light hit the film: **Edge**, **Corner**, or **Streak**. Color is yellow → orange → red → magenta. Drag Center to place it.
- Halation is a red/orange glow on brights; bloom is a softer white diffusion. Dust paints specks and hairs. Date stamp is a 7-segment LCD (default `94 08 12`). Chromatic smear offsets red and blue, stronger at the edges. Coffee stain paints mug rings and spills (Roast is latte → espresso); drag Center to place them. Halftone is **Newsprint** dots or a **Line screen**; Pitch is dot size, Ink is black → warm pulp.
- Compare any look with a vertical split. Hold **Original** or press **Space** to peek at the ungraded photo.
- Export the current photo, or apply the current stack to a folder. Originals are never overwritten.
- Scroll the preview to zoom, drag to pan when zoomed. The percentage (or double-click) fits the whole photo.

## Requirements

- Node.js 22+ (20 may work)
- npm 10+
- Linux is the intended home. macOS/Windows should run; folder batch needs a real filesystem path.

`sharp` (decode/encode) and `esbuild` need install scripts. This repo lists them in `package.json` under `allowScripts`.

## Install

```bash
cd NEGATIVE
npm install
```

If `sharp` did not build (preview/export then fail with a native-module error):

```bash
npm install-scripts approve sharp esbuild
npm rebuild sharp
```

## Develop

```bash
npm run dev
```

Open [http://127.0.0.1:8084](http://127.0.0.1:8084). Bound to localhost on port **8084**.

```bash
npm run check
```

Typechecks the SvelteKit app.

## Build and run

Production build uses `@sveltejs/adapter-node` (the UI is a browser app, but export/batch need Node + the filesystem). Output is `build/`.

```bash
npm run build
npm start
```

`start` runs `node build` on [http://127.0.0.1:8084](http://127.0.0.1:8084). Adapter-node defaults to port 3000 if you call `node build` yourself — pass `PORT` / `HOST` to override:

```bash
PORT=8084 HOST=127.0.0.1 node build
```

`npm run preview` serves the Vite preview of the client on 8084. Use `npm start` (or `node build`) when you want folder batch and export to work the same as production.

## How it is put together

| Path | Role |
|---|---|
| `src/lib/grade.ts` | Pixel engine. Point effects per pixel; blur, border, leak, glow, dust, stamp, chroma, coffee, halftone and clarity are whole-buffer passes. |
| `src/lib/blur.ts` | Masked gaussian-ish blur (radial disc / linear band) plus `softBlur`. |
| `src/lib/border.ts` | Print / Polaroid / film rebate (photo scaled into the frame). |
| `src/lib/leak.ts` | Analog light leak (edge / corner / streak, screen-blended). |
| `src/lib/glow.ts` | Halation and bloom (highlight extract + soft blur). |
| `src/lib/dust.ts` | Specks and hair scratches, seeded per photo in a batch. |
| `src/lib/stamp.ts` | 7-segment date stamp. |
| `src/lib/chroma.ts` | Lateral chromatic smear. |
| `src/lib/coffee.ts` | Mug rings and coffee spills. |
| `src/lib/halftone.ts` | Newsprint dots and engraved line screen. |
| `src/lib/clarity.ts` | Midtone unsharp. |
| `src/lib/modifiers.ts` | Catalogue of addable effects (labels, defaults). |
| `src/lib/presets.ts` | Built-in named stacks. Clicking one copies that stack into the editor. |
| `src/lib/userLooks.ts` | Save / load / import / export user looks in `localStorage`. |
| `src/lib/types.ts` | `Modifier`, `GradeSettings`, `Look`. |
| `src/lib/preview.ts` | Downscale + live/HQ canvas preview. |
| `src/lib/server/` | sharp decode/encode, folder walk, localhost check, settings parse. |
| `src/routes/api/export` | One uploaded file → graded download. |
| `src/routes/api/batch` | Source folder → destination folder. Originals are never overwritten. |

A look is a named stack of modifiers. Add only the effects you need; each one has its own sliders. Export and folder batch send the current stack. Order is apply order (top to bottom). Collapse is UI-only and is not saved.

Preview grades a small live raster while a slider moves, then a sharper pass after it settles, drawn at a fixed frame size so the picture does not jump.

## License

MIT. See `LICENSE`.
