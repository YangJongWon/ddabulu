(function (root) {
  // A public table the server rebuilds once a day from pair and feedback events. The browser downloads the whole
  // table and picks from it locally, so the server never learns which page anyone is looking at.
  // Empty means no recommendations are shown.
  //
  // {
  //   "schema": 1,
  //   "pairs":      { "<Sim.normalize(name)>": [{ "name", "category", "n" }, …] },   // both directions indexed
  //   "categories": { "<categoryHead>": { "all" | "<age>" | "<age>-<gender>": [{ "name", "category", "n" }, …] } }
  // }
  // Only rows seen often enough over several days belong in it; sensitive categories never do.
  // https://api.ddabulu.com/v1/recs.json once server/ is deployed.
  const RECS_URL = "";
  const MAX_AGE = 24 * 60 * 60 * 1000;
  const LIMIT = 3;
  // Name likeness at or above this means the same product (another listing, size, or color of it).
  // The full score is no use here: a table row has only a name and a category, and a shared category alone
  // already lands two different products near 50%.
  const SAME = 0.7;
  // Stricter: picking whose neighbours to borrow should only bridge naming differences.
  const NEAR = 0.85;

  const Sim = root.ItememSim || (typeof require === "function" ? require("./similarity.js") : null);
  const Tel = root.ItememTelemetry || (typeof require === "function" ? require("./telemetry.js") : null);
  const own = (obj, key) => Boolean(obj) && typeof obj === "object" && Object.prototype.hasOwnProperty.call(obj, key);

  function clean(entry) {
    if (!entry || typeof entry.name !== "string") return null;
    const name = entry.name.trim().slice(0, 80);
    const category = typeof entry.category === "string" ? entry.category.slice(0, 60) : "";
    // The client applies the same sensitivity rule again rather than trusting the table.
    if (!name || !Tel.pageName({ name, category })) return null;
    return { name, category };
  }

  function segments(profile) {
    const out = [];
    if (profile.age && profile.gender) out.push(`${profile.age}-${profile.gender}`);
    if (profile.age) out.push(profile.age);
    out.push("all");
    return out;
  }

  // Shops name the same product a little differently, so an exact key falls back to the closest name in the table.
  function pairKey(pairs, name) {
    if (!pairs || typeof pairs !== "object") return null;
    const exact = Sim.normalize(name);
    if (own(pairs, exact)) return exact;
    let best = null;
    let score = NEAR;
    for (const key of Object.keys(pairs).slice(0, 10000)) {
      const s = Sim.tokenSetRatio(key, exact);
      if (s >= score) {
        best = key;
        score = s;
      }
    }
    return best;
  }

  // Alternatives that overlap neither the page nor anything the user still has.
  function pick(table, product, owned, profile = {}, limit = LIMIT) {
    if (!table || table.schema !== 1 || !product || !product.name) return null;
    const held = (Array.isArray(owned) ? owned : []).filter(Sim.active);
    const seen = new Set([Sim.normalize(product.name)]);
    const same = (c, it) => Sim.tokenSetRatio(c.name, it.name) >= SAME;
    const fresh = (c) => !same(c, product) && !held.some((it) => same(c, it));
    const take = (list) => {
      const out = [];
      for (const raw of Array.isArray(list) ? list.slice(0, 50) : []) {
        const c = clean(raw);
        if (!c || seen.has(Sim.normalize(c.name))) continue;
        seen.add(Sim.normalize(c.name));
        if (fresh(c)) out.push(c);
        if (out.length >= limit) break;
      }
      return out;
    };

    const key = pairKey(table.pairs, product.name);
    if (key) {
      const items = take(table.pairs[key]);
      if (items.length) return { kind: "pair", segment: "all", items };
    }
    const cat = Tel.categoryHead(product.category);
    if (cat && own(table.categories, cat)) {
      for (const seg of segments(profile)) {
        if (!own(table.categories[cat], seg)) continue;
        const items = take(table.categories[cat][seg]);
        if (items.length) return { kind: "popular", segment: seg, items };
      }
    }
    return null;
  }

  const api = { RECS_URL, MAX_AGE, pick };
  root.ItememRecs = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
