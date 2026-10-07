(function (root) {
  // Max differing bits (of 256) for two sticker images to count as the same art.
  // Measured on LINE package 1: same art at another resolution <= 28, distinct stickers >= 44.
  const SAME_IMAGE_BITS = 34;

  const POP = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

  function hamming(a, b) {
    if (!a || !b || a.length !== b.length) return Infinity;
    let d = 0;
    for (let i = 0; i < a.length; i++) d += POP[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
    return d;
  }

  // Row-wise difference hash over a (w+1) x h grayscale grid.
  function dhash(gray, w, h) {
    let hex = "";
    let nibble = 0;
    let bits = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        nibble = (nibble << 1) | (gray[y * (w + 1) + x] > gray[y * (w + 1) + x + 1] ? 1 : 0);
        if (++bits === 4) {
          hex += nibble.toString(16);
          nibble = 0;
          bits = 0;
        }
      }
    }
    return hex;
  }

  function overlap(members, ownedItems, { selfKey, threshold = SAME_IMAGE_BITS } = {}) {
    const pool = [];
    for (const it of ownedItems) {
      if (it.status === "disposed" || !Array.isArray(it.members)) continue;
      if (selfKey && it.packageKey === selfKey) continue;
      for (const m of it.members) pool.push({ item: it, member: m });
    }
    const byId = new Map(pool.map((p) => [p.member.id, p]));

    const stickers = members.map((m) => {
      let hit = byId.get(m.id);
      let distance = hit ? 0 : Infinity;
      if (!hit && m.hash) {
        for (const p of pool) {
          const d = hamming(m.hash, p.member.hash);
          if (d < distance) {
            distance = d;
            hit = p;
          }
        }
        if (distance > threshold) hit = null;
      }
      return {
        id: m.id,
        image: m.image,
        owned: hit ? { itemId: hit.item.id, itemName: hit.item.name, id: hit.member.id, image: hit.member.image } : null,
        how: hit ? (distance === 0 && hit.member.id === m.id ? "same-id" : "same-image") : null,
      };
    });

    const perItem = new Map();
    for (const s of stickers) {
      if (!s.owned) continue;
      const row = perItem.get(s.owned.itemId) || { itemId: s.owned.itemId, name: s.owned.itemName, count: 0 };
      row.count++;
      perItem.set(s.owned.itemId, row);
    }
    const owned = stickers.filter((s) => s.owned).length;
    return {
      total: stickers.length,
      owned,
      percent: stickers.length ? Math.round((owned / stickers.length) * 100) : 0,
      byPackage: [...perItem.values()].sort((a, b) => b.count - a.count),
      stickers,
    };
  }

  const api = { hamming, dhash, overlap, SAME_IMAGE_BITS };
  root.ItememBundle = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
