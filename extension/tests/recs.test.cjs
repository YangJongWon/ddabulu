const test = require("node:test");
const assert = require("node:assert/strict");
const Sim = require("../lib/similarity.js");
globalThis.ItememSim = Sim;
globalThis.ItememTelemetry = require("../lib/telemetry.js");
const Recs = require("../lib/recs.js");

const page = { name: "스탠리 퀜처 텀블러 887ml 블랙", category: "주방용품 > 텀블러 > 스테인리스" };
const owned = [{ id: "o", name: "락앤락 밀폐용기 세트 4종", category: "주방용품 > 밀폐용기" }];

const table = {
  schema: 1,
  pairs: {
    [Sim.normalize(page.name)]: [
      { name: "스탠리 퀜처 텀블러 887ml 블랙", category: "주방용품 > 텀블러", n: 90 },
      { name: "스탠리 아이스플로우 텀블러 887ml", category: "주방용품 > 텀블러", n: 80 },
      { name: "써모스 보온병 500ml", category: "주방용품 > 보온병", n: 50 },
      { name: "얼리 임신테스트기", category: "생활 > 위생", n: 40 },
      { name: "락앤락 밀폐용기 세트", category: "주방용품 > 밀폐용기", n: 30 },
    ],
  },
  categories: {
    "주방용품 > 텀블러": {
      all: [{ name: "킨토 트래블 텀블러", category: "주방용품 > 텀블러", n: 70 }],
      "30s": [{ name: "블루보틀 텀블러", category: "주방용품 > 텀블러", n: 40 }],
      "30s-f": [{ name: "스타벅스 리유저블 컵", category: "주방용품 > 텀블러", n: 25 }],
    },
  },
};

test("pairs drop the page itself, other versions of it, owned look-alikes, and sensitive names", () => {
  const r = Recs.pick(table, page, owned);
  assert.equal(r.kind, "pair");
  assert.deepEqual(r.items.map((x) => x.name), ["써모스 보온병 500ml"]);
});

test("a different product in the same category still counts as an alternative", () => {
  const other = { name: "하이드로플라스크 텀블러", category: "주방용품 > 텀블러" };
  const r = Recs.pick(table, other, [{ name: "블루보틀 텀블러", category: "주방용품 > 텀블러" }], { age: "30s" });
  assert.deepEqual(r.items.map((x) => x.name), ["킨토 트래블 텀블러"]);
  assert.equal(r.segment, "all");
});

test("without pairs, the most specific segment with something to show wins", () => {
  const other = { name: "하이드로플라스크 텀블러", category: "주방용품 > 텀블러" };
  assert.equal(Recs.pick(table, other, [], { age: "30s", gender: "f" }).segment, "30s-f");
  assert.equal(Recs.pick(table, other, [], { age: "30s" }).segment, "30s");
  assert.equal(Recs.pick(table, other, []).segment, "all");
});

test("disposed items no longer count as owned", () => {
  const r = Recs.pick(table, page, [{ ...owned[0], status: "disposed" }]);
  assert.ok(r.items.some((x) => x.name === "락앤락 밀폐용기 세트"));
});

test("a missing or foreign table shows nothing", () => {
  assert.equal(Recs.pick(null, page, []), null);
  assert.equal(Recs.pick({ schema: 2, pairs: table.pairs }, page, []), null);
  assert.equal(Recs.pick({ schema: 1, pairs: { constructor: [] } }, { name: "constructor" }, []), null);
});
