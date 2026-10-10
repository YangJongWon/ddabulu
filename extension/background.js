importScripts("lib/similarity.js", "lib/bundle.js", "lib/telemetry.js", "lib/recs.js");

const Sim = globalThis.ItememSim;
const Bundle = globalThis.ItememBundle;
const Tel = globalThis.ItememTelemetry;
const Recs = globalThis.ItememRecs;

const LINE_CDN = "https://stickershop.line-scdn.net";

function linePackageId(p) {
  const m = String(p.url || "").match(/store\.line\.me\/stickershop\/product\/(\d+)/);
  return m ? m[1] : null;
}

async function imageHash(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`이미지 ${res.status}`);
  const bmp = await createImageBitmap(await res.blob());
  const W = 16;
  const H = 16;
  const canvas = new OffscreenCanvas(W + 1, H);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W + 1, H);
  ctx.drawImage(bmp, 0, 0, W + 1, H);
  bmp.close();
  const px = ctx.getImageData(0, 0, W + 1, H).data;
  const gray = new Float32Array((W + 1) * H);
  for (let i = 0; i < gray.length; i++) gray[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  return Bundle.dhash(gray, W, H);
}

async function mapLimit(list, limit, fn) {
  const out = new Array(list.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, list.length) }, async () => {
      while (next < list.length) {
        const i = next++;
        out[i] = await fn(list[i]);
      }
    })
  );
  return out;
}

async function linePackage(product) {
  const pkg = linePackageId(product);
  if (!pkg) return null;
  const key = `line:${pkg}`;
  const cached = (await chrome.storage.local.get(key))[key];
  if (cached) return cached;

  const v = (String(product.image || "").match(/[?&]v=(\d+)/) || [])[1];
  let meta = null;
  for (const ver of [...new Set([v, "1", "100"].filter(Boolean))]) {
    const res = await fetch(`${LINE_CDN}/products/0/0/${ver}/${pkg}/android/productInfo.meta`);
    if (res.ok) {
      meta = await res.json();
      break;
    }
  }
  if (!meta || !Array.isArray(meta.stickers)) throw new Error("LINE 패키지 구성 정보를 못 찾았어요");

  const members = await mapLimit(meta.stickers, 8, async (s) => {
    const image = `${LINE_CDN}/stickershop/v1/sticker/${s.id}/android/sticker.png`;
    let hash = null;
    try {
      hash = await imageHash(image);
    } catch {
      // An unreadable image still matches by sticker id.
    }
    return { id: String(s.id), image, hash };
  });
  const kr = (meta.price || []).find((p) => p.country === "KR");
  const data = { key, title: (meta.title && (meta.title.ko || meta.title.en)) || "", price: kr ? kr.price : null, members };
  await chrome.storage.local.set({ [key]: data });
  return data;
}

async function loadItems() {
  const { items = [] } = await chrome.storage.local.get("items");
  return items;
}

function saveItems(items) {
  return chrome.storage.local.set({ items });
}

const FIELDS = ["name", "brand", "category", "price", "image", "images", "shop", "productId", "gtin", "url", "options", "collectible", "purchasedAt", "memo", "members", "packageKey"];

function photoUrls(item) {
  const urls = [];
  if (item.image) urls.push(item.image);
  if (Array.isArray(item.images)) {
    for (const x of item.images) {
      const u = typeof x === "string" ? x : x && x.image;
      if (u) urls.push(u);
    }
  }
  return [...new Set(urls)];
}

// Pictures of the object itself: every stamp, or the product photo(s).
async function ensurePhotos(item) {
  if (linePackageId(item)) {
    if (Array.isArray(item.members) && item.members.length) return { item, images: item.members, changed: false };
    try {
      const next = await withMembers(item);
      return { item: next, images: next.members || [], changed: next !== item };
    } catch {
      return { item, images: [], changed: false };
    }
  }
  const cached = new Map(
    (Array.isArray(item.images) ? item.images : [])
      .filter((x) => x && typeof x === "object" && x.image && x.hash)
      .map((x) => [x.image, x.hash])
  );
  const images = [];
  let changed = false;
  for (const image of photoUrls(item)) {
    let hash = cached.get(image) || null;
    if (!hash) {
      try {
        hash = await imageHash(image);
        changed = true;
      } catch {
        hash = null;
      }
    }
    if (hash) images.push({ id: image, image, hash });
  }
  if (changed) item.images = images.map(({ image, hash }) => ({ image, hash }));
  return { item, images, changed };
}

