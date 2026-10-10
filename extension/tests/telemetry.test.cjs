const test = require("node:test");
const assert = require("node:assert/strict");
const Tel = require("../lib/telemetry.js");

const on = { version: Tel.CONSENT_VERSION, stats: true, model: true, age: "30s", gender: "f" };
const product = {
  url: "https://www.coupang.com/vp/products/7334?itemId=9&q=secret",
  name: "스탠리 퀜처 텀블러 887ml",
  brand: "Stanley",
  category: "주방용품 > 텀블러 > 스테인리스 > 스탠리 퀜처 텀블러 887ml 블랙 한정판",
  price: 49000,
  image: "https://img.example.com/a.jpg",
  images: ["https://img.example.com/a.jpg", "https://img.example.com/b.jpg"],
  productId: "7334",
  memo: "엄마 생일",
  via: { site: true, ld: true, og: false },
};
const row = {
  item: { id: "x", name: "내가 산 물건", recipient: "민수", url: "https://shop.example.com/p/1" },
  percent: 82,
  weights: [{ key: "name", score: 91, points: 30 }, { key: "image", score: 88, points: 21 }, { key: "category", score: 100, points: 18 }, { key: "evil", score: 1, points: 99 }],
  visual: { percent: 88 },
};

// Everything the user typed or owns, in any form that could show up in a payload.
const PRIVATE = ["스탠리 퀜처", "Stanley", "7334", "itemId", "secret", "엄마", "내가 산", "민수", "shop.example.com", "img.example.com", "49000", "한정판", "evil"];

// The page's own product name may ride on feedback; nothing else on the list may appear anywhere.
const PAGE_NAME = ["스탠리 퀜처"];

function leaks(obj, allowed = []) {
  const text = JSON.stringify(obj);
  return PRIVATE.filter((s) => !allowed.includes(s) && text.includes(s));
}

test("nothing is kept without opt-in or with an outdated consent", () => {
  assert.equal(Tel.event("extract", { product }, undefined), null);
  assert.equal(Tel.event("extract", { product }, { ...on, stats: false }), null);
  assert.equal(Tel.event("extract", { product }, { ...on, version: Tel.CONSENT_VERSION - 1 }), null);
  assert.equal(Tel.batch([{ type: "extract" }], { ...on, stats: false }), null);
});

test("unknown event types are dropped", () => {
  assert.equal(Tel.event("history", { product }, on), null);
  assert.equal(Tel.event("__proto__", { product }, on), null);
});

test("no event carries names, ids, the query, the owned item, or a recipient", () => {
  const events = [
    Tel.event("extract", { product }, on),
    Tel.event("match", { product, result: { exact: [], similar: [row] } }, on),
    Tel.event("feedback", { product, row, correct: false }, on),
    Tel.event("record", { item: { ...product, purpose: "gift", recipient: "민수" }, duplicate: false }, on),
  ];
  for (const ev of events) {
    assert.ok(ev, "event built");
    assert.deepEqual(leaks(ev, ev.type === "feedback" ? PAGE_NAME : []), [], `${ev.type} leaked`);
  }
  assert.deepEqual(leaks(Tel.batch(events, on, { version: "0.1.0", lang: "ko" }), PAGE_NAME), []);
});

test("feedback keeps the training features and the label", () => {
  const ev = Tel.event("feedback", { product, row, correct: false }, on, Date.UTC(2026, 9, 10, 15, 42));
  assert.deepEqual(ev, {
    type: "feedback",
    day: "2026-10-10",
    host: "coupang.com",
    name: "스탠리 퀜처 텀블러 887ml",
    category: "주방용품 > 텀블러",
    collectible: false,
    correct: false,
    exact: false,
    percent: 82,
    signals: ["name", "image", "category"],
    scores: { name: 91, image: 88, category: 100 },
    image: 88,
  });
});

test("extract reports which fields and sources found the product", () => {
  const ev = Tel.event("extract", { product }, on);
  assert.equal(ev.path, "/vp/products/{n}");
  assert.deepEqual(ev.fields, { name: true, brand: true, category: true, price: true, image: true, productId: true, gtin: false });
  assert.deepEqual(ev.via, ["site", "ld"]);
  assert.equal(ev.images, 2);
});

