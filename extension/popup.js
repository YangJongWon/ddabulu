const $ = (id) => document.getElementById(id);
const I18n = globalThis.ItememI18n;
const Tel = globalThis.ItememTelemetry;
let tab = null;
let pageProduct = null;
let items = [];
let lang = "ko";

function tr(key, vars) {
  return I18n ? I18n.t(lang, key, vars) : key;
}

async function loadLang() {
  const got = await chrome.storage.local.get("lang");
  const pref = got && got.lang ? got.lang : "system";
  const sys = chrome.i18n && chrome.i18n.getUILanguage ? chrome.i18n.getUILanguage() : navigator.language;
  lang = I18n ? I18n.resolve(pref, sys) : "ko";
  document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
  document.querySelectorAll("[data-i18n]").forEach((n) => { n.textContent = tr(n.getAttribute("data-i18n")); });
  document.querySelectorAll("[data-i18n-ph]").forEach((n) => { n.placeholder = tr(n.getAttribute("data-i18n-ph")); });
  document.querySelectorAll("[data-i18n-title]").forEach((n) => { n.title = tr(n.getAttribute("data-i18n-title")); });
  langPref = pref;
}

let langPref = "system";
let lastShown = [];
let overlaps = new Map();

function ownerLabel(it) {
  if (it.status === "candidate") return it.purpose === "gift" ? tr("후보 · {name}", { name: it.recipient || tr("받는 사람 없음") }) : tr("후보");
  return it.purpose === "gift" ? it.recipient || tr("받는 사람 없음") : "MY";
}

async function shareList() {
  const btn = $("share");
  if (!globalThis.ItememShare || btn.disabled) return;
  btn.disabled = true;
  try {
    const q = $("search").value.trim();
    const from = $("from").value;
    const to = $("to").value;
    const filters = [q ? `“${q}”` : "", from || to ? `${from || "…"} ~ ${to || "…"}` : ""].filter(Boolean).join(" · ");
    const rows = lastShown.map((it) => ({
      image: it.image,
      name: it.name,
      owner: ownerLabel(it),
      mine: it.purpose !== "gift" && it.status !== "candidate",
      meta: [it.purchasedAt || it.addedAt, it.shop, Array.isArray(it.members) ? tr("스탬프 {n}개", { n: it.members.length }) : it.category]
        .filter(Boolean).join(" · "),
      ...(scoreOf(it) ? { percent: scoreOf(it).percent, word: scoreOf(it).label, color: scoreOf(it).color } : {}),
    }));
    const title = `${tr("내 물건 · 선물")} · ${rows.length}`;
    const blob = await globalThis.ItememShare.render(
      { title, subtitle: filters, tone: "#1a73e8", rows, footer: `Ddabulu · ${new Date().toLocaleDateString()}` },
      async (url) => call({ type: "imageData", url })
    );
    const how = await globalThis.ItememShare.deliver(blob, `ddabulu-${new Date().toISOString().slice(0, 10)}.png`, title);
    if (how === "copied") $("formMsg").textContent = tr("목록 이미지를 복사하고 저장했어요");
    else if (how === "saved") $("formMsg").textContent = tr("목록 이미지를 저장했어요");
  } catch {
    $("formMsg").textContent = tr("목록 이미지를 만들지 못했어요");
  } finally {
    btn.disabled = false;
  }
}