async function withMembers(item) {
  if (item.members || !linePackageId(item)) return item;
  const pkg = await linePackage(item);
  return { ...item, members: pkg.members, packageKey: pkg.key, price: item.price ?? pkg.price ?? undefined };
}

function clean(input) {
  const out = {};
  for (const k of FIELDS) if (input[k] !== undefined && input[k] !== "") out[k] = input[k];
  if (out.price !== undefined) out.price = Number(out.price) || null;
  if (!out.name || !String(out.name).trim()) throw new Error("상품명이 필요합니다");
  return out;
}

async function loadRecipients() {
  const { recipients = [] } = await chrome.storage.local.get("recipients");
  return Array.isArray(recipients) ? recipients : [];
}

async function listRecipients() {
  const out = [];
  const push = (name) => {
    const cleanName = String(name || "").trim().replace(/\s+/g, " ");
    if (!cleanName || out.some((n) => Sim.samePerson(n, cleanName))) return;
    out.push(cleanName);
  };
  for (const name of await loadRecipients()) push(name);
  for (const it of await loadItems()) if (it.purpose === "gift") push(it.recipient);
  return out;
}

async function rememberRecipient(name) {
  const list = await loadRecipients();
  if (list.some((n) => Sim.samePerson(n, name))) return;
  list.unshift(name);
  await chrome.storage.local.set({ recipients: list });
}

async function record(input) {
  const purpose = input.purpose === "gift" ? "gift" : "self";
  const candidate = input.status === "candidate";
  const recipient = purpose === "gift" ? String(input.recipient || "").trim().replace(/\s+/g, " ") : "";
  if (purpose === "gift" && !recipient) throw new Error("받는 사람을 적어 주세요");

  const prepared = await ensurePhotos(await withMembers(clean(input)));
  const item = prepared.item;
  const items = await loadItems();
  const today = new Date().toISOString().slice(0, 10);
  const shortlisted = Sim.shortlisted(items, item, purpose, recipient);
  const existing = purpose === "self" ? Sim.selfDuplicate(items, item) : Sim.giftDuplicate(items, item, recipient);
  if (existing) return { item: existing, duplicate: true, owned: true, ...(recipient ? { recipient } : {}) };
  if (purpose === "gift") await rememberRecipient(recipient);
  if (candidate) {
    if (shortlisted) return { item: shortlisted, duplicate: true, ...(recipient ? { recipient } : {}) };
    // Not bought, so no purchase date: the form fills one in by default.
    const { purchasedAt, ...rest } = item;
    const created = { id: crypto.randomUUID(), qty: 1, status: "candidate", addedAt: today, ...rest, purpose, ...(recipient ? { recipient } : {}) };
    items.unshift(created);
    await saveItems(items);
    return { item: created, duplicate: false };
  }
  // Buying or giving something on the shortlist turns that entry into the real record.
  if (shortlisted) {
    Object.assign(shortlisted, item, { status: "owned", purchasedAt: item.purchasedAt || today });
    await saveItems(items);
    return { item: shortlisted, duplicate: false, fromCandidate: true };
  }
  const created = {
    id: crypto.randomUUID(),
    qty: 1,
    status: "owned",
    purchasedAt: item.purchasedAt || today,
    ...item,
    purpose,
    ...(recipient ? { recipient } : {}),
  };
  items.unshift(created);
  await saveItems(items);
  return { item: created, duplicate: false };
}

