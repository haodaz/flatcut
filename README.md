# flatcut

**Cut the paper-white background out of an AI-generated flat illustration — without eating the light areas inside the subject.**

```bash
npx flatcut tiger.png tiger-cut.png
```

```js
import {flatcut} from 'flatcut';
const img = await flatcut('tiger.png');
await img.toFile('tiger-cut.png');
```

Requires [`sharp`](https://sharp.pixelplumbing.com/) as a peer dependency. MIT.

---

## Why this isn't one line of "remove near-white pixels"

I wrote the naive version first. It broke three different ways on real
generated images, and each break is worth knowing about.

### 1. The "white" background usually isn't white

Tongyi Wanxiang hands back a warm cream, around `rgb(249, 241, 215)`.
Midjourney tends toward a cool grey-white. A test like

```js
r > 232 && g > 232 && b > 232 && Math.max(r,g,b) - Math.min(r,g,b) < 14
```

passes on paper white and fails on cream — that saturation check is 34 points
wide on the cream above.

flatcut samples the four corners of the image and keys on **that** colour with a
tolerance. The background tells you what it is; you don't tell it.

### 2. The subject has light areas inside it

A tiger's belly, muzzle and inner ears are the same cream as the background.
Match on colour globally and you punch holes straight through the character.

So the fill has to be **connected**: only pixels reachable from outside count as
background.

### 3. …but you can't seed the fill from every edge pixel

This is the one that cost me the most time.

Subjects are usually cropped by the frame. The tiger's cream belly runs all the
way down to the bottom edge of the image. Seed a flood fill from every border
pixel and it starts *inside* the belly and eats upward through the character.

flatcut seeds **only from the four corners**. The background is one connected
region wrapping the subject, so four corners always reach all of it — while an
interior light region, walled off by the subject, is never touched.

### 4. Hard edges show a halo on dark backgrounds

Cut on a hard threshold and you keep a one-pixel ring of the old background.
Invisible on white, obvious the moment you place the cutout on a dark surface.

Pixels adjacent to the background get partial alpha, scaled by how far their
colour sits from the background colour.

---

## Options

```js
await flatcut(input, {
  tolerance: 34,   // RGB euclidean distance. Raise it for noisy or gradient backdrops.
  trim: true,      // crop fully-transparent margins
  sharp,           // pass your own sharp instance
});
```

`input` is anything `sharp()` accepts — a path, a Buffer, or a Sharp instance.
The return value is a Sharp instance, so you can keep chaining.

```bash
flatcut in.png out.png --tolerance=48 --no-trim
```

## What it is not

Not a matting model. There is no network here and no attempt at hair, fur
wisps, smoke or glass. It does one thing: flat illustration on a flat backdrop.
For photographs, reach for a real matting model.

## Tests

```bash
npm test
```

The test builds an image that walks into all three traps at once — cream
background, a cream region inside the subject, and that region running off the
bottom edge — and asserts the background goes, the subject stays whole, the
interior light region survives, and the edge is feathered.

## Where it came from

Extracted from [Today](https://github.com/haodaz/today), a Fire TV app whose
character is generated rather than drawn. Every one of the three problems above
is something that illustration broke on first.

## Licence

MIT.
