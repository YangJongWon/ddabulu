const test = require("node:test");
const assert = require("node:assert/strict");
const Sim = require("../lib/similarity.js");
const I18n = require("../lib/i18n.js");
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

test("category, name, brand, capacity, color, size, and price are all listed", () => {
  const r = Sim.compare(
    { name: "써모스 보온 텀블러 887ml 화이트", brand: "Thermos", category: "주방 > 텀블러", price: 30000 },
    owned[0]
  );
  assert.deepEqual(r.details.map((d) => d.key), ["category", "name", "brand", "shop", "capacity", "color", "size", "price"]);
  assert.equal(r.details.find((d) => d.key === "category").percent, 100);
  assert.match(r.details.find((d) => d.key === "category").because, /마지막 분류/);
  assert.match(r.details.find((d) => d.key === "category").left, /텀블러/);
  assert.equal(r.details.find((d) => d.key === "brand").percent, 0);
  assert.equal(r.details.find((d) => d.key === "capacity").percent, 100);
  assert.equal(r.details.find((d) => d.key === "color").percent, 0);
  assert.ok(r.details.find((d) => d.key === "price").percent != null);
  assert.ok(r.details.find((d) => d.key === "name").percent != null);
});

test("a factor with no data stays on the list and is left out of the composite", () => {
  const r = Sim.compare({ name: "텀블러", category: "주방 > 텀블러" }, { name: "텀블러", category: "주방 > 텀블러" });
  assert.deepEqual(r.details.map((d) => d.key), ["category", "name", "brand", "shop", "capacity", "color", "size", "price"]);
  assert.equal(r.details.find((d) => d.key === "price").percent, null);
  assert.equal(r.details.find((d) => d.key === "shop").percent, null);
  assert.equal(r.details.find((d) => d.key === "brand").percent, null);
  assert.equal(r.percent, 100);
});

test("weight rows add up to the composite", () => {
  const r = Sim.compare(
    { name: "jersey chan", category: "디지털 > 라인 스탬프", price: 2500, shop: "LINE STORE" },
    { name: "Melon jersey", category: "디지털 > 라인 스탬프", price: 3300, shop: "LINE STORE" }
  );
  assert.equal(r.weights.reduce((s, w) => s + w.points, 0), r.percent);
  assert.equal(r.weights.reduce((s, w) => s + w.applied, 0), 100);
  assert.ok(r.weights.some((w) => w.key === "shop" && w.score === 100));
  assert.ok(r.omitted.some((o) => o.key === "brand"));
  assert.ok(r.omitted.some((o) => o.key === "image"));
});

test("shop and image scores are both inside the composite", () => {
  const r = Sim.compare(
    { name: "jersey chan", category: "디지털 > 라인 스탬프", price: 2500, shop: "LINE STORE" },
    { name: "Melon jersey", category: "디지털 > 라인 스탬프", price: 3300, shop: "LINE STORE" }
  );
  const low = Sim.includeImage(r, 27);
  const same = Sim.includeImage(r, 100);
  assert.ok(low.weights.some((w) => w.key === "shop" && w.score === 100));
  assert.ok(low.weights.some((w) => w.key === "image" && w.score === 27));
  assert.ok(low.percent < r.percent);
  assert.ok(same.percent > low.percent);
  const stampImage = low.weights.find((w) => w.key === "image");
  assert.equal(stampImage.weight, 50);
  const goods = Sim.includeImage(
    Sim.compare(
      { name: "텀블러", category: "주방 > 텀블러", price: 30000 },
      { name: "텀블러", category: "주방 > 텀블러", price: 32000 }
    ),
    27
  );
  assert.equal(goods.weights.find((w) => w.key === "image").weight, 24);
  assert.ok(stampImage.weight > goods.weights.find((w) => w.key === "image").weight);
  assert.equal(low.weights.reduce((s, w) => s + w.points, 0), low.percent);
  assert.equal(low.weights.reduce((s, w) => s + w.applied, 0), 100);
  assert.ok(!low.omitted.some((o) => o.key === "shop" || o.key === "image"));
});

