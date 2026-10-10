const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("../lib/bundle.js");

const H0 = "0".repeat(64);
const flip = (hex, n) => {
  const a = hex.split("");
  for (let i = 0; i < n; i++) a[i] = "f";
  return a.join("");
};

test("hamming counts differing bits", () => {
  assert.equal(B.hamming(H0, H0), 0);
  assert.equal(B.hamming(H0, flip(H0, 3)), 12);
  assert.equal(B.hamming(H0, null), Infinity);
});

test("dhash marks left>right pixels", () => {
  const gray = [9, 1, 9, 1, 9, 1, 9, 1, 9];
  assert.equal(B.dhash(gray, 8, 1), "aa");
});

test("image distance becomes a readable percent", () => {
  assert.equal(B.imagePercent(0), 100);
  assert.equal(B.imagePercent(B.SAME_IMAGE_BITS), 85);
  assert.equal(B.imagePercent(B.SAME_IMAGE_BITS + 48), 0);
  assert.equal(B.imagePercent(Infinity), null);
});

test("counts each sticker as owned by id or by near-identical image", () => {
  const owned = [
    { id: "pkgA", name: "브라운 기본", packageKey: "line:1", members: [{ id: "10", hash: H0 }, { id: "11", hash: flip(H0, 30) }] },
    { id: "pkgB", name: "브라운 스페셜", packageKey: "line:2", members: [{ id: "99", hash: flip(H0, 63) }] },
  ];
  const newPkg = [
    { id: "10", hash: "abc" },
    { id: "500", hash: flip(H0, 62) },
    { id: "501", hash: flip(H0, 16) },
  ];
  const r = B.overlap(newPkg, owned, { selfKey: "line:3" });
  assert.equal(r.total, 3);
  assert.equal(r.owned, 2);
  assert.equal(r.percent, 67);
  assert.equal(r.stickers[0].how, "same-id");
  assert.equal(r.stickers[0].percent, 100);
  assert.equal(r.stickers[1].owned.itemId, "pkgB");
  assert.equal(r.stickers[1].how, "same-image");
  assert.equal(r.stickers[1].percent, B.imagePercent(4));
  assert.equal(r.stickers[2].owned, null);
  assert.equal(r.stickers[2].nearest.itemId, "pkgA");
  assert.equal(r.stickers[2].percent, B.imagePercent(56));
  assert.deepEqual(r.byPackage.map((p) => [p.name, p.count]), [["브라운 기본", 1], ["브라운 스페셜", 1]]);
});

test("package score is the average of stamp comparisons against that package", () => {
  const owned = [{ id: "melon", name: "멜론", members: [{ id: "a", hash: H0 }] }];
  const viewing = [
    { id: "x", hash: H0 },
    { id: "y", hash: flip(H0, 16) },
  ];
  const r = B.overlap(viewing, owned, { selfKey: "line:9" });
  const expected = Math.round((100 + B.imagePercent(64)) / 2);
  assert.equal(r.versus.length, 1);
  assert.equal(r.versus[0].percent, expected);
  assert.equal(r.versus[0].counted, 2);
  assert.ok(r.versus[0].percent < 90);
});

test("a gifted package is not counted as stamps already owned", () => {
  const owned = [{ id: "gift", name: "선물", purpose: "gift", recipient: "민수", packageKey: "line:4", members: [{ id: "1", hash: H0 }] }];
  assert.equal(B.overlap([{ id: "1", hash: H0 }], owned, { selfKey: "line:9" }).owned, 0);
});

test("the package being viewed and disposed packages are not counted against itself", () => {
  const owned = [
    { id: "self", name: "같은 패키지", packageKey: "line:7", members: [{ id: "1", hash: H0 }] },
    { id: "gone", name: "처분함", status: "disposed", packageKey: "line:8", members: [{ id: "1", hash: H0 }] },
  ];
  assert.equal(B.overlap([{ id: "1", hash: H0 }], owned, { selfKey: "line:7" }).owned, 0);
});
