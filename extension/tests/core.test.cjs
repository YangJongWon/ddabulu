const test = require("node:test");
const assert = require("node:assert/strict");
const Sim = require("../lib/similarity.js");
const { extract } = require("../lib/extract.js");

const owned = [
  { id: "a", name: "스탠리 퀜처 텀블러 887ml 블랙", brand: "Stanley", category: "주방 > 텀블러", price: 49000, shop: "쿠팡", url: "https://www.coupang.com/vp/products/111" },
  { id: "b", name: "LINE 브라운 앤 코니 스탬프", category: "디지털 > 라인 스탬프", shop: "LINE STORE", productId: "1234", url: "https://store.line.me/stickershop/product/1234/ko" },
  { id: "c", name: "고무장갑 대형", category: "생활 > 청소용품", price: 3000 },
];

test("same product written differently scores 90%+", () => {
  const r = Sim.compare({ name: "[스탠리] 퀜처 H2.0 텀블러 887ml 블랙", brand: "STANLEY", category: "주방용품 > 텀블러", price: 52000 }, owned[0]);
  assert.ok(r.percent >= 90, `got ${r.percent}`);
  assert.ok(r.same.includes("브랜드") && r.same.includes("용량"));
});

test("same category and capacity, other brand and color lands in 50-89%", () => {
  const r = Sim.compare({ name: "써모스 보온 텀블러 887ml 화이트", brand: "Thermos", category: "주방 > 텀블러", price: 30000 }, owned[0]);
  assert.ok(r.percent >= 50 && r.percent < 90, `got ${r.percent}`);
  assert.ok(r.diff.includes("브랜드") && r.diff.includes("색상") && r.same.includes("용량"));
});

test("same category but every attribute different is not flagged", () => {
  const r = Sim.compare({ name: "써모스 보온 텀블러 500ml 화이트", brand: "Thermos", category: "주방 > 텀블러", price: 30000 }, owned[0]);
  assert.ok(r.percent < 50, `got ${r.percent}`);
});

test("different category stays under 50%", () => {
  const r = Sim.compare({ name: "블랙 캠핑 의자", brand: "Helinox", category: "캠핑 > 의자", price: 120000 }, owned[0]);
  assert.ok(r.percent < 50, `got ${r.percent}`);
});

test("same store product id is an exact duplicate, URL language suffix ignored", () => {
  const r = Sim.check({ name: "브라운 스탬프", shop: "LINE STORE", productId: "1234", url: "https://store.line.me/stickershop/product/1234/en" }, owned);
  assert.equal(r.exact.length, 1);
  assert.equal(r.exact[0].item.id, "b");
});

test("emoticon packs are not flagged just for sharing a category", () => {
  const r = Sim.check({ name: "문 & 제임스", category: "디지털 > 라인 스탬프", shop: "LINE STORE", productId: "1", collectible: true }, owned);
  assert.equal(r.similar.length + r.exact.length, 0);
});

test("disposed items are not reported", () => {
  const items = owned.map((o) => (o.id === "a" ? { ...o, status: "disposed" } : o));
  const r = Sim.check({ name: "스탠리 텀블러 887ml 블랙", brand: "Stanley", category: "주방 > 텀블러" }, items);
  assert.equal(r.similar.length + r.exact.length, 0);
});

function fakeDoc(html) {
  const metas = [...html.matchAll(/<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"/g)];
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  return {
    title: (html.match(/<title>(.*?)<\/title>/) || [])[1] || "",
    querySelector(sel) {
      const key = sel.match(/="([^"]+)"/)[1];
      const m = metas.find((x) => x[1] === key);
      return m ? { getAttribute: () => m[2] } : null;
    },
    querySelectorAll() {
      return scripts.map((s) => ({ textContent: s[1] }));
    },
  };
}

test("extracts JSON-LD product inside @graph with offers and breadcrumb", () => {
  const html = `<title>x</title><script type="application/ld+json">{"@graph":[
    {"@type":"BreadcrumbList","itemListElement":[{"name":"주방"},{"name":"텀블러"}]},
    {"@type":"Product","name":"스탠리 텀블러","brand":{"name":"Stanley"},"image":["/a.jpg"],"sku":"S1",
     "offers":{"@type":"Offer","price":"49,000"}}]}</script>`;
  const p = extract(fakeDoc(html), "https://shop.example.com/item/9");
  assert.equal(p.name, "스탠리 텀블러");
  assert.equal(p.brand, "Stanley");
  assert.equal(p.category, "주방 > 텀블러");
  assert.equal(p.price, 49000);
  assert.equal(p.image, "https://shop.example.com/a.jpg");
  assert.equal(p.productId, "S1");
});

test("known store URL works from OpenGraph alone", () => {
  const html = `<meta property="og:title" content="브라운 스탬프"><meta property="og:image" content="https://cdn.line/x.png">`;
  const p = extract(fakeDoc(html), "https://store.line.me/stickershop/product/1234/ko");
  assert.equal(p.productId, "1234");
  assert.equal(p.shop, "LINE STORE");
  assert.equal(p.collectible, true);
});

test("ordinary pages are ignored", () => {
  assert.equal(extract(fakeDoc(`<title>뉴스</title><meta property="og:type" content="article">`), "https://news.example.com/1"), null);
});