const QUEUE_MAX = 200;
const FLUSH_AT = 20;
const FLUSH_EVERY = 30 * 60 * 1000;
let telLock = Promise.resolve();

// Queue writes come from several tabs at once; one at a time keeps events from overwriting each other.
function serial(fn) {
  const run = telLock.then(fn, fn);
  telLock = run.catch(() => {});
  return run;
}

function track(type, data) {
  return serial(async () => {
    const { consent, telemetryQueue = [], telemetryFlushedAt = 0 } = await chrome.storage.local.get(["consent", "telemetryQueue", "telemetryFlushedAt"]);
    const ev = Tel.event(type, data, consent);
    if (!ev) return;
    const queue = [...telemetryQueue, ev].slice(-QUEUE_MAX);
    await chrome.storage.local.set({ telemetryQueue: queue });
    if (queue.length >= FLUSH_AT || Date.now() - telemetryFlushedAt > FLUSH_EVERY) await flush();
  }).catch(() => {});
}

const PAIR_WINDOW = 30 * 60 * 1000;

function topCategory(c) {
  return Tel.categoryHead(c).split(" > ")[0];
}

// The previous page lives in session storage only (gone when the browser closes), and only long enough to pair it
// with the next one. Pairs stay within one shop or one top category: alternatives, not a browsing trail.
async function notePair(product, result) {
  const name = Tel.pageName(product || {});
  if (!name) return;
  const now = {
    name,
    category: product.category || "",
    host: Tel.host(product.url),
    overlap: Boolean(result && ((result.exact || []).length || (result.similar || []).length)),
    at: Date.now(),
  };
  const { lastView } = await chrome.storage.session.get("lastView");
  await chrome.storage.session.set({ lastView: now });
  if (!lastView || now.at - lastView.at > PAIR_WINDOW) return;
  if (Sim.normalize(lastView.name) === Sim.normalize(now.name)) return;
  const related = lastView.host === now.host || (topCategory(now.category) && topCategory(now.category) === topCategory(lastView.category));
  if (related) track("pair", { a: lastView, b: now });
}

let recsLoading = null;

function refreshRecs() {
  if (!recsLoading) {
    recsLoading = (async () => {
      const res = await fetch(Recs.RECS_URL, { credentials: "omit", cache: "no-cache" });
      if (!res.ok) return;
      const table = await res.json();
      if (table && table.schema === 1) await chrome.storage.local.set({ recs: { at: Date.now(), table } });
    })().catch(() => {}).finally(() => { recsLoading = null; });
  }
  return recsLoading;
}

// Uses the copy on hand and refreshes it in the background once it is a day old.
async function recsTable() {
  if (!Recs.RECS_URL) return null;
  const { recs } = await chrome.storage.local.get("recs");
  if (!recs || Date.now() - recs.at > Recs.MAX_AGE) refreshRecs();
  return recs ? recs.table : null;
}

// After a failed send, wait this long before trying again instead of retrying on every new event.
const RETRY_AFTER = 30 * 60 * 1000;

async function flush() {
  if (!Tel.ENDPOINT) return;
  const { consent, telemetryQueue = [], lang = "system", telemetryRetryAt = 0 } = await chrome.storage.local.get(["consent", "telemetryQueue", "lang", "telemetryRetryAt"]);
  if (Date.now() < telemetryRetryAt) return;
  if (!Tel.consentOf(consent).stats) {
    await chrome.storage.local.set({ telemetryQueue: [] });
    return;
  }
  const body = Tel.batch(telemetryQueue, consent, {
    version: chrome.runtime.getManifest().version,
    lang: lang === "system" ? String(chrome.i18n.getUILanguage() || "").slice(0, 2) : lang,
  });
  if (!body) return;
  const res = await fetch(Tel.ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "omit",
    body: JSON.stringify(body),
  }).catch(() => null);
  // Down, over its daily ceiling (429), or unreachable: keep the queue (it is capped) and back off.
  if (!res || !res.ok) {
    await chrome.storage.local.set({ telemetryRetryAt: Date.now() + RETRY_AFTER });
    return;
  }
  const { telemetryQueue: now = [] } = await chrome.storage.local.get("telemetryQueue");
  await chrome.storage.local.set({ telemetryQueue: now.slice(telemetryQueue.length), telemetryFlushedAt: Date.now() });
}

