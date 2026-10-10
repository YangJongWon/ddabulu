(function (root) {
  const SITES = [
    { re: /store\.line\.me\/stickershop\/product\/(\d+)/, shop: "LINE STORE", category: "디지털 > 라인 스탬프", collectible: true },
    { re: /store\.line\.me\/emojishop\/product\/([0-9a-f]+)/, shop: "LINE STORE", category: "디지털 > 라인 이모지", collectible: true },
    { re: /e\.kakao\.com\/t\/([^/?#]+)/, shop: "카카오 이모티콘샵", category: "디지털 > 카카오 이모티콘", collectible: true },
    { re: /coupang\.com\/vp\/products\/(\d+)/, shop: "쿠팡" },
    { re: /(?:smartstore|brand)\.naver\.com\/[^/]+\/products\/(\d+)/, shop: "네이버 스마트스토어" },
    { re: /11st\.co\.kr\/products\/(\d+)/, shop: "11번가" },
    { re: /gmarket\.co\.kr\/.*[?&]goodscode=(\d+)/i, shop: "G마켓" },
    { re: /musinsa\.com\/(?:products|app\/goods)\/(\d+)/, shop: "무신사" },
    { re: /amazon\.[a-z.]+\/(?:.*\/)?(?:dp|gp\/product)\/([A-Z0-9]{10})/, shop: "Amazon" },
  ];

  function meta(doc, key) {
    const el = doc.querySelector(`meta[property="${key}"]`) || doc.querySelector(`meta[name="${key}"]`);
    return el ? (el.getAttribute("content") || "").trim() : "";
  }

  function hasType(node, type) {
    const t = node && node["@type"];
    return Array.isArray(t) ? t.includes(type) : t === type;
  }

  function walk(node, out) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach((n) => walk(n, out));
    out.push(node);
    if (node["@graph"]) walk(node["@graph"], out);
  }

  function jsonLd(doc) {
    const nodes = [];
    doc.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try {
        walk(JSON.parse(s.textContent), nodes);
      } catch {
        // Broken JSON-LD is common; the other sources still apply.
      }
    });
    return nodes;
  }

  function imageList(img) {
    if (!img) return [];
    if (Array.isArray(img)) return img.flatMap(imageList);
    if (typeof img === "object") return imageList(img.url || img.contentUrl || "");
    const s = String(img).trim();
    return s ? [s] : [];
  }

  function parsePrice(v) {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(String(v).replace(/[^\d.]/g, ""));
    return n > 0 ? n : null;
  }

  function offerPrice(offers) {
    if (!offers) return null;
    const list = Array.isArray(offers) ? offers : [offers];
    for (const o of list) {
      const p = parsePrice(o.price ?? o.lowPrice);
      if (p) return p;
    }
    return null;
  }

  function breadcrumb(nodes) {
    const bc = nodes.find((n) => hasType(n, "BreadcrumbList"));
    if (!bc || !Array.isArray(bc.itemListElement)) return "";
    return bc.itemListElement
      .map((e) => e.name || (e.item && e.item.name) || "")
      .filter(Boolean)
      .join(" > ");
  }

  function absolute(u, base) {
    if (!u) return "";
    try {
      return new URL(u, base).href;
    } catch {
      return "";
    }
  }

  function extract(doc, href) {
    const site = SITES.find((s) => s.re.test(href));
    const nodes = jsonLd(doc);
    const ld = nodes.find((n) => hasType(n, "Product") || hasType(n, "ProductGroup"));
    const ogType = meta(doc, "og:type").toLowerCase();
    if (!site && !ld && !ogType.includes("product")) return null;

    const brand = ld && ld.brand ? (typeof ld.brand === "object" ? ld.brand.name : ld.brand) : "";
    const name = (ld && ld.name) || meta(doc, "og:title") || doc.title || "";
    if (!name.trim()) return null;
    const host = (() => {
      try {
        return new URL(href).hostname.replace(/^www\.|^m\./, "");
      } catch {
        return "";
      }
    })();

    const images = [];
    for (const raw of [...imageList(ld && ld.image), meta(doc, "og:image")]) {
      const abs = absolute(raw, href);
      if (/^https?:\/\//i.test(abs) && !images.includes(abs)) images.push(abs);
    }

    return {
      name: String(name).trim(),
      brand: String(brand || meta(doc, "product:brand") || "").trim(),
      category: (site && site.category) || (ld && ld.category && String(ld.category)) || breadcrumb(nodes) || "",
      price:
        (ld && offerPrice(ld.offers)) ||
        parsePrice(meta(doc, "product:price:amount")) ||
        parsePrice(meta(doc, "og:price:amount")),
      image: images[0] || "",
      images,
      shop: (site && site.shop) || host,
      productId: site ? href.match(site.re)[1] : (ld && (ld.sku || ld.productID)) || "",
      gtin: (ld && (ld.gtin13 || ld.gtin || ld.gtin12 || ld.gtin8)) || "",
      url: href.split("#")[0],
      collectible: Boolean(site && site.collectible),
      // Which sources recognised the page. Only telemetry reads it; records drop it.
      via: { site: Boolean(site), ld: Boolean(ld), og: ogType.includes("product") },
    };
  }

  const api = { extract };
  root.ItememExtract = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