function siteHost(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "";
  try {
    return new URL(/^[a-z]+:\/\//.test(s) ? s : `https://${s}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function paintSites() {
  const { mutedSites = [] } = await chrome.storage.local.get("mutedSites");
  $("siteList").replaceChildren(
    ...(mutedSites.length
      ? mutedSites.map((s) => el(
          "div",
          { class: "site" },
          el("span", {}, s),
          el("button", { type: "button", title: tr("삭제"), onclick: () => removeSite(s) }, "×")
        ))
      : [el("div", { class: "muted" }, tr("등록한 사이트가 없어요"))])
  );
}

async function addSite() {
  const host = siteHost($("siteInput").value);
  if (!host) {
    $("siteInput").focus();
    return;
  }
  const { mutedSites = [] } = await chrome.storage.local.get("mutedSites");
  if (!mutedSites.includes(host)) mutedSites.push(host);
  await chrome.storage.local.set({ mutedSites });
  $("siteInput").value = "";
  await paintSites();
  await showMuted();
  if (tab) chrome.tabs.sendMessage(tab.id, { type: "recheck" }).catch(() => {});
}

async function removeSite(host) {
  const { mutedSites = [] } = await chrome.storage.local.get("mutedSites");
  await chrome.storage.local.set({ mutedSites: mutedSites.filter((s) => s !== host) });
  await paintSites();
  await showMuted();
  if (tab) chrome.tabs.sendMessage(tab.id, { type: "recheck" }).catch(() => {});
}


// The onboarding card ("c") and the settings section ("s") share one set of controls.
function fillConsent(px, c) {
  const options = (values, labels) => [el("option", { value: "" }, tr("선택 안 함")), ...values.map((v) => el("option", { value: v }, tr(labels[v])))];
  $(`${px}Age`).replaceChildren(...options(Tel.AGES, Tel.AGE_LABEL));
  $(`${px}Gender`).replaceChildren(...options(Tel.GENDERS, Tel.GENDER_LABEL));
  $(`${px}Stats`).checked = c.stats;
  $(`${px}Model`).checked = c.model;
  $(`${px}Age`).value = c.age || "";
  $(`${px}Gender`).value = c.gender || "";
  syncConsent(px);
}

// Commercial use of the model only means something on top of the stats it is trained on.
function syncConsent(px) {
  const on = $(`${px}Stats`).checked;
  $(`${px}Model`).disabled = !on;
  if (!on) $(`${px}Model`).checked = false;
  if (px === "c") $("cSome").textContent = tr(on ? "선택한 항목으로 시작" : "동의 없이 시작");
}

function readConsent(px) {
  return {
    stats: $(`${px}Stats`).checked,
    model: $(`${px}Model`).checked,
    age: $(`${px}Age`).value,
    gender: $(`${px}Gender`).value,
  };
}

function batchText(events, consent) {
  const body = Tel.batch(events, consent, { version: chrome.runtime.getManifest().version, lang });
  return body ? JSON.stringify(body, null, 2) : "";
}

// Built by the same code that builds real events, so the example cannot drift from what is sent.
function sampleText() {
  const on = { version: Tel.CONSENT_VERSION, stats: true, model: true, age: "30s", gender: "f" };
  const product = {
    url: "https://www.coupang.com/vp/products/7334?itemId=9",
    name: "스탠리 퀜처 텀블러 887ml",
    brand: "Stanley",
    category: "주방용품 > 텀블러 > 스테인리스",
    price: 49000,
    image: "https://example.com/a.jpg",
    images: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
    productId: "7334",
    via: { site: true, ld: true },
  };
  const row = {
    percent: 82,
    weights: [{ key: "name", score: 91, points: 30 }, { key: "image", score: 88, points: 21 }, { key: "category", score: 100, points: 18 }],
    visual: { percent: 88 },
  };
  return batchText([Tel.event("extract", { product }, on), Tel.event("feedback", { product, row, correct: false }, on)], on);
}

// Opened as a tab right after install; the popup itself shows the same screen until a choice is made.
const welcome = new URLSearchParams(location.search).has("welcome");

async function showConsent() {
  if (!Tel) return;
  const { consent } = await chrome.storage.local.get("consent");
  if (Tel.consentOf(consent).decided) {
    if (welcome) closeWelcome();
    return;
  }
  fillConsent("c", { stats: false, model: false });
  $("cSample").textContent = sampleText();
  $("consent").removeAttribute("hidden");
  document.body.classList.add("onboarding");
}

async function closeWelcome() {
  const self = await chrome.tabs.getCurrent();
  if (self) chrome.tabs.remove(self.id);
  else window.close();
}

async function decideConsent(all) {
  if (all) {
    $("cStats").checked = true;
    $("cModel").checked = true;
  }
  await call({ type: "consent", consent: readConsent("c") });
  await call({ type: "start" }).catch(() => {});
  if (welcome) return closeWelcome();
  $("consent").setAttribute("hidden", "");
  document.body.classList.remove("onboarding");
  if (tab) chrome.tabs.sendMessage(tab.id, { type: "recheck" }).catch(() => {});
}

async function paintQueue() {
  const { consent, telemetryQueue = [] } = await chrome.storage.local.get(["consent", "telemetryQueue"]);
  $("sQueueSum").textContent = tr("보낼 데이터 {n}건", { n: telemetryQueue.length });
  $("sQueue").textContent = batchText(telemetryQueue, consent) || "[]";
}

async function openSettings() {
  const { muteUntil = 0, muteForever = false } = await chrome.storage.local.get(["muteUntil", "muteForever"]);
  $("langPick").value = langPref;
  const opts = [
    ["show", tr("항상 표시")],
    ...[1, 3, 7, 14, 30].map((n) => [String(n), tr("{n}일간 표시하지 않음", { n })]),
    ["custom", tr("직접 입력…")],
    ["never", tr("항상 표시하지 않음")],
  ];
  $("mutePick").replaceChildren(...opts.map(([v, label]) => el("option", { value: v }, label)));
  if (muteForever) $("mutePick").value = "never";
  else if (Date.now() < muteUntil) {
    $("mutePick").value = "custom";
    $("customDays").value = String(Math.max(1, Math.ceil((muteUntil - Date.now()) / 86400000)));
  } else $("mutePick").value = "show";
  syncCustom();
  $("setMsg").textContent = "";
  await paintSites();
  if (Tel) {
    const { consent } = await chrome.storage.local.get("consent");
    fillConsent("s", Tel.consentOf(consent));
    await paintQueue();
  }
}

function syncCustom() {
  if ($("mutePick").value === "custom") $("customBox").removeAttribute("hidden");
  else $("customBox").setAttribute("hidden", "");
}

async function saveSettings() {
  const v = $("mutePick").value;
  let mute;
  if (v === "show") mute = { muteUntil: 0, muteForever: false };
  else if (v === "never") mute = { muteUntil: 0, muteForever: true };
  else {
    const n = v === "custom" ? Math.floor(Number($("customDays").value)) : Number(v);
    if (!(n >= 1)) {
      $("customDays").focus();
      return;
    }
    mute = { muteUntil: Date.now() + Math.min(n, 3650) * 86400000, muteForever: false };
  }
  await chrome.storage.local.set({ lang: $("langPick").value, ...mute });
  if (Tel) {
    await call({ type: "consent", consent: readConsent("s") });
    $("consent").setAttribute("hidden", "");
  }
  await loadLang();
  await openSettings();
  await showMuted();
  render();
  $("setMsg").textContent = tr("저장했어요");
  if (tab) chrome.tabs.sendMessage(tab.id, { type: "recheck" }).catch(() => {});
}

async function call(msg) {
  const res = await chrome.runtime.sendMessage(msg);
  if (!res || !res.ok) throw new Error(tr((res && res.error) || "응답 없음"));
  return res.data;
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "onclick") node.addEventListener("click", v);
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c !== null && c !== undefined) node.append(c);
  return node;
}

