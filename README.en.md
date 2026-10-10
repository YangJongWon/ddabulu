# Ddabulu

[한국어](README.md) · **English** · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

> Your dupe is already at home.

A Chrome extension that tells you, right on the product page, when **what you are about to buy overlaps with something you already own**. No more buying the same thing twice, picking up a near-copy of what is in your drawer, or giving someone the same gift again.

| Already bought | Something similar | LINE sticker overlap |
|---|---|---|
| ![Already bought](docs/duplicate.png) | ![Something similar](docs/similar.png) | ![LINE sticker overlap](docs/line-overlap.png) |

<sub>Screenshots are from an earlier version, in Korean; the current screens differ a little.</sub>

## Features

### Already-owned alerts
- Open a product page and Ddabulu compares it with the things you have recorded. When it overlaps, a card appears in the bottom-right corner.
- **The same product** (same product ID or address) shows as 100%. The same product from another shop, or something similar, gets a score:
  - 90%+ **almost the same** · 70%+ **very similar** · 50%+ **same kind**
- The score weighs category, name, brand, shop, capacity, color, size, price, and **the product images**. Press "detail" on any line to see what it was based on and how many points it added.
- The weighting adapts to the product: color and size count more for clothing and shoes, the picture counts more for stickers and emoji.

### LINE stickers, one by one
- On a sticker pack, every sticker is compared by its picture with the stickers in the packs you already own.
- You see "16 of 88 stickers are already yours", the overlap rate, and **how much of the price pays for duplicates**, with a likeness badge on each sticker on the page.

### Gifts
- Record **who you gave what** with "Gave as a gift".
- Ddabulu warns you before giving the same person the same thing again. Gifts to other people do not count as overlaps.

### Maybes
- Keep products you are still thinking about as **maybes**, for yourself or as a gift for someone.
- Each maybe shows **whether it overlaps with what you own** (for a gift maybe: with what that person already got from you), so you can pick one that does not.
- Buy or give a maybe and it moves from the list to your records by itself.

### Other picks that don't overlap
- While you look at something that overlaps, Ddabulu suggests products other users viewed alongside it that **do not overlap with anything you own**.
- The suggestion table is downloaded whole and matched **inside your browser**, so the server never learns what you are looking at. (The suggestion service is coming soon.)

### Also
- **Share:** turn your list of things and gifts, or an alert card, into an image to copy or save.
- **Export and import:** back up or move your records as JSON, filtered by date and by yours or gifts.
- **Mute:** turn alerts off for a number of days, or on specific sites.
- **Four languages:** Korean, English, Japanese, Simplified Chinese. Follows the browser or your choice.

## Supported shops

With dedicated rules:

| Shop | Notes |
|---|---|
| LINE STORE | Stickers (per-picture comparison), emoji |
| Kakao Emoticon Shop | |
| Coupang · Naver Smart Store / Brand Store · 11st · Gmarket · Musinsa | Korea |
| Amazon | Every country site |

Most other shops work too, as long as their pages describe the product (schema.org `Product` or `og:type=product`).

## Install

- **Chrome Web Store:** coming soon.
- **From source:**
  1. Download this repository (`Code → Download ZIP`, or `git clone`).
  2. Open `chrome://extensions` in Chrome and turn on **Developer mode** (top right).
  3. Click **Load unpacked** and choose the `extension/` folder.

## Privacy

- Your purchases, gift recipients, maybes, and notes are stored **only in your browser** (`chrome.storage.local`). They are never sent anywhere.
- On first install, Ddabulu asks whether to send **anonymous usage stats**. Every feature works the same if you say no, and you can change your mind in settings at any time.
- The stats contain no URLs, no list of your things, no recipient names, and no persistent user ID. Everything that can be sent is defined in one file, [`extension/lib/telemetry.js`](extension/lib/telemetry.js), and the settings page shows the exact data waiting to be sent.
- Details: [privacy policy](docs/PRIVACY.md) (Korean)

## Development

```
extension/
  manifest.json        extension manifest
  background.js        records, comparison, image hashing, stats queue
  content.js           the alert card on shop pages
  popup.html/js/css    toolbar popup (record, list, settings, consent)
  lib/extract.js       reads the product from the page
  lib/similarity.js    product comparison and scores
  lib/bundle.js        LINE sticker picture comparison
  lib/recs.js          picks non-overlapping suggestions
  lib/telemetry.js     every anonymous stat field, and consent
  lib/i18n.js          Korean, Chinese, Japanese, English strings
  lib/share.js         list images for sharing
  tests/               tests
```

Tests (Node 22 or later, nothing to install):

```sh
node --test extension/tests/*.cjs
```

Bug reports and ideas are welcome in [Issues](https://github.com/YangJongWon/ddabulu/issues).

## License

The code is released under the [MIT License](LICENSE).

**The Ddabulu name, logo, and icons are not covered by the MIT License.** If you ship a modified version, please use a different name and icons.