async function setBadge(tabId, result) {
  if (tabId === undefined) return;
  const n = result.exact.length || result.similar.length;
  await chrome.action.setBadgeText({ tabId, text: n ? String(n) : "" });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: result.exact.length ? "#d93025" : "#e8710a" });
}

const handlers = {
  async check({ product }, sender) {
    const items = await loadItems();
    const result = Sim.check(product, items);
    const current = await ensurePhotos(product);
    let changed = false;
    for (let i = 0; i < items.length; i++) {
      if (!Sim.active(items[i])) continue;
      const got = await ensurePhotos(items[i]);
      if (got.changed) {
        items[i] = got.item;
        changed = true;
      }
      const owned = items[i];
      if (result.exact.some((r) => r.item.id === owned.id)) continue;
      const score = Bundle.scorePackage(current.images, { id: owned.id, name: owned.name, members: got.images });
      if (!score) continue;
      const visual = { percent: score.percent, counted: score.counted, stickers: score.stickers };
      const row = result.similar.find((r) => r.item.id === owned.id);
      if (row) {
        Object.assign(row, Sim.includeImage(row, score.percent));
        row.item = owned;
        row.visual = visual;
      } else if (score.percent >= 50) {
        result.similar.push({ item: owned, ...Sim.includeImage(Sim.compare(product, owned), score.percent), visual });
      }
    }
    result.similar.sort((a, b) => b.percent - a.percent);
    // Not a warning: the page is something already on the shortlist.
    result.shortlist = items
      .filter(Sim.isCandidate)
      .map((c) => ({ item: { id: c.id, name: c.name, purpose: c.purpose, recipient: c.recipient || "" }, ...Sim.compare(product, c) }))
      .filter((r) => r.exact || r.percent >= 70)
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 1)
      .map(({ item, percent, exact }) => ({ item, percent, exact }));
    if (changed) await saveItems(items);
    await setBadge(sender.tab && sender.tab.id, result);
    return result;
  },
  async record({ item }) {
    const res = await record(item);
    track("record", { item: res.item, duplicate: res.duplicate });
    return res;
  },
  // Pages may only report what they saw; match and record events are built here.
  track({ kind, data }) {
    if (kind !== "extract" && kind !== "match" && kind !== "feedback") throw new Error("track");
    track(kind, data);
    if (kind === "match" && data) notePair(data.product, data.result).catch(() => {});
    return true;
  },
  async recs({ product }) {
    const table = await recsTable();
    if (!table) return null;
    const { consent } = await chrome.storage.local.get("consent");
    const c = Tel.consentOf(consent);
    return Recs.pick(table, product, await loadItems(), { age: c.age, gender: c.gender });
  },
  start: () => startTabs(),
  async consent({ consent }) {
    const next = Tel.makeConsent(consent || {});
    await serial(() => chrome.storage.local.set(next.stats ? { consent: next } : { consent: next, telemetryQueue: [] }));
    return next;
  },
  recipients: () => listRecipients(),
  // Each candidate against what is actually held, so the shortlist shows which ones would not double up.
  async candidates() {
    const items = await loadItems();
    return items.filter(Sim.isCandidate).map((c) => {
      const top = Sim.candidateOverlap(c, items);
      return {
        id: c.id,
        percent: top ? top.percent : 0,
        exact: Boolean(top && top.exact),
        band: top ? (top.exact ? "같은 상품" : top.band) : null,
        with: top ? { name: top.item.name, purpose: top.item.purpose, recipient: top.item.recipient || "" } : null,
      };
    });
  },
  async bundle({ product }) {
    const pkg = await linePackage(product);
    if (!pkg) return null;
    const items = await loadItems();
    let changed = false;
    for (let i = 0; i < items.length; i++) {
      if (!Sim.active(items[i]) || items[i].members || !linePackageId(items[i])) continue;
      try {
        items[i] = await withMembers(items[i]);
        changed = true;
      } catch {
        // One unreadable package should not block the rest of the comparison.
      }
    }
    if (changed) await saveItems(items);
    const result = Bundle.overlap(pkg.members, items, { selfKey: pkg.key });
    const price = product.price ?? pkg.price;
    return { ...result, title: pkg.title, price, wasted: price ? Math.round((price * result.owned) / result.total) : null };
  },
  list: () => loadItems(),
  async imageData({ url }) {
    if (!/^https?:\/\//i.test(String(url || ""))) throw new Error("image");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`이미지 ${res.status}`);
    const type = res.headers.get("content-type") || "image/png";
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${type};base64,${btoa(bin)}`;
  },
  async update({ id, patch }) {
    const items = await loadItems();
    const it = items.find((x) => x.id === id);
    if (!it) throw new Error("없는 항목입니다");
    Object.assign(it, patch);
    await saveItems(items);
    return it;
  },
  async remove({ id }) {
    await saveItems((await loadItems()).filter((x) => x.id !== id));
    return true;
  },
  async removeProduct({ id }) {
    const items = await loadItems();
    const target = items.find((x) => x.id === id);
    if (!target) throw new Error("없는 항목입니다");
    const sameOwner = (x) => (target.purpose === "gift"
      ? x.purpose === "gift" && Sim.samePerson(x.recipient, target.recipient)
      : x.purpose !== "gift");
    const keep = items.filter((x) => x.id !== id && !(sameOwner(x) && Sim.isExact(target, x)));
    await saveItems(keep);
    return { removed: items.length - keep.length };
  },
  async import({ items: incoming }) {
    if (!Array.isArray(incoming)) throw new Error("items 배열이 아닙니다");
    const items = await loadItems();
    let added = 0;
    for (const raw of incoming) {
      const it = clean(raw);
      const purpose = raw.purpose === "gift" ? "gift" : "self";
      const recipient = purpose === "gift" ? String(raw.recipient || "").trim().replace(/\s+/g, " ") : "";
      if (purpose === "gift" && !recipient) continue;
      if (purpose === "self" ? Sim.selfDuplicate(items, it) : Sim.giftDuplicate(items, it, recipient)) continue;
      items.push({
        id: raw.id || crypto.randomUUID(),
        qty: raw.qty || 1,
        status: raw.status || "owned",
        purchasedAt: new Date().toISOString().slice(0, 10),
        ...it,
        purpose,
        ...(recipient ? { recipient } : {}),
      });
      added++;
    }
    await saveItems(items);
    return { added, skipped: incoming.length - added };
  },
  async clear(_, sender) {
    if (sender.tab) await chrome.action.setBadgeText({ tabId: sender.tab.id, text: "" });
    return true;
  },
};

// Ask about stats once, up front, instead of inside the first popup.
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== "install") return;
  const [from] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (from) await chrome.storage.local.set({ welcomeFrom: from.id });
  chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?welcome") });
});

// Chrome only injects content scripts into pages loaded after install, so tabs already open get them now.
async function startTabs() {
  const files = chrome.runtime.getManifest().content_scripts[0].js;
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  await Promise.all(tabs.map((t) => chrome.scripting.executeScript({ target: { tabId: t.id }, files }).catch(() => {})));
  const { welcomeFrom } = await chrome.storage.local.get("welcomeFrom");
  if (welcomeFrom === undefined) return;
  await chrome.storage.local.remove("welcomeFrom");
  // Back to the page the user was on when they installed.
  await chrome.tabs.update(welcomeFrom, { active: true }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const handler = handlers[msg && msg.type];
  if (!handler) return false;
  Promise.resolve(handler(msg, sender))
    .then((data) => reply({ ok: true, data }))
    .catch((err) => reply({ ok: false, error: String(err.message || err) }));
  return true;
});
