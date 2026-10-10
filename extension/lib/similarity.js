(function (root) {
  // Shares of the composite. A factor with no data drops out and the rest are scaled to 100.
  // Category, name, brand, shop, capacity, color, size, price, and image are separate factors.
  const WEIGHTS = {
    category: 0.18,
    name: 0.18,
    brand: 0.09,
    shop: 0.10,
    capacity: 0.06,
    color: 0.06,
    size: 0.06,
    price: 0.03,
    image: 0.24,
  };
  // The picture is the product, so it takes half the score.
  const VISUAL_WEIGHTS = {
    category: 0.12,
    name: 0.20,
    brand: 0.04,
    shop: 0.08,
    capacity: 0.01,
    color: 0.01,
    size: 0.01,
    price: 0.03,
    image: 0.50,
  };
  // Color, size, and the photo matter more than capacity.
  const APPAREL_WEIGHTS = {
    category: 0.12,
    name: 0.16,
    brand: 0.12,
    shop: 0.06,
    capacity: 0.02,
    color: 0.14,
    size: 0.12,
    price: 0.04,
    image: 0.22,
  };

  function weightProfile(category) {
    const c = String(category || "");
    if (/스탬프|이모지|이모티콘|스티커/.test(c)) return VISUAL_WEIGHTS;
    if (/의류|패션|신발|가방|액세서리|악세서리/.test(c)) return APPAREL_WEIGHTS;
    return WEIGHTS;
  }

  const COLORS = [
    "블랙", "검정", "화이트", "흰색", "아이보리", "레드", "빨강", "블루", "파랑", "네이비", "그레이", "회색",
    "베이지", "브라운", "갈색", "핑크", "그린", "초록", "카키", "옐로우", "노랑", "퍼플", "보라", "민트", "실버", "골드",
    "black", "white", "ivory", "red", "blue", "navy", "gray", "grey", "beige", "brown", "pink", "green",
    "khaki", "yellow", "purple", "mint", "silver", "gold",
  ];
  const COLOR_ALIASES = {
    검정: "블랙", black: "블랙", 흰색: "화이트", white: "화이트", ivory: "아이보리", 빨강: "레드", red: "레드",
    파랑: "블루", blue: "블루", navy: "네이비", 회색: "그레이", gray: "그레이", grey: "그레이", beige: "베이지",
    갈색: "브라운", brown: "브라운", pink: "핑크", 초록: "그린", green: "그린", khaki: "카키", 노랑: "옐로우",
    yellow: "옐로우", 보라: "퍼플", purple: "퍼플", mint: "민트", silver: "실버", gold: "골드",
  };

  function normalize(s) {
    return String(s || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}.]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokens(s) {
    return normalize(s).split(" ").filter(Boolean);
  }

  function lcs(a, b) {
    if (!a.length || !b.length) return 0;
    let prev = new Array(b.length + 1).fill(0);
    for (let i = 1; i <= a.length; i++) {
      const cur = new Array(b.length + 1).fill(0);
      for (let j = 1; j <= b.length; j++) {
        cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function ratio(a, b) {
    if (!a && !b) return 1;
    return (2 * lcs(a, b)) / (a.length + b.length);
  }

  // Same shape as rapidfuzz.fuzz.token_set_ratio, on a 0..1 scale.
  function tokenSetRatio(a, b) {
    const ta = new Set(tokens(a));
    const tb = new Set(tokens(b));
    if (!ta.size || !tb.size) return 0;
    const inter = [...ta].filter((t) => tb.has(t)).sort();
    const diffA = [...ta].filter((t) => !tb.has(t)).sort();
    const diffB = [...tb].filter((t) => !ta.has(t)).sort();
    if (inter.length && (!diffA.length || !diffB.length)) return 1;
    const t0 = inter.join(" ");
    const t1 = [t0, ...diffA].join(" ").trim();
    const t2 = [t0, ...diffB].join(" ").trim();
    return Math.max(ratio(t0, t1), ratio(t0, t2), ratio(t1, t2));
  }

  function extractAttrs(text) {
    const s = normalize(text);
    const attrs = {};
    const cap = [...s.matchAll(/(\d+(?:\.\d+)?)\s?(ml|l|g|kg|mm|cm|oz|매|개입|입|개)(?![a-z])/g)].map(
      (m) => `${Number(m[1])}${m[2]}`
    );
    if (cap.length) attrs.capacity = [...new Set(cap)];
    const words = new Set(s.split(" "));
    const colors = COLORS.filter((c) => words.has(c) || (/[가-힣]/.test(c) && s.includes(c))).map(
      (c) => COLOR_ALIASES[c] || c
    );
    if (colors.length) attrs.color = [...new Set(colors)];
    const size = [...s.matchAll(/(?:^|\s)(xs|xl|xxl|xxxl|free|프리)(?=\s|$)/g)].map((m) => m[1]);
    if (size.length) attrs.size = [...new Set(size)];
    return attrs;
  }

  function categoryParts(c) {
    return String(c || "")
      .split(/\s*(?:>|\/|›|»|\|)\s*/)
      .map(normalize)
      .filter(Boolean);
  }

  function categoryScore(a, b) {
    const pa = categoryParts(a);
    const pb = categoryParts(b);
    if (!pa.length || !pb.length) return null;
    if (pa[pa.length - 1] === pb[pb.length - 1]) return 1;
    if (pa[0] === pb[0]) return 0.5;
    return 0;
  }

  function shopScore(a, b) {
    const na = normalize(a);
    const nb = normalize(b);
    if (!na || !nb) return null;
    return na === nb ? 1 : 0;
  }

  function brandScore(a, b) {
    const na = normalize(a);
    const nb = normalize(b);
    if (!na || !nb) return null;
    return na === nb || na.includes(nb) || nb.includes(na) ? 1 : 0;
  }

  function attrsScore(a, b) {
    const keys = Object.keys(a).filter((k) => b[k]);
    if (!keys.length) return { score: null, same: [], diff: [] };
    const same = [];
    const diff = [];
    for (const k of keys) {
      (a[k].some((v) => b[k].includes(v)) ? same : diff).push(k);
    }
    return { score: same.length / keys.length, same, diff };
  }

  function priceScore(a, b) {
    const pa = Number(a);
    const pb = Number(b);
    if (!(pa > 0) || !(pb > 0)) return null;
    return 1 - Math.min(1, Math.abs(pa - pb) / Math.max(pa, pb));
  }

  function productKey(p) {
    if (p.productId && p.shop) return `${p.shop}#${p.productId}`;
    if (p.url) return canonicalUrl(p.url);
    return null;
  }

  function canonicalUrl(u) {
    try {
      const url = new URL(u);
      return `${url.hostname.replace(/^www\.|^m\./, "")}${url.pathname.replace(/\/$/, "")}`;
    } catch {
      return String(u);
    }
  }

  function isExact(a, b) {
    const ka = productKey(a);
    if (ka && ka === productKey(b)) return true;
    if (a.gtin && b.gtin && a.gtin === b.gtin) return true;
    return Boolean(a.url && b.url && canonicalUrl(a.url) === canonicalUrl(b.url));
  }

  const ATTR_LABEL = { capacity: "용량", color: "색상", size: "사이즈" };
  const PART_LABEL = {
    category: "카테고리",
    name: "이름",
    brand: "브랜드",
    shop: "구입처",
    capacity: "용량",
    color: "색상",
    size: "사이즈",
    price: "가격",
    image: "개별 이미지",
  };

  function spread(values, total) {
    const out = values.map((n) => Math.floor(n));
    let left = total - out.reduce((s, n) => s + n, 0);
    const order = values
      .map((n, i) => [i, n - Math.floor(n)])
      .sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    for (let i = 0; i < order.length && left > 0; i++) {
      out[order[i][0]] += 1;
      left -= 1;
    }
    return out;
  }

  // Missing factors drop out and the remaining weights are scaled to 100.
  // `applied` is that scaled weight. `points` is applied × score, adjusted so the points add up to `percent`.
  function contributions(parts, table) {
    const rows = Object.keys(table).map((k) => ({
      key: k,
      label: PART_LABEL[k],
      ratio: parts[k],
      weight: table[k],
    }));
    const used = rows.filter((r) => r.ratio != null);
    const omitted = rows
      .filter((r) => r.ratio == null)
      .map((r) => ({ key: r.key, label: r.label, weight: Math.round(r.weight * 100) }));
    if (!used.length) return { percent: 0, weights: [], omitted };
    const sumW = used.reduce((s, r) => s + r.weight, 0);
    const appliedRaw = used.map((r) => (r.weight / sumW) * 100);
    const pointsRaw = used.map((r) => (r.weight / sumW) * r.ratio * 100);
    const percent = Math.round(pointsRaw.reduce((s, n) => s + n, 0));
    const applied = spread(appliedRaw, 100);
    const points = spread(pointsRaw, percent);
    return {
      percent,
      weights: used.map((r, i) => ({
        key: r.key,
        label: r.label,
        weight: Math.round(r.weight * 100),
        applied: applied[i],
        score: Math.round(r.ratio * 100),
        points: points[i],
      })),
      omitted,
    };
  }

  function shown(v) {
    const s = String(v == null ? "" : v).trim();
    return s || "없음";
  }

  function money(v) {
    const n = Number(v);
    return n > 0 ? `${n.toLocaleString("ko-KR")}원` : "없음";
  }

  function categoryBecause(a, b) {
    const pa = categoryParts(a);
    const pb = categoryParts(b);
    if (!pa.length || !pb.length) return "카테고리가 한쪽 또는 양쪽에 없어 비교하지 않음";
    if (pa[pa.length - 1] === pb[pb.length - 1]) return `마지막 분류 「${pa[pa.length - 1]}」가 같음`;
    if (pa[0] === pb[0]) {
      return `앞 분류 「${pa[0]}」만 같고, 마지막 분류는 「${pa[pa.length - 1]}」와 「${pb[pb.length - 1]}」로 다름`;
    }
    return "겹치는 분류 단계가 없음";
  }

  function categoryReason(a, b) {
    const pa = categoryParts(a);
    const pb = categoryParts(b);
    if (!pa.length || !pb.length) return { id: "cat-missing" };
    if (pa[pa.length - 1] === pb[pb.length - 1]) return { id: "cat-last", name: pa[pa.length - 1] };
    if (pa[0] === pb[0]) return { id: "cat-first", head: pa[0], left: pa[pa.length - 1], right: pb[pb.length - 1] };
    return { id: "cat-none" };
  }

  function listReason(key, left, right, percent) {
    if (!left.length && !right.length) return { id: "attr-none", key };
    if (!left.length || !right.length) return { id: "attr-one", key };
    return { id: percent === 100 ? "attr-same" : "attr-diff", key };
  }

  function listBecause(label, left, right, percent) {
    if (!left.length && !right.length) return `${label}을 양쪽에서 찾지 못함`;
    if (!left.length || !right.length) return `${label}이 한쪽에만 있음`;
    return percent === 100 ? `양쪽에서 같은 ${label}이 나옴` : `${label}이 서로 다름`;
  }

  // Every factor stays on the list. A missing value is null, not removed.
  function factorDetails(product, owned, parts, attr, pa, pb) {
    const scored = (ratio) => (ratio == null ? null : Math.round(ratio * 100));
    const attrPercent = (key) => {
      if (attr.same.includes(key)) return 100;
      if (attr.diff.includes(key)) return 0;
      return null;
    };
    const shop = shopScore(product.shop, owned.shop);
    const rows = [
      {
        key: "category",
        label: "카테고리",
        percent: scored(parts.category),
        because: categoryBecause(product.category, owned.category),
        reason: categoryReason(product.category, owned.category),
        left: shown(product.category),
        right: shown(owned.category),
      },
      {
        key: "name",
        label: "이름",
        percent: scored(parts.name),
        because: parts.name == null ? "이름이 한쪽 또는 양쪽에 없음" : "상품명에 겹치는 단어를 비교",
        left: shown(product.name),
        right: shown(owned.name),
      },
      {
        key: "brand",
        label: "브랜드",
        percent: scored(parts.brand),
        because: parts.brand == null ? "브랜드가 한쪽 또는 양쪽에 없음" : parts.brand === 1 ? "브랜드명이 같거나 한쪽이 다른 쪽을 포함" : "브랜드명이 다름",
        left: shown(product.brand),
        right: shown(owned.brand),
      },
      {
        key: "shop",
        label: "구입처",
        percent: shop == null ? null : Math.round(shop * 100),
        because: shop == null ? "구입처가 한쪽 또는 양쪽에 없음" : shop === 1 ? "구입처가 같음" : "구입처가 다름",
        left: shown(product.shop),
        right: shown(owned.shop),
      },
    ];
    for (const key of ["capacity", "color", "size"]) {
      const label = ATTR_LABEL[key];
      const left = pa[key] || [];
      const right = pb[key] || [];
      const percent = attrPercent(key);
      rows.push({
        key,
        label,
        percent,
        because: listBecause(label, left, right, percent),
        reason: listReason(key, left, right, percent),
        left: left.length ? left.join(", ") : "없음",
        right: right.length ? right.join(", ") : "없음",
      });
    }
    rows.push({
      key: "price",
      label: "가격",
      percent: scored(parts.price),
      because: parts.price == null ? "가격이 한쪽 또는 양쪽에 없음" : "두 가격의 차이 비율로 계산",
      left: money(product.price),
      right: money(owned.price),
    });
    return rows;
  }

  function compare(product, owned) {
    const exact = isExact(product, owned);
    const pa = extractAttrs(`${product.name} ${product.options || ""}`);
    const pb = extractAttrs(`${owned.name} ${owned.options || ""}`);
    const attr = attrsScore(pa, pb);
    const parts = {
      category: categoryScore(product.category, owned.category),
      name: tokenSetRatio(product.name, owned.name),
      brand: brandScore(product.brand, owned.brand),
      shop: shopScore(product.shop, owned.shop),
      capacity: attr.same.includes("capacity") ? 1 : attr.diff.includes("capacity") ? 0 : null,
      color: attr.same.includes("color") ? 1 : attr.diff.includes("color") ? 0 : null,
      size: attr.same.includes("size") ? 1 : attr.diff.includes("size") ? 0 : null,
      price: priceScore(product.price, owned.price),
      image: null,
    };
    const factorWeights = weightProfile(product.category || owned.category);
    const { percent, weights, omitted } = contributions(parts, factorWeights);
    const details = factorDetails(product, owned, parts, attr, pa, pb);
    const same = [];
    const diff = [];
    if (parts.category === 1) same.push("카테고리");
    else if (parts.category === 0) diff.push("카테고리");
    if (parts.brand === 1) same.push("브랜드");
    else if (parts.brand === 0) diff.push("브랜드");
    attr.same.forEach((k) => same.push(ATTR_LABEL[k]));
    attr.diff.forEach((k) => diff.push(ATTR_LABEL[k]));
    if (exact) {
      return { percent: 100, band: "같은 상품", same: ["같은 상품 페이지"], diff: [], exact: true, details, weights, omitted, factorWeights };
    }
    return { percent, band: band(percent), same, diff, exact: false, details, weights, omitted, factorWeights };
  }

  // Image percent arrives after the hashes. Fold it into the same weighted sum as every other scored factor.
  function includeImage(row, imagePercent) {
    if (!row || row.exact || imagePercent == null) return row;
    const table = row.factorWeights || WEIGHTS;
    const parts = {};
    for (const key of Object.keys(table)) parts[key] = null;
    for (const w of row.weights || []) parts[w.key] = w.score / 100;
    parts.image = Math.max(0, Math.min(100, Math.round(Number(imagePercent)))) / 100;
    const { percent, weights, omitted } = contributions(parts, table);
    return { ...row, percent, band: band(percent), weights, omitted, factorWeights: table };
  }

  function band(percent) {
    if (percent >= 90) return "거의 같은 상품";
    if (percent >= 70) return "매우 비슷";
    if (percent >= 50) return "같은 종류";
    return null;
  }

  function personKey(name) {
    return String(name || "").trim().replace(/\s+/g, "").toLowerCase();
  }

  function samePerson(a, b) {
    const key = personKey(a);
    return key !== "" && key === personKey(b);
  }

  // Disposed things are gone and candidates were never bought: neither counts toward a duplicate.
  function active(it) {
    return Boolean(it) && it.status !== "disposed" && it.status !== "candidate";
  }

  function isHeld(it) {
    return active(it) && it.purpose !== "gift";
  }

  function isCandidate(it) {
    return Boolean(it) && it.status === "candidate";
  }

  function selfDuplicate(items, item) {
    return items.find((it) => isHeld(it) && isExact(item, it)) || null;
  }

  function audience(rows) {
    const gifts = [];
    let mine = false;
    for (const row of rows || []) {
      const it = row && row.item ? row.item : row;
      if (!active(it)) continue;
      if (it.purpose === "gift") {
        const name = String(it.recipient || "").trim();
        if (name && !gifts.some((g) => samePerson(g, name))) gifts.push(name);
      } else mine = true;
    }
    return { mine, gifts };
  }

  function giftDuplicate(items, item, recipient) {
    return items.find((it) => active(it) && it.purpose === "gift" && samePerson(it.recipient, recipient) && isExact(item, it)) || null;
  }

  // Mine vs. mine, or a gift vs. gifts for that same person.
  function sameOwner(it, purpose, recipient) {
    return purpose === "gift" ? it.purpose === "gift" && samePerson(it.recipient, recipient) : it.purpose !== "gift";
  }

  // The shortlist entry that buying (or giving) this product would fulfil.
  function shortlisted(items, item, purpose, recipient) {
    return items.find((it) => isCandidate(it) && sameOwner(it, purpose, recipient) && isExact(item, it)) || null;
  }

  // What a candidate would double up. A gift candidate is only checked against what that person already got:
  // owning one yourself is no reason not to give one.
  function candidateOverlap(c, items) {
    const pool = c.purpose === "gift"
      ? items.filter((it) => active(it) && it.purpose === "gift" && samePerson(it.recipient, c.recipient))
      : items;
    const res = check(c, pool, 1);
    return res.exact[0] || res.similar[0] || null;
  }

  function check(product, items, limit = 5) {
    // Two emoticon packs share a category by definition, so "같은 종류" says nothing for them.
    // Gifts stay in the result. The card title says who received them.
    const floor = product.collectible ? 70 : 50;
    const results = items
      .filter(active)
      .map((it) => ({ item: it, ...compare(product, it) }))
      .filter((r) => r.exact || r.percent >= floor)
      .sort((a, b) => b.percent - a.percent);
    return {
      exact: results.filter((r) => r.exact),
      similar: results.filter((r) => !r.exact).slice(0, limit),
    };
  }

  const api = { normalize, tokenSetRatio, extractAttrs, compare, check, includeImage, productKey, canonicalUrl, isExact, band, samePerson, active, isCandidate, shortlisted, candidateOverlap, selfDuplicate, giftDuplicate, audience };
  root.ItememSim = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
