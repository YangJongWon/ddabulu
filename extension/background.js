importScripts("lib/similarity.js", "lib/bundle.js");

const Sim = globalThis.ItememSim;
const Bundle = globalThis.ItememBundle;

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

const FIELDS = ["name", "brand", "category", "price", "image", "shop", "productId", "gtin", "url", "options", "collectible", "purchasedAt", "memo", "members", "packageKey"];

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

async function record(input) {
  const item = await withMembers(clean(input));
  const items = await loadItems();
  const existing = items.find((it) => Sim.isExact(item, it));
  if (existing) {
    Object.assign(existing, item, { qty: (existing.qty || 1) + 1, status: "owned" });
    await saveItems(items);
    return { item: existing, updated: true };
  }
  const created = {
    id: crypto.randomUUID(),
    qty: 1,
    status: "owned",
    purchasedAt: item.purchasedAt || new Date().toISOString().slice(0, 10),
    ...item,
  };
  items.unshift(created);
  await saveItems(items);
  return { item: created, updated: false };
}

async function setBadge(tabId, result) {
  if (tabId === undefined) return;
  const n = result.exact.length || result.similar.length;
  await chrome.action.setBadgeText({ tabId, text: n ? String(n) : "" });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: result.exact.length ? "#d93025" : "#e8710a" });
}

const handlers = {
  async check({ product }, sender) {
    const result = Sim.check(product, await loadItems());
    await setBadge(sender.tab && sender.tab.id, result);
    return result;
  },
  record: ({ item }) => record(item),
  async bundle({ product }) {
    const pkg = await linePackage(product);
    if (!pkg) return null;
    const result = Bundle.overlap(pkg.members, await loadItems(), { selfKey: pkg.key });
    const price = product.price ?? pkg.price;
    return { ...result, title: pkg.title, price, wasted: price ? Math.round((price * result.owned) / result.total) : null };
  },
  list: () => loadItems(),
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
  async import({ items: incoming }) {
    if (!Array.isArray(incoming)) throw new Error("items 배열이 아닙니다");
    const items = await loadItems();
    let added = 0;
    for (const raw of incoming) {
      const it = clean(raw);
      if (items.some((x) => Sim.isExact(it, x))) continue;
      items.push({
        id: raw.id || crypto.randomUUID(),
        qty: raw.qty || 1,
        status: raw.status || "owned",
        purchasedAt: new Date().toISOString().slice(0, 10),
        ...it,
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

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const handler = handlers[msg && msg.type];
  if (!handler) return false;
  Promise.resolve(handler(msg, sender))
    .then((data) => reply({ ok: true, data }))
    .catch((err) => reply({ ok: false, error: String(err.message || err) }));
  return true;
});
