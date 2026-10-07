(function (root) {
  const WEIGHTS = { category: 0.30, name: 0.30, brand: 0.15, attrs: 0.20, price: 0.05 };

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

  function compare(product, owned) {
    if (isExact(product, owned)) {
      return { percent: 100, band: "같은 상품", same: ["같은 상품 페이지"], diff: [], exact: true };
    }
    const pa = extractAttrs(`${product.name} ${product.options || ""}`);
    const pb = extractAttrs(`${owned.name} ${owned.options || ""}`);
    const attr = attrsScore(pa, pb);
    const parts = {
      category: categoryScore(product.category, owned.category),
      name: tokenSetRatio(product.name, owned.name),
      brand: brandScore(product.brand, owned.brand),
      attrs: attr.score,
      price: priceScore(product.price, owned.price),
    };
    let total = 0;
    let weight = 0;
    for (const [k, v] of Object.entries(parts)) {
      if (v === null) continue;
      total += WEIGHTS[k] * v;
      weight += WEIGHTS[k];
    }
    const percent = Math.round((total / weight) * 100);
    const same = [];
    const diff = [];
    if (parts.category === 1) same.push("카테고리");
    else if (parts.category === 0) diff.push("카테고리");
    if (parts.brand === 1) same.push("브랜드");
    else if (parts.brand === 0) diff.push("브랜드");
    attr.same.forEach((k) => same.push(ATTR_LABEL[k]));
    attr.diff.forEach((k) => diff.push(ATTR_LABEL[k]));
    return { percent, band: band(percent), same, diff, exact: false };
  }

  function band(percent) {
    if (percent >= 90) return "거의 같은 상품";
    if (percent >= 70) return "매우 비슷";
    if (percent >= 50) return "같은 종류";
    return null;
  }

  function check(product, items, limit = 5) {
    // Two emoticon packs share a category by definition, so "같은 종류" says nothing for them.
    const floor = product.collectible ? 70 : 50;
    const results = items
      .filter((it) => it.status !== "disposed")
      .map((it) => ({ item: it, ...compare(product, it) }))
      .filter((r) => r.exact || r.percent >= floor)
      .sort((a, b) => b.percent - a.percent);
    return {
      exact: results.filter((r) => r.exact),
      similar: results.filter((r) => !r.exact).slice(0, limit),
    };
  }

  const api = { normalize, tokenSetRatio, extractAttrs, compare, check, productKey, canonicalUrl, isExact, band };
  root.ItememSim = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