test("same shop is 100 and keeps both store names", () => {
  const r = Sim.compare({ name: "a", shop: "LINE STORE" }, { name: "b", shop: "LINE STORE" });
  const shop = r.details.find((d) => d.key === "shop");
  assert.equal(shop.percent, 100);
  assert.equal(shop.left, "LINE STORE");
  assert.equal(shop.right, "LINE STORE");
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

test("language follows the system unless a supported language is chosen", () => {
  assert.equal(I18n.resolve("system", "ko-KR"), "ko");
  assert.equal(I18n.resolve("system", "zh-TW"), "zh");
  assert.equal(I18n.resolve("system", "ja"), "ja");
  assert.equal(I18n.resolve("system", "en-US"), "en");
  assert.equal(I18n.resolve("en", "ko-KR"), "en");
  assert.equal(I18n.t("ko", "비슷한 걸 갖고 있어요 - MY"), "비슷한 걸 갖고 있어요 - MY");
  assert.equal(I18n.t("ja", "비슷한 걸 선물 했어요 - {who}", { who: "ミナミ" }), "似たものを贈りました - ミナミ");
  assert.equal(I18n.t("zh", "{n}명", { n: 2 }), "2人");
  assert.equal(I18n.t("en", "샀어요"), "Bought");
  assert.equal(I18n.t("zh", "선물했어요"), "送了");
  assert.equal(I18n.t("ja", "같은 종류"), "同じ種類");
  assert.equal(I18n.t("en", "cat-last", { name: "스탬프" }), "The last category “스탬프” matches");
});

test("ordinary pages are ignored", () => {
  assert.equal(extract(fakeDoc(`<title>뉴스</title><meta property="og:type" content="article">`), "https://news.example.com/1"), null);
});

test("a gift stays in the match list and is named by recipient", () => {
  const gift = { id: "g", purpose: "gift", recipient: "민수", name: "브라운 스탬프", shop: "LINE STORE", productId: "1234", url: "https://store.line.me/stickershop/product/1234/ko" };
  const mine = { id: "m", purpose: "self", name: "브라운 스탬프", shop: "LINE STORE", productId: "999", url: "https://store.line.me/stickershop/product/999/ko" };
  const other = { id: "o", purpose: "gift", recipient: "지수", name: "다른 스탬프", shop: "LINE STORE", productId: "888", url: "https://store.line.me/stickershop/product/888/ko" };
  const r = Sim.check({ name: "브라운 스탬프", shop: "LINE STORE", productId: "1234" }, [gift]);
  assert.equal(r.exact.length, 1);
  assert.equal(r.exact[0].item.purpose, "gift");
  assert.deepEqual(Sim.audience(r.exact), { mine: false, gifts: ["민수"] });
  assert.deepEqual(Sim.audience([{ item: mine }, { item: gift }, { item: other }]), { mine: true, gifts: ["민수", "지수"] });
});

test("the same product can be gifted again only to a different person", () => {
  const item = { name: "텀블러", shop: "쿠팡", productId: "111", url: "https://www.coupang.com/vp/products/111" };
  const held = { id: "a", purpose: "self", ...item };
  const toMinsu = { id: "g", purpose: "gift", recipient: "민수", ...item };
  assert.equal(Sim.selfDuplicate([held], item).id, "a");
  assert.equal(Sim.giftDuplicate([toMinsu], item, "민 수").id, "g");
  assert.equal(Sim.giftDuplicate([toMinsu], item, "민수").id, "g");
  assert.equal(Sim.giftDuplicate([toMinsu], item, "지수"), null);
  assert.equal(Sim.selfDuplicate([{ ...held, status: "disposed" }], item), null);
});

test("candidates never count as owned", () => {
  const cand = { ...owned[0], id: "c", status: "candidate" };
  const page = { name: "스탠리 퀜처 텀블러 887ml 블랙", brand: "Stanley", category: "주방 > 텀블러", url: "https://www.coupang.com/vp/products/111" };
  const r = Sim.check(page, [cand]);
  assert.equal(r.exact.length + r.similar.length, 0);
  assert.equal(Sim.selfDuplicate([cand], page), null);
  assert.equal(Sim.active(cand), false);
  assert.equal(Sim.isCandidate(cand), true);
  assert.deepEqual(Sim.audience([{ item: cand }]), { mine: false, gifts: [] });
});

test("a candidate is checked against what is actually held", () => {
  const cand = { id: "c", status: "candidate", name: "써모스 보온 텀블러 887ml 블랙", brand: "Thermos", category: "주방 > 텀블러" };
  const r = Sim.check(cand, [cand, ...owned], 1);
  const top = r.exact[0] || r.similar[0];
  assert.equal(top.item.id, "a");
});

test("a gift candidate only overlaps what that person already got", () => {
  const tumbler = { name: "스탠리 퀜처 텀블러 887ml 블랙", brand: "Stanley", category: "주방 > 텀블러", url: "https://www.coupang.com/vp/products/111" };
  const mine = { id: "m", purpose: "self", ...tumbler };
  const toJisu = { id: "j", purpose: "gift", recipient: "지수", ...tumbler };
  const forMinsu = { id: "c1", status: "candidate", purpose: "gift", recipient: "민수", ...tumbler };
  const forJisu = { id: "c2", status: "candidate", purpose: "gift", recipient: "지 수", ...tumbler };
  assert.equal(Sim.candidateOverlap(forMinsu, [mine, toJisu]), null);
  assert.equal(Sim.candidateOverlap(forJisu, [mine, toJisu]).item.id, "j");
  const selfCand = { id: "c3", status: "candidate", purpose: "self", ...tumbler };
  assert.equal(Sim.candidateOverlap(selfCand, [mine]).item.id, "m");
});

test("buying or giving fulfils only the matching shortlist entry", () => {
  const item = { name: "브라운 스탬프", shop: "LINE STORE", productId: "1234", url: "https://store.line.me/stickershop/product/1234/ko" };
  const forMinsu = { id: "g", status: "candidate", purpose: "gift", recipient: "민수", ...item };
  const forMe = { id: "s", status: "candidate", purpose: "self", ...item };
  const list = [forMinsu, forMe];
  assert.equal(Sim.shortlisted(list, item, "self", "").id, "s");
  assert.equal(Sim.shortlisted(list, item, "gift", "민 수").id, "g");
  assert.equal(Sim.shortlisted(list, item, "gift", "지수"), null);
  assert.equal(Sim.shortlisted([{ ...forMe, status: "owned" }], item, "self", ""), null);
});
