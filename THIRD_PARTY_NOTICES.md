# Third-party notices

## LimeZu pixel art

Oikos draws its world and its residents with pixel art by **LimeZu** (https://limezu.itch.io/), from
these asset packs:

- **Modern Exteriors**: https://limezu.itch.io/modernexteriors
- **Modern Interiors**, including **Character Generator 2.0**: https://limezu.itch.io/moderninteriors

The art is © LimeZu. It is **not** covered by the MIT licence this repository uses for its own code
(see `LICENSE`), and nothing in this repository relicenses it.
The art is in this repository so that Oikos looks the way it was designed to look. It is not
offered as a sprite pack, and you get no right to the art by cloning this repository. If you want to
use these sprites in your own work, buy the packs from LimeZu and follow LimeZu's terms.

### Where the art is in this repository

- **`desktop/plugin.js`**: the built plugin. It embeds six sprite sheets as base64 PNG data URLs. These
  are a curated subset that the plugin needs at runtime:

  | sheet | size (px) | from | sha256 of the PNG |
  |---|---|---|---|
  | world atlas (97 tiles, props, buildings, vehicles) | 1024 × 2133 | Modern Exteriors, Modern Interiors | `6b5eb6bddee73dfbd819380e4aac30a3f97f1310795a5477c103559b373e7ac8` |
  | character bodies (9) | 768 × 1152 | Character Generator 2.0 | `4be23ec8dc99ef5ddeda203b362c161bcc163e4595199d56547b15c0477f8ff1` |
  | character eyes (7) | 768 × 896 | Character Generator 2.0 | `235f5452315c982e3928749185fb1828b539723214a231b1e2f3c821344302ed` |
  | character outfits (28) | 768 × 3584 | Character Generator 2.0 | `5d7d2ab304ba931fffcda6b797287c8615b215a335c2c7a49b9364cc106c7dca` |
  | character hairstyles (28) | 768 × 3584 | Character Generator 2.0 | `7c62989f0ab0061049748cb2a64ffda0851feab5f11c87efa01c12f09109a172` |
  | character accessories (12) | 768 × 1536 | Character Generator 2.0 | `ae0bb5a3cf723bcce18465aedee0a433bb6df1c3cf619c86170330bbd4aef11e` |

  The sheets are packed and cropped from the packs by `scripts/pack-biomes.py`. Anyone can decode
  them from the bundle. Encoding them in base64 does not protect them, and this repository does not
  claim it does.
- **`docs/hero.png`** and **`docs/banner.png`**: the closing frame of the Oikos promo film and a 2:1 crop
  of it, used for the README and the plugin catalog card. According to the promo film's source and
  notes, both are rendered by code and use no LimeZu sheet pixels. The seated character was designed
  with an image-generation model, using Oikos sprites only as a pixel-art style reference, and then
  snapped onto a pixel grid. The logo, fire and sky are drawn by code. The text uses Instrument Serif,
  EB Garamond and Departure Mono (SIL Open Font License). They are not in the plugin bundle, and
  Hermes Desktop never loads them.
- **Inside the app**: the Packs tab shows the credit "Tiles & characters by LimeZu (limezu.itch.io)".

**Not in this repository:** the original LimeZu downloads, their asset sheets and individual sprite
files, the loose packed PNGs, and the generated `embedded_data.limezu.js` module. The packer writes
the last two only into gitignored paths. The release gate (`scripts/check-release.mjs`) fails if any
image or sprite file other than the two pictures in `docs/` is committed. It also fails if image data
appears anywhere outside `desktop/plugin.js`.

### The terms this relies on

These are LimeZu's published terms as they read when this notice was written. LimeZu's own pages and
the licence files inside each download are authoritative. This summary is not a grant.

- **Modern Exteriors licence** (`Modern_Exteriors_License.pdf`, in the download): you **can** edit and use
  the asset in any commercial or non-commercial project, and **use the asset in open source projects
  (ex GitHub)**. You **can't** resell or distribute the asset to others, or edit and resell it
  (including NFT minting). Credit is required (https://limezu.itch.io/).
- **Modern Interiors licence** (`LICENSE.txt` in the download, and the store page): you **can** edit and
  use the asset in any commercial or non-commercial project. You **can't** resell or distribute the
  asset to others, or edit and resell it. Credit is required (limezu.itch.io). Character Generator 2.0
  is part of this pack. Its download has no separate licence file.
- **Public comments by LimeZu** on the Modern Interiors page, quoted as context only. They are not a
  permission given to Oikos:
  - https://itch.io/post/5005849: *"you are allowed to publish your game and profit out of it! The
    only type of commercial project that is not allowed is a resell of the sprites (even if
    modified)"*
  - https://itch.io/post/5284855: LimeZu replies *"Sure, go ahead with your project and good luck!"* to
    a developer who planned to ship modified sprites in an open-source game, credit LimeZu, and not
    share the asset itself (parent post: https://itch.io/post/5278406).

Oikos has **no** separate or special permission from LimeZu. It relies on the published terms above.
The plugin also runs without the art: a build with `OIKOS_ART=none` falls back to procedural tiles
and figures (see the README).

## npm build dependencies

These are used only to build and test. None is bundled into `desktop/plugin.js`; React and the Hermes
plugin SDK are provided by Hermes Desktop at runtime.

- `esbuild` (MIT): https://github.com/evanw/esbuild
- `react`, `react-dom` (MIT): https://github.com/facebook/react