async function loadPage() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    pageProduct = await chrome.tabs.sendMessage(tab.id, { type: "getProduct" });
  } catch {
    pageProduct = null;
  }
  const f = $("form");
  f.purchasedAt.value = new Date().toISOString().slice(0, 10);
  if (pageProduct) {
    for (const k of ["name", "brand", "category", "price", "shop"]) f[k].value = pageProduct[k] ?? "";
  } else {
    $("formTitle").textContent = tr("직접 추가 (이 페이지에서 상품을 못 찾았어요)");
  }
}

function render() {
  const words = $("search").value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const from = $("from").value;
  const to = $("to").value;
  const view = $("view").value;
  const shown = items.filter((it) => {
    const cand = it.status === "candidate";
    if ((view === "candidate" && !cand) || (view === "held" && cand)) return false;
    const day = String(it.purchasedAt || it.addedAt || "").slice(0, 10);
    if ((from || to) && !day) return false;
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (!words.length) return true;
    const hay = [
      it.name, it.brand, it.category, it.shop, it.url, it.productId, it.gtin, it.options, it.memo,
      it.purchasedAt, it.price, it.recipient,
      it.purpose === "gift" ? `${tr("선물했어요")} gift 선물` : "MY",
      it.status === "candidate" ? `${tr("후보")} candidate` : "",
    ].map((v) => String(v ?? "")).join("\n").toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  // On the shortlist, the ones that would not double up come first.
  if (view === "candidate") shown.sort((a, b) => ((overlaps.get(a.id) || {}).percent || 0) - ((overlaps.get(b.id) || {}).percent || 0));
  const live = (i) => i.status !== "disposed" && i.status !== "candidate";
  const held = items.filter((i) => live(i) && i.purpose !== "gift").length;
  const gifts = items.filter((i) => live(i) && i.purpose === "gift").length;
  const cands = items.filter((i) => i.status === "candidate").length;
  $("count").textContent = [
    gifts ? tr("{held}개 보유 · 선물 {gifts}", { held, gifts }) : tr("{n}개 보유", { n: held }),
    cands ? tr("후보 {n}", { n: cands }) : "",
  ].filter(Boolean).join(" · ");
  lastShown = shown;
  if (!$("exportBox").hasAttribute("hidden")) paintExportCount();
  $("list").replaceChildren(
    ...shown.map((it) => {
      const img = /^https?:\/\//i.test(it.image || "") ? el("img", { src: it.image, alt: "" }) : el("div", { class: "ph" });
      const cand = it.status === "candidate";
      const owner = el("span", { class: cand ? "owner cand" : it.purpose === "gift" ? "owner" : "owner mine" }, ownerLabel(it));
      const meta = [
        it.purchasedAt || it.addedAt,
        it.shop,
        it.qty > 1 ? tr("{n}개", { n: it.qty }) : "",
        Array.isArray(it.members) ? tr("스탬프 {n}개", { n: it.members.length }) : it.category,
      ].filter(Boolean).join(" · ");
      const disposed = it.status === "disposed";
      const s = scoreOf(it);
      return el(
        "li",
        { class: disposed ? "disposed" : "" },
        img,
        el(
          "div",
          { class: "info" },
          el("div", { class: "name", title: it.url || it.name }, it.name, " ", owner),
          el("div", { class: "muted" }, meta),
          cand ? overlapLine(overlaps.get(it.id)) : null
        ),
        s
          ? el("div", { class: "score", style: `color:${s.color}`, title: tr("종합") }, el("b", {}, `${s.percent}%`), el("small", {}, s.label))
          : null,
        el(
          "div",
          { class: "act" },
          cand && it.purpose === "gift"
            ? el("button", { title: tr("선물한 것으로 옮기기"), onclick: () => buyCandidate(it) }, tr("선물했어요"))
            : cand
            ? el("button", { title: tr("산 물건으로 옮기기"), onclick: () => buyCandidate(it) }, tr("샀어요"))
            : el("button", { title: tr("중복 판정에서 제외/복귀"), onclick: () => toggleDisposed(it) }, disposed ? tr("복귀") : tr("처분")),
          el("button", { class: "del", onclick: () => remove(it) }, tr("삭제"))
        )
      );
    })
  );
}

const JUDGE_COLOR = {
  "같은 상품": "#d93025",
  "거의 같은 상품": "#9334e6",
  "매우 비슷": "#e8710a",
  "비슷": "#00897b",
  "같은 종류": "#1a73e8",
  "보통": "#188038",
  "낮음": "#5f6368",
};
let scores = new Map();

function judged(row) {
  const word = row.exact ? "같은 상품" : (row.band || (row.percent >= 50 ? "보통" : "낮음"));
  return { percent: row.percent, word, color: JUDGE_COLOR[word] };
}

function scoreOf(it) {
  const s = scores.get(it.id);
  return s ? { ...s, label: tr(s.word) } : null;
}

// Metadata scores show at once; the background check then adds the per-image score.
async function scoreAll() {
  scores = new Map();
  const Sim = globalThis.ItememSim;
  if (!pageProduct || !Sim) return;
  for (const it of items) {
    try {
      scores.set(it.id, judged(Sim.compare(pageProduct, it)));
    } catch {
      // A malformed record just shows no score.
    }
  }
  render();
  try {
    const res = await call({ type: "check", product: pageProduct });
    for (const row of [...(res.exact || []), ...(res.similar || [])]) {
      if (row.item && row.item.id) scores.set(row.item.id, judged(row));
    }
    render();
  } catch {
    // Keep the metadata scores.
  }
}

// Whether a candidate would double up something already held or given.
function overlapLine(o) {
  if (!o) return null;
  if (!o.with || o.percent < 50) return el("div", { class: "ov ok" }, `✓ ${tr("안 겹쳐요")}`);
  const who = o.with.purpose === "gift" ? `${o.with.name} (${o.with.recipient || tr("받는 사람 없음")})` : o.with.name;
  const text = o.exact ? tr("이미 있어요 · {name}", { name: who }) : tr("{n}% 겹침 · {name}", { n: o.percent, name: who });
  return el("div", { class: o.exact || o.percent >= 70 ? "ov hi" : "ov mid", title: o.band ? tr(o.band) : "" }, text);
}

async function buyCandidate(it) {
  await call({ type: "update", id: it.id, patch: { status: "owned", purchasedAt: new Date().toISOString().slice(0, 10) } });
  $("formMsg").textContent = it.purpose === "gift"
    ? tr("{name}에게 줄 후보에서 선물한 것으로 옮겼어요", { name: it.recipient || tr("받는 사람 없음") })
    : tr("후보에서 산 물건으로 옮겼어요");
  await refresh();
}

async function refresh() {
  items = await call({ type: "list" });
  try {
    overlaps = new Map((await call({ type: "candidates" })).map((o) => [o.id, o]));
  } catch {
    overlaps = new Map();
  }
  render();
  scoreAll();
  if (tab) chrome.tabs.sendMessage(tab.id, { type: "recheck" }).catch(() => {});
}

async function toggleDisposed(it) {
  await call({ type: "update", id: it.id, patch: { status: it.status === "disposed" ? "owned" : "disposed" } });
  await refresh();
}

// Same reason as the page card: the browser's confirm is titled with the extension's internal address.
function ask(text, okLabel) {
  return new Promise((resolve) => {
    const dlg = $("ask");
    $("askText").textContent = text;
    $("askYes").textContent = okLabel;
    const done = (v) => {
      dlg.close();
      resolve(v);
    };
    $("askYes").onclick = () => done(true);
    $("askNo").onclick = () => done(false);
    dlg.oncancel = (e) => {
      e.preventDefault();
      done(false);
    };
    dlg.onclick = (e) => { if (e.target === dlg) done(false); };
    dlg.showModal();
    $("askNo").focus();
  });
}

async function remove(it) {
  if (!(await ask(tr("\"{name}\" 을(를) 삭제할까요?", { name: it.name }), tr("삭제")))) return;
  await call({ type: "remove", id: it.id });
  await refresh();
}

function formItem() {
  const f = $("form");
  const item = { ...(pageProduct || {}), url: (pageProduct && pageProduct.url) || (tab && tab.url) || "" };
  for (const k of ["name", "brand", "category", "price", "shop", "purchasedAt"]) item[k] = f[k].value.trim();
  return item;
}

async function loadPeople() {
  const people = await call({ type: "recipients" });
  $("people").replaceChildren(
    ...people.map((name) => el("button", { type: "button", onclick: () => saveGift(name) }, name))
  );
}

async function saveGift(name) {
  const recipient = String(name || "").trim();
  if (!recipient) {
    $("recipient").focus();
    return;
  }
  try {
    const cand = $("giftAsCand").checked;
    const data = await call({ type: "record", item: { ...formItem(), purpose: "gift", recipient, ...(cand ? { status: "candidate" } : {}) } });
    const name = recipient;
    $("formMsg").textContent = data.owned
      ? tr("{name}에게 이미 선물한 상품이에요", { name })
      : data.duplicate
        ? tr("{name}에게 줄 후보에 이미 있어요", { name })
        : cand
          ? tr("{name}에게 줄 후보에 담았어요", { name })
          : data.fromCandidate ? tr("{name}에게 줄 후보에서 선물한 것으로 옮겼어요", { name }) : tr("{name}에게 선물한 것으로 기록했어요", { name });
    $("recipient").value = "";
    await loadPeople();
    await refresh();
  } catch (err) {
    $("formMsg").textContent = err.message;
  }
}

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const data = await call({ type: "record", item: { ...formItem(), purpose: "self" } });
    $("formMsg").textContent = data.duplicate
      ? tr("이미 산 물건이라 또 기록하지 않았어요")
      : data.fromCandidate ? tr("후보에서 산 물건으로 옮겼어요") : tr("산 물건으로 기록했어요");
    await refresh();
  } catch (err) {
    $("formMsg").textContent = err.message;
  }
});

