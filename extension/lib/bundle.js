(function (root) {
  // Max differing bits (of 256) for two sticker images to count as the same art.
  // Measured on LINE package 1: same art at another resolution <= 28, distinct stickers >= 44.
  const SAME_IMAGE_BITS = 34;

  // Turn a bit distance into a percent a person can read on a stamp.
  // Same art stays in the 85–100 band; past the match cutoff it falls to 0
  // within the next 48 bits, so a different drawing does not still look like 80%.
  function imagePercent(distance) {
    if (!Number.isFinite(distance)) return null;
    if (distance <= SAME_IMAGE_BITS) return Math.round(100 - (distance / SAME_IMAGE_BITS) * 15);
    return Math.max(0, Math.round(85 * (1 - (distance - SAME_IMAGE_BITS) / 48)));
  }

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

  function bestDistance(member, pool) {
    const id = String(member.id);
    if (pool.some((p) => String(p.id) === id)) return 0;
    if (!member.hash) return Infinity;
    let distance = Infinity;
    for (const p of pool) {
      if (!p.hash) continue;
      const d = hamming(member.hash, p.hash);
      if (d < distance) distance = d;
    }
    return distance;
  }

  // Mean of each stamp's image similarity against one owned package.
  // This is an average of the stamp percents, not a sum of name or category scores.
  function scorePackage(members, item) {
    const pool = Array.isArray(item.members) ? item.members : [];
    if (!pool.length || !members.length) return null;
    const stickers = [];
    for (const m of members) {
      const percent = imagePercent(bestDistance(m, pool));
      if (percent == null) continue;
      stickers.push({ id: String(m.id), image: m.image || "", percent });
    }
    if (!stickers.length) return null;
    const percent = Math.round(stickers.reduce((s, r) => s + r.percent, 0) / stickers.length);
    return { itemId: item.id, name: item.name, percent, counted: stickers.length, stickers };
  }

  function overlap(members, ownedItems, { selfKey, threshold = SAME_IMAGE_BITS } = {}) {
    const pool = [];
    for (const it of ownedItems) {
      if (it.status === "disposed" || it.status === "candidate" || it.purpose === "gift" || !Array.isArray(it.members)) continue;
      if (selfKey && it.packageKey === selfKey) continue;
      for (const m of it.members) pool.push({ item: it, member: m });
    }
    const byId = new Map(pool.map((p) => [p.member.id, p]));

    const stickers = members.map((m) => {
      let best = byId.get(m.id) || null;
      let distance = best ? 0 : Infinity;
      if (!best && m.hash) {
        for (const p of pool) {
          const d = hamming(m.hash, p.member.hash);
          if (d < distance) {
            distance = d;
            best = p;
          }
        }
      }
      const same = Boolean(best) && (best.member.id === m.id || distance <= threshold);
      const ref = best
        ? { itemId: best.item.id, itemName: best.item.name, id: best.member.id, image: best.member.image }
        : null;
      return {
        id: m.id,
        image: m.image,
        owned: same ? ref : null,
        nearest: ref,
        distance: Number.isFinite(distance) ? distance : null,
        percent: imagePercent(distance),
        how: same ? (distance === 0 && best.member.id === m.id ? "same-id" : "same-image") : null,
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
    const versus = [];
    for (const it of ownedItems) {
      if (it.status === "disposed" || it.status === "candidate" || it.purpose === "gift" || !Array.isArray(it.members)) continue;
      if (selfKey && it.packageKey === selfKey) continue;
      const row = scorePackage(members, it);
      if (row) versus.push(row);
    }
    versus.sort((a, b) => b.percent - a.percent);
    return {
      total: stickers.length,
      owned,
      percent: stickers.length ? Math.round((owned / stickers.length) * 100) : 0,
      byPackage: [...perItem.values()].sort((a, b) => b.count - a.count),
      stickers,
      versus,
    };
  }

  const api = { hamming, dhash, imagePercent, scorePackage, overlap, SAME_IMAGE_BITS };
  root.ItememBundle = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