test("path templates keep the shape and drop ids and free text", () => {
  assert.equal(Tel.pathTemplate("https://smartstore.naver.com/shop/products/123"), "/shop/products/{n}");
  assert.equal(Tel.pathTemplate("https://www.amazon.com/Stanley-Quencher/dp/B0CJZMP7L1/ref=sr_1"), "/{s}/dp/{id}/{s}");
  assert.equal(Tel.pathTemplate("https://shop.example.com/search/블루투스 이어폰"), "/search/{s}");
  assert.equal(Tel.pathTemplate("not a url"), "");
});

test("demographics ride on the batch and only from the allowed buckets", () => {
  const b = Tel.batch([{ type: "x" }], on, { version: "0.1.0", lang: "ko" });
  assert.equal(b.age, "30s");
  assert.equal(b.gender, "f");
  assert.equal(b.model, true);
  const odd = Tel.batch([{ type: "x" }], { ...on, age: "10s", gender: "?" });
  assert.equal("age" in odd, false);
  assert.equal("gender" in odd, false);
});

test("commercial use cannot be on without the stats it needs", () => {
  const c = Tel.makeConsent({ stats: false, model: true, age: "20s", gender: "m" });
  assert.equal(c.model, false);
  assert.equal(c.age, null);
  assert.equal(Tel.consentOf(c).decided, true);
  assert.equal(Tel.consentOf(c).stats, false);
});

test("extract output says which source recognised the page", () => {
  const { extract } = require("../lib/extract.js");
  const doc = {
    title: "",
    querySelector: (sel) => (sel.includes("og:title") ? { getAttribute: () => "텀블러" } : sel.includes("og:type") ? { getAttribute: () => "product" } : null),
    querySelectorAll: () => [],
  };
  const p = extract(doc, "https://shop.example.com/item/9");
  assert.deepEqual(p.via, { site: false, ld: false, og: true });
});

test("feedback carries the page's name, never the owned item's", () => {
  const ev = Tel.event("feedback", { product, row, correct: true }, on);
  assert.equal(ev.name, "스탠리 퀜처 텀블러 887ml");
  assert.ok(!JSON.stringify(ev).includes(row.item.name));
});

test("sensitive products send no name at all", () => {
  for (const p of [
    { ...product, name: "얼리 임신테스트기 5개입", category: "생활 > 위생용품" },
    { ...product, name: "비타민C 1000", category: "건강식품 > 영양제" },
    { ...product, name: "Ultra Thin Condoms 12ct", category: "Health & Household" },
  ]) {
    const ev = Tel.event("feedback", { product: p, row, correct: true }, on);
    assert.equal("name" in ev, false, p.name);
  }
});

test("page names lose contact details and long numbers", () => {
  assert.equal(Tel.pageName({ name: "주문 20261010123456 텀블러 문의 010-1234-5678 a@b.com" }), "주문 텀블러 문의");
  assert.equal(Tel.pageName({ name: "x".repeat(200) }).length, 80);
});

test("pairs carry two viewed names and overlap flags, nothing about owned items", () => {
  const a = { name: "스탠리 퀜처 텀블러 887ml", category: "주방용품 > 텀블러 > 스테인리스", host: "coupang.com", overlap: true };
  const b = { name: "써모스 보온병 500ml 주문 20261010123456", category: "주방용품 > 보온병", host: "coupang.com", overlap: false };
  const ev = Tel.event("pair", { a, b }, on, Date.UTC(2026, 9, 10));
  assert.deepEqual(ev, {
    type: "pair",
    day: "2026-10-10",
    host: "coupang.com",
    a: "스탠리 퀜처 텀블러 887ml",
    b: "써모스 보온병 500ml 주문",
    categoryA: "주방용품 > 텀블러",
    categoryB: "주방용품 > 보온병",
    overlapA: true,
    overlapB: false,
  });
});

test("a pair with a sensitive side is not kept", () => {
  const a = { name: "텀블러", category: "주방", host: "x.com" };
  const b = { name: "임신테스트기", category: "생활", host: "x.com" };
  assert.equal(Tel.event("pair", { a, b }, on), null);
  assert.equal(Tel.event("pair", { a, b: { ...a, host: "not a host!" } }, on), null);
});