$("candBtn").addEventListener("click", async () => {
  try {
    const data = await call({ type: "record", item: { ...formItem(), purpose: "self", status: "candidate" } });
    $("formMsg").textContent = data.owned
      ? tr("이미 산 상품이에요")
      : data.duplicate ? tr("이미 후보에 있어요") : tr("후보에 담았어요");
    await refresh();
  } catch (err) {
    $("formMsg").textContent = err.message;
  }
});

$("view").addEventListener("change", render);

$("giftBtn").addEventListener("click", async () => {
  const box = $("giftBox");
  const open = box.hasAttribute("hidden");
  if (open) box.removeAttribute("hidden");
  else box.setAttribute("hidden", "");
  if (open) {
    try { await loadPeople(); } catch (err) { $("formMsg").textContent = err.message; }
    $("recipient").focus();
  }
});

$("giftSave").addEventListener("click", () => saveGift($("recipient").value));
$("recipient").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    saveGift($("recipient").value);
  }
});

$("search").addEventListener("input", render);
$("from").addEventListener("change", render);
$("to").addEventListener("change", render);
$("rangeClear").addEventListener("click", () => {
  $("from").value = "";
  $("to").value = "";
  render();
});

function exportPicked() {
  const scope = document.querySelector("input[name=exScope]:checked").value;
  let list = items;
  if (scope === "shown") list = lastShown;
  else if (scope === "range") {
    const from = $("exFrom").value;
    const to = $("exTo").value;
    list = items.filter((it) => {
      const day = String(it.purchasedAt || "").slice(0, 10);
      if (!day) return false;
      return (!from || day >= from) && (!to || day <= to);
    });
  }
  const who = $("exWho").value;
  if (who === "mine") list = list.filter((it) => it.purpose !== "gift");
  else if (who === "gift") list = list.filter((it) => it.purpose === "gift");
  return list;
}

