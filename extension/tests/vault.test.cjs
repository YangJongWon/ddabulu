const test = require("node:test");
const assert = require("node:assert/strict");
const Vault = require("../lib/vault.js");

const items = [
  {
    id: "a", name: "스탠리 퀜처 텀블러", price: 49000, purpose: "self", status: "owned",
    images: [{ image: "https://img/a.jpg", hash: "f0f0f0f0" }], image: "https://img/a.jpg",
  },
  { id: "b", name: "브라운 스탬프", purpose: "gift", recipient: "민수", members: [{ id: "1", hash: "ab" }, { id: "2", hash: "cd" }] },
];

test("recovery keys are 32 unambiguous symbols and survive messy typing", () => {
  const k = Vault.newRecoveryKey();
  assert.match(k, /^[A-HJ-NP-Z2-9]{32}$/);
  const shown = Vault.formatKey(k);
  assert.match(shown, /^([A-Z2-9]{4}-){7}[A-Z2-9]{4}$/);
  assert.equal(Vault.normalizeKey(` ${shown.toLowerCase()} `), k);
  assert.equal(Vault.normalizeKey("too-short"), null);
  assert.equal(Vault.normalizeKey(k.replace(/^./, "0")), null);
  assert.notEqual(Vault.newRecoveryKey(), k);
});

test("a sealed list opens with its key and only with its key", async () => {
  const key = Vault.newRecoveryKey();
  const box = await Vault.seal(key, Vault.slim(items, { age: "30s", gender: "f" }));
  assert.equal(box.v, 1);
  assert.ok(!JSON.stringify(box).includes("스탠리"));
  const got = await Vault.open(Vault.formatKey(key), box);
  assert.equal(got.items[0].name, "스탠리 퀜처 텀블러");
  assert.deepEqual(got.profile, { age: "30s", gender: "f" });
  await assert.rejects(Vault.open(Vault.newRecoveryKey(), box));
  const tampered = { ...box, data: box.data.replace(/^.{4}/, "AAAA") };
  await assert.rejects(Vault.open(key, tampered));
});

test("the cloud copy leaves out image hashes and sticker members", () => {
  const s = Vault.slim(items);
  assert.equal("images" in s.items[0], false);
  assert.equal("members" in s.items[1], false);
  assert.equal(s.items[1].stickers, 2);
  assert.equal(s.items[1].recipient, "민수");
});
