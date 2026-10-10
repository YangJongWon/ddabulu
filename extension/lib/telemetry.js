(function (root) {
  // Anonymous usage stats. Every field that leaves the browser is built here from a fixed list, so this file
  // is the whole answer to "what does Ddabulu send". Nothing is sent while ENDPOINT is empty or before opt-in.
  const ENDPOINT = "https://api.ddabulu.com/v1/batch";
  const SCHEMA = 1;
  // Bump when the consent wording changes in a way that needs asking again.
  const CONSENT_VERSION = 1;

  // No under-14 bucket: their data needs a guardian's consent, so it is never asked for.
  const AGES = ["14-19", "20s", "30s", "40s", "50s", "60+"];
  const GENDERS = ["f", "m", "x"];
  // i18n keys for showing the buckets.
  const AGE_LABEL = { "14-19": "14~19세", "20s": "20대", "30s": "30대", "40s": "40대", "50s": "50대", "60+": "60대 이상" };
  const GENDER_LABEL = { f: "여성", m: "남성", x: "기타" };
  const SIGNALS = ["category", "name", "brand", "shop", "capacity", "color", "size", "price", "image"];
  const FIELDS = ["name", "brand", "category", "price", "image", "productId", "gtin"];
  const VIA = ["site", "ld", "og"];

  function host(url) {
    try {
      return new URL(String(url || "")).hostname.toLowerCase().replace(/^(www|m)\./, "");
    } catch {
      return "";
    }
  }

  // The shape of the address without anything in it: numbers and ids become placeholders, the query and
  // any free text (search words, names) are dropped. "/vp/products/123?q=x" → "/vp/products/{n}".
  function pathTemplate(url) {
    let path;
    try {
      path = new URL(String(url || "")).pathname;
    } catch {
      return "";
    }
    return `/${path
      .split("/")
      .filter(Boolean)
      .slice(0, 6)
      .map((seg) => {
        if (/^\d+$/.test(seg)) return "{n}";
        if (/^[a-z][a-z-]{0,19}$/.test(seg)) return seg;
        if (/^[A-Za-z0-9_-]{4,40}$/.test(seg) && /\d/.test(seg)) return "{id}";
        return "{s}";
      })
      .join("/")}`;
  }

  // Two levels at most, each cut short: breadcrumbs sometimes end in the product name.
  function categoryHead(c) {
    return String(c || "")
      .split(">")
      .map((s) => s.trim().slice(0, 24))
      .filter(Boolean)
      .slice(0, 2)
      .join(" > ");
  }

  function pct(n) {
    const v = Number(n);
    return n == null || !Number.isFinite(v) ? null : Math.max(0, Math.min(100, Math.round(v)));
  }

  // Order of magnitude only. Currencies differ between shops, so the exact amount says little anyway.
  function priceMag(p) {
    const v = Number(p);
    return v > 0 ? Math.min(9, Math.floor(Math.log10(v))) : null;
  }

  function signals(weights) {
    return (Array.isArray(weights) ? weights : [])
      .filter((w) => w && SIGNALS.includes(w.key) && w.points > 0)
      .sort((a, b) => b.points - a.points)
      .map((w) => w.key);
  }

  // Products whose name alone says something private about whoever looked at it.
  const SENSITIVE = /건강|의료|의약|약국|처방|영양제|임신|임테기|배란|출산|성인|19금|콘돔|윤활|성인용품|탈모|발기|피임|생리|요실금|치질|정신|우울|health|medical|pharma|medicine|pregnan|ovulat|adult|condom|lubric|sexual|erectile|contracept|incontinen|hemorrhoid|医|药|薬|妊娠|避孕|成人|アダルト/i;

  function sensitive(product) {
    return SENSITIVE.test(`${product.category || ""} ${product.name || ""}`);
  }

  // The name as the shop printed it, with anything that looks like contact details or an order number removed.
  // Only the page's own product: names from the user's records never leave the browser.
  function pageName(product) {
    if (sensitive(product)) return "";
    return String(product.name || "")
      .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, " ")
      .replace(/\+?\d[\d\s-]{7,}\d/g, " ")
      .replace(/\d{6,}/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
  }

  // Per-factor scores of one comparison: the features a weight model trains on.
  function scores(weights) {
    const out = {};
    for (const w of Array.isArray(weights) ? weights : []) {
      if (w && SIGNALS.includes(w.key) && pct(w.score) != null) out[w.key] = pct(w.score);
    }
    return out;
  }

  function imagePercent(row) {
    return row && row.visual ? pct(row.visual.percent) : null;
  }

  const SHAPES = {
    extract({ product }) {
      if (!product) return null;
      const via = product.via || {};
      return {
        host: host(product.url),
        path: pathTemplate(product.url),
        fields: Object.fromEntries(FIELDS.map((k) => [k, Boolean(product[k])])),
        via: VIA.filter((k) => via[k]),
        images: Math.min(Array.isArray(product.images) ? product.images.length : 0, 30),
        collectible: Boolean(product.collectible),
      };
    },
    match({ product, result, bundle }) {
      if (!product || !result) return null;
      const exact = Array.isArray(result.exact) ? result.exact : [];
      const similar = Array.isArray(result.similar) ? result.similar : [];
      const top = exact[0] || similar[0] || null;
      return {
        host: host(product.url),
        path: pathTemplate(product.url),
        category: categoryHead(product.category),
        collectible: Boolean(product.collectible),
        exact: exact.length,
        similar: similar.length,
        top: top ? pct(top.percent) : null,
        signals: top && !top.exact ? signals(top.weights) : [],
        image: imagePercent(top),
        bundle: bundle ? pct(bundle.percent) : null,
      };
    },
    feedback({ product, row, correct }) {
      if (!product || !row || typeof correct !== "boolean") return null;
      const name = pageName(product);
      return {
        host: host(product.url),
        ...(name ? { name } : {}),
        category: categoryHead(product.category),
        collectible: Boolean(product.collectible),
        correct,
        exact: Boolean(row.exact),
        percent: pct(row.percent),
        signals: row.exact ? [] : signals(row.weights),
        scores: row.exact ? {} : scores(row.weights),
        image: imagePercent(row),
      };
    },
    // Two pages looked at one after the other, built in the browser so the server never has to link events.
    // Both sides are pages the user viewed; owned items only show up as the overlap flags.
    pair({ a, b }) {
      if (!a || !b) return null;
      const nameA = pageName(a);
      const nameB = pageName(b);
      if (!nameA || !nameB) return null;
      const where = String(b.host || "").toLowerCase();
      return {
        host: /^[a-z0-9.-]{1,100}$/.test(where) ? where : "",
        a: nameA,
        b: nameB,
        categoryA: categoryHead(a.category),
        categoryB: categoryHead(b.category),
        overlapA: Boolean(a.overlap),
        overlapB: Boolean(b.overlap),
      };
    },
    record({ item, duplicate }) {
      if (!item) return null;
      return {
        host: host(item.url),
        category: categoryHead(item.category),
        purpose: item.status === "candidate" ? "candidate" : item.purpose === "gift" ? "gift" : "self",
        duplicate: Boolean(duplicate),
        priceMag: priceMag(item.price),
      };
    },
  };

  function consentOf(raw) {
    const c = raw && typeof raw === "object" ? raw : {};
    const decided = c.version === CONSENT_VERSION;
    const stats = decided && c.stats === true;
    return {
      decided,
      stats,
      model: stats && c.model === true,
      age: stats && AGES.includes(c.age) ? c.age : null,
      gender: stats && GENDERS.includes(c.gender) ? c.gender : null,
    };
  }

  function makeConsent({ stats, model, age, gender }, now = Date.now()) {
    const on = Boolean(stats);
    return {
      version: CONSENT_VERSION,
      stats: on,
      model: on && Boolean(model),
      age: on && AGES.includes(age) ? age : null,
      gender: on && GENDERS.includes(gender) ? gender : null,
      at: new Date(now).toISOString().slice(0, 10),
    };
  }

  // One event, or null when it must not be kept. The day is the only clock: no hour, no session, no device id.
  function event(type, data, consent, now = Date.now()) {
    if (!consentOf(consent).stats || !Object.prototype.hasOwnProperty.call(SHAPES, type)) return null;
    const body = SHAPES[type](data || {});
    if (!body || !body.host) return null;
    return { type, day: new Date(now).toISOString().slice(0, 10), ...body };
  }

  // Demographics and the model flag ride on the batch, read at send time, so a later change of mind
  // also covers events still waiting in the queue.
  function batch(events, consent, ctx = {}) {
    const c = consentOf(consent);
    if (!c.stats || !Array.isArray(events) || !events.length) return null;
    return {
      schema: SCHEMA,
      v: String(ctx.version || ""),
      lang: String(ctx.lang || ""),
      model: c.model,
      ...(c.age ? { age: c.age } : {}),
      ...(c.gender ? { gender: c.gender } : {}),
      events,
    };
  }

  const api = { ENDPOINT, CONSENT_VERSION, AGES, GENDERS, AGE_LABEL, GENDER_LABEL, host, pathTemplate, categoryHead, pageName, consentOf, makeConsent, event, batch };
  root.ItememTelemetry = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