function paintExportCount() {
  $("exShownN").textContent = String(lastShown.length);
  $("exCount").textContent = tr("{n}개 내보냄", { n: exportPicked().length });
}

$("export").addEventListener("click", () => {
  const box = $("exportBox");
  const open = box.hasAttribute("hidden");
  if (open) {
    box.removeAttribute("hidden");
    paintExportCount();
  } else box.setAttribute("hidden", "");
  $("export").classList.toggle("on", open);
});

for (const id of ["exFrom", "exTo", "exWho"]) $(id).addEventListener("change", paintExportCount);
document.querySelectorAll("input[name=exScope]").forEach((r) => r.addEventListener("change", paintExportCount));
$("exFrom").addEventListener("focus", () => { document.querySelector("input[name=exScope][value=range]").checked = true; paintExportCount(); });
$("exTo").addEventListener("focus", () => { document.querySelector("input[name=exScope][value=range]").checked = true; paintExportCount(); });

$("exGo").addEventListener("click", () => {
  const list = exportPicked();
  if (!list.length) {
    $("exCount").textContent = tr("내보낼 항목이 없어요");
    return;
  }
  const blob = new Blob([JSON.stringify({ items: list }, null, 2)], { type: "application/json" });
  const a = el("a", { href: URL.createObjectURL(blob), download: `ddabulu-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
  $("exCount").textContent = tr("{n}개 내보냈어요", { n: list.length });
});

$("import").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const { added, skipped } = await call({ type: "import", items: Array.isArray(data) ? data : data.items });
    $("formMsg").textContent = tr("가져오기: {added}개 추가, {skipped}개 중복이라 건너뜀", { added, skipped });
    await refresh();
  } catch (err) {
    $("formMsg").textContent = tr("가져오기 실패: {msg}", { msg: err.message });
  }
  e.target.value = "";
});

function tabHost() {
  try {
    return tab && tab.url ? new URL(tab.url).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

function covers(site, host) {
  return host === site || host.endsWith(`.${site}`);
}

async function showMuted() {
  const { muteUntil = 0, muteForever = false, mutedSites = [] } = await chrome.storage.local.get(["muteUntil", "muteForever", "mutedSites"]);
  const host = tabHost();
  const lines = [];
  if (muteForever) lines.push(tr("항상 표시하지 않음"));
  else if (Date.now() < muteUntil) lines.push(tr("{date}까지 표시하지 않음", { date: new Date(muteUntil).toLocaleString() }));
  const site = host && mutedSites.find((s) => covers(s, host));
  if (site) lines.push(tr("{site}는 표시하지 않음", { site }));
  $("mutedText").textContent = lines.join(" · ");
  if (lines.length) $("muted").removeAttribute("hidden");
  else $("muted").setAttribute("hidden", "");
}

$("unmute").addEventListener("click", async () => {
  const { mutedSites = [] } = await chrome.storage.local.get("mutedSites");
  const host = tabHost();
  await chrome.storage.local.set({ muteUntil: 0, muteForever: false, mutedSites: mutedSites.filter((s) => !covers(s, host)) });
  await showMuted();
  if (tab) chrome.tabs.sendMessage(tab.id, { type: "recheck" }).catch(() => {});
});

$("gear").addEventListener("click", async () => {
  const box = $("settings");
  const open = box.hasAttribute("hidden");
  if (open) {
    await openSettings();
    box.removeAttribute("hidden");
  } else box.setAttribute("hidden", "");
  $("gear").classList.toggle("on", open);
});
$("mutePick").addEventListener("change", () => {
  syncCustom();
  if ($("mutePick").value === "custom") $("customDays").focus();
});
$("saveSettings").addEventListener("click", saveSettings);
$("cStats").addEventListener("change", () => syncConsent("c"));
$("sStats").addEventListener("change", () => syncConsent("s"));
$("cAll").addEventListener("click", () => decideConsent(true));
$("cSome").addEventListener("click", () => decideConsent(false));
$("share").addEventListener("click", shareList);
$("siteAdd").addEventListener("click", addSite);
$("siteInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addSite();
  }
});

if (welcome) document.body.classList.add("welcome");
loadLang().then(showConsent).then(() => (welcome ? null : loadPage().then(showMuted).then(refresh)));
