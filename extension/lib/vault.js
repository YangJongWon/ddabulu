(function (root) {
  // Encrypted cloud copy of the list. The key is a recovery key that only the user holds: the server stores a box
  // it cannot open, and the website decrypts it in the browser. Used by the extension and by ddabulu.com alike.
  const VERSION = 1;
  // 32 symbols without 0/O/1/I, so a key read off a screen or paper is hard to mistype.
  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const KEY_BYTES = 20; // 160 bits → 32 symbols
  const SALT = new TextEncoder().encode("ddabulu-vault-v1");
  // Only what a list view and a restore need: no image hashes or sticker members (both rebuilt on demand).
  const FIELDS = [
    "id", "name", "brand", "category", "price", "image", "shop", "url", "productId", "gtin", "options", "memo",
    "collectible", "packageKey", "purchasedAt", "addedAt", "purpose", "recipient", "status", "qty",
  ];

  const subtle = () => root.crypto.subtle;

  function newRecoveryKey() {
    const bytes = root.crypto.getRandomValues(new Uint8Array(KEY_BYTES));
    let out = "";
    let acc = 0;
    let bits = 0;
    for (const b of bytes) {
      acc = (acc << 8) | b;
      bits += 8;
      while (bits >= 5) {
        bits -= 5;
        out += ALPHABET[(acc >> bits) & 31];
      }
      acc &= (1 << bits) - 1;
    }
    return out;
  }

  // Accepts what people paste: spaces, dashes, lower case.
  function normalizeKey(input) {
    const s = String(input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return s.length === 32 && [...s].every((c) => ALPHABET.includes(c)) ? s : null;
  }

  function formatKey(key) {
    const k = normalizeKey(key);
    return k ? k.match(/.{4}/g).join("-") : "";
  }

  function keyBytes(key) {
    const k = normalizeKey(key);
    if (!k) throw new Error("bad key");
    const out = new Uint8Array(KEY_BYTES);
    let acc = 0;
    let bits = 0;
    let i = 0;
    for (const c of k) {
      acc = (acc << 5) | ALPHABET.indexOf(c);
      bits += 5;
      if (bits >= 8) {
        bits -= 8;
        out[i++] = (acc >> bits) & 255;
      }
      acc &= (1 << bits) - 1;
    }
    return out;
  }

  async function aesKey(key) {
    const base = await subtle().importKey("raw", keyBytes(key), "HKDF", false, ["deriveKey"]);
    return subtle().deriveKey(
      { name: "HKDF", hash: "SHA-256", salt: SALT, info: new TextEncoder().encode("list") },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  function toB64(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  function fromB64(s) {
    const bin = atob(String(s || ""));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function slim(items, profile = {}) {
    const list = (Array.isArray(items) ? items : []).map((it) => {
      const out = {};
      for (const k of FIELDS) if (it[k] !== undefined && it[k] !== "") out[k] = it[k];
      if (Array.isArray(it.members)) out.stickers = it.members.length;
      return out;
    });
    const p = {};
    if (profile.age) p.age = profile.age;
    if (profile.gender) p.gender = profile.gender;
    return { v: VERSION, items: list, profile: p };
  }

  async function seal(key, payload) {
    const iv = root.crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(JSON.stringify(payload));
    const sealed = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv }, await aesKey(key), data));
    return { v: VERSION, iv: toB64(iv), data: toB64(sealed) };
  }

  // Throws on a wrong key: AES-GCM refuses to open a box it did not seal.
  async function open(key, box) {
    if (!box || box.v !== VERSION) throw new Error("bad box");
    const plain = await subtle().decrypt({ name: "AES-GCM", iv: fromB64(box.iv) }, await aesKey(key), fromB64(box.data));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  const api = { newRecoveryKey, normalizeKey, formatKey, slim, seal, open };
  root.ItememVault = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
