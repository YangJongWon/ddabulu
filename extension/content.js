(() => {
  // Injected again into tabs that were open before install: the copy already here just checks the page again.
  if (globalThis.__itememRun) {
    globalThis.__itememRun();
    return;
  }

  // ddabulu.com talks to the extension through this page only: the session after Google sign-in goes in, and the
  // recovery key comes out so the site can open the user's list. Nothing else is relayed, and nowhere else.
  if (location.origin === "https://ddabulu.com") {
    const RELAY = { hello: "cloudHello", session: "cloudSession", getKey: "cloudKey", push: "cloudPush" };
    window.addEventListener("message", (e) => {
      const m = e.data;
      if (e.source !== window || e.origin !== location.origin || !m || m.source !== "ddabulu-site" || !RELAY[m.type]) return;
      chrome.runtime.sendMessage({ type: RELAY[m.type], data: m.data }, (res) => {
        const ok = !chrome.runtime.lastError && res && res.ok;
        window.postMessage({ source: "ddabulu-ext", id: m.id, ok: Boolean(ok), data: ok ? res.data : null }, location.origin);
      });
    });
  }

  const CSS = `
    :host { all: initial; }
    .wrap { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; width: 380px; max-width: calc(100vw - 32px);
      display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
      font: 13px/1.45 -apple-system, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; color: #1f1f1f; }
    .card { background: #fff; border-radius: 12px; box-shadow: 0 6px 24px rgba(0,0,0,.18); overflow: hidden; border-top: 4px solid var(--tone);
      display: flex; flex-direction: column; max-height: calc(100vh - 32px); }
    .wrap > .card { align-self: stretch; width: 100%; box-sizing: border-box; }
    .head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; flex: none; }
    .head .btn { flex: none; padding: 6px 10px; border-radius: 999px; }
    .acts { display: flex; gap: 6px; }
    .head .acts, .pill .acts { flex: none; }
    .foot .acts { flex: 1; }
    .title { flex: 1; font-weight: 700; font-size: 14px; color: var(--tone); }
    .x { border: 0; background: none; font-size: 18px; line-height: 1; cursor: pointer; color: #777; padding: 2px 4px; }
    .list { flex: 1 1 auto; min-height: 0; max-height: 300px; overflow-y: auto; }
    .row { display: grid; grid-template-columns: 48px minmax(0, 1fr); column-gap: 10px; row-gap: 4px; padding: 8px 12px; border-top: 1px solid #eee; align-items: start; }
    .row img, .ph { width: 48px; height: 48px; border-radius: 6px; object-fit: cover; background: #f1f1f1; flex: none; }
    .info { min-width: 0; flex: 1; }
    .name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pct { font-weight: 700; color: var(--tone); }
    .sub { color: #666; font-size: 12px; }
    .sub a { color: #1a73e8; text-decoration: none; }
    .sub .del { border: 0; background: none; padding: 0; font: inherit; color: #d93025; cursor: pointer; }
    .owner { font-size: 12px; font-weight: 800; color: #1a73e8; }
    .owner.mine { color: #d93025; }
    .foot { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid #eee; flex: none; }
    .btn { flex: 1; border: 0; border-radius: 8px; padding: 8px; font: inherit; font-weight: 600; cursor: pointer; background: #1a73e8; color: #fff; }
    .btn.ghost { background: #f1f3f4; color: #1f1f1f; }
    .pill { display: inline-flex; float: right; align-items: center; gap: 8px; max-width: 100%; flex-wrap: wrap; background: #fff; border-radius: 999px; padding: 6px 6px 6px 12px;
      box-shadow: 0 4px 16px rgba(0,0,0,.16); color: #444; }
    .pill .btn { flex: none; padding: 5px 10px; border-radius: 999px; }
    .toast { padding: 8px 12px; color: #fff; font-weight: 600; }
    .gift { position: absolute; right: 100%; top: 0; bottom: 0; width: 220px; box-sizing: border-box;
      background: #fff; border-radius: 12px 0 0 12px; border-top: 4px solid var(--tone); border-right: 1px solid #eee;
      box-shadow: -6px 6px 24px rgba(0,0,0,.14); padding: 10px 12px; display: flex; flex-direction: column; }
    .gift .people { flex: 1 1 auto; min-height: 0; flex-direction: column; flex-wrap: nowrap; align-items: stretch; gap: 4px; overflow-y: auto; margin-bottom: 8px; }
    .gift .empty { flex: 1 1 auto; }
    .gift .gift-new { flex: none; }
    .gift-bar { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
    .gift-bar .gift-h { flex: 1; margin: 0; }
    .gift-bar .x { flex: none; font-size: 16px; }
    .gift .person { text-align: left; border-radius: 8px; }
    .gift .empty { color: #888; font-size: 12px; margin-bottom: 8px; }
    .gift-new .btn { flex: none; padding: 6px 10px; }
    .as-cand { display: flex; align-items: center; gap: 6px; margin-top: 8px; color: #9334e6; font-size: 12px; font-weight: 700; cursor: pointer; flex: none; }
    .as-cand input { margin: 0; }
    .card { position: relative; }
    .card > .head { position: relative; z-index: 6; background: #fff; }
    .card > .lang { position: absolute; inset: 0; z-index: 5; width: auto; border-radius: 0; box-shadow: none; overflow-y: auto; padding-top: 52px; }
    .gear { border-radius: 8px; padding: 0 4px; line-height: 19px; color: var(--tone); border: 1.5px solid var(--tone); outline: none; }
    .share { display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; padding: 2px 5px; color: var(--tone); border: 1.5px solid var(--tone); outline: none; }
    .share svg { display: block; }
    .card > .head { gap: 4px; padding: 10px 8px 10px 12px; }
    .card > .head .title { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card > .head .x { flex: none; }
    .card > .head > .x:last-child { padding: 2px; }
    .share:disabled { opacity: .5; cursor: progress; }
    .note-toast { align-self: stretch; padding: 8px 12px; border-radius: 10px; color: #fff; font-weight: 600; box-shadow: 0 4px 16px rgba(0,0,0,.16); }
    .gear:focus-visible { box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--tone); }
    .gear.on { background: var(--tone); color: #fff; }
    .lang { width: 100%; box-sizing: border-box; background: #fff; border-radius: 12px; box-shadow: 0 6px 24px rgba(0,0,0,.18); padding: 10px 12px; }
    .person.on { background: #1a73e8; color: #fff; }
    .lang .people { margin-bottom: 12px; }
    .pick { display: block; width: 100%; margin-bottom: 12px; padding: 6px 8px; border: 1px solid #ccc; border-radius: 8px;
      background: #fff; color: #1f1f1f; font: inherit; cursor: pointer; }
    .pick:focus { outline: none; border-color: var(--tone); box-shadow: 0 0 0 2px color-mix(in srgb, var(--tone) 25%, transparent); }
    .lang .empty { color: #888; font-size: 11px; }
    .lang .sec { margin-top: 14px; padding-top: 10px; border-top: 1px solid #eee; }
    .site-list { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; max-height: 140px; overflow-y: auto; }
    .site { display: flex; align-items: center; gap: 6px; padding: 3px 4px 3px 8px; border-radius: 6px; background: #f6f7f8; }
    .site span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sites .gift-new { margin-bottom: 6px; }
    .sites .gift-new .btn { flex: none; padding: 6px 10px; }
    .sites .here { width: 100%; text-align: left; border-radius: 8px; }
    .set-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .set-bar .gift-h { flex: 1; margin: 0; }
    .set-bar .save { flex: none; padding: 4px 14px; background: var(--tone); }
    .mute-row { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; }
    .mute-row .pick { flex: 1 1 auto; width: auto; min-width: 0; margin: 0; }
    .custom { flex: none; align-items: center; margin: 0; }
    .custom[hidden] { display: none; }
    .custom input { width: 64px; flex: none; border: 1px solid #ccc; border-radius: 8px; padding: 6px 8px; font: inherit; color: #1f1f1f; background: #fff; }
    .custom .unit { color: #666; }
    .custom .btn { flex: none; padding: 6px 12px; }
    .gear { font-size: 15px; }
    .gift-h { color: #666; font-size: 12px; margin-bottom: 6px; }
    .people { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .person { border: 0; background: #e8f0fe; color: #174ea6; border-radius: 999px; padding: 4px 10px; font: inherit; font-weight: 700; cursor: pointer; }
    .gift-new { display: flex; gap: 6px; }
    .gift-new input { flex: 1; min-width: 0; border: 1px solid #ddd; border-radius: 8px; padding: 6px 8px; font: inherit; color: #1f1f1f; background: #fff; }
    .summary { padding: 0 12px 8px; color: #444; }
    .pkgs { padding: 0 12px 8px; color: #666; font-size: 12px; }
    .grid { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 4px; padding: 8px 12px; border-top: 1px solid #eee; max-height: 220px; overflow-x: hidden; overflow-y: auto; }
    .st { position: relative; aspect-ratio: 1; border-radius: 6px; background: #f6f6f6; overflow: hidden; }
    .st img { display: block; width: 100%; height: 100%; object-fit: contain; }
    .st.own { background: #fdecea; outline: 2px solid var(--tone); outline-offset: -2px; }
    .st.own::after { content: "✓"; position: absolute; right: 2px; top: 0; font-size: 11px; font-weight: 800; color: var(--tone); }
    .badge { position: absolute; left: 0; right: 0; bottom: 0; font-size: 8px; font-weight: 800; line-height: 12px; text-align: center; color: #fff; background: rgba(60,64,67,.82); }
    .badge.mid { background: #e8710a; }
    .badge.hi { background: #d93025; }
    .legend { padding: 0 12px 8px; color: #888; font-size: 11px; }
    .scores { grid-column: 1 / -1; width: 100%; border-collapse: collapse; font-size: 12px; }
    .scores td { vertical-align: middle; white-space: nowrap; padding: 1px 0; }
    .scores .lab { color: #333; }
    .scores .num { padding-left: 10px; text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
    .scores .word { padding-left: 6px; padding-right: 8px; }
    .scores .act { width: 1%; text-align: right; }
    .scores tr.total > td { font-size: 20px; font-weight: 800; line-height: 1.15; color: #333; padding: 2px 0 2px; }
    .scores tr.total > td.num { font-size: 28px; }
    .scores td.j-exact { color: #d93025; }
    .scores td.j-near { color: #9334e6; }
    .scores td.j-very { color: #e8710a; }
    .scores td.j-alike { color: #00897b; }
    .scores td.j-kind { color: #1a73e8; }
    .scores td.j-mid { color: #188038; }
    .scores td.j-low { color: #5f6368; }
    .scores .ratio { color: #777; font-size: 11px; font-weight: 400; white-space: normal; line-height: 1.35; padding: 0 0 6px; }
    .scores tr.detail-row > td { white-space: normal; font-size: 12px; font-weight: 400; color: #333; padding: 4px 0 6px; }
    .scores .wt td { color: #777; font-size: 11px; font-weight: 400; white-space: normal; }
    .scores .wt .lab { padding-left: 8px; }
    .scores .explain { white-space: normal; color: #888; font-size: 11px; line-height: 1.35; padding: 2px 0 4px; }
    .scores .more[hidden], .scores tr.detail-row[hidden] { display: none; }
    .fold { border: 0; background: none; padding: 4px 0 0; font: inherit; font-size: 12px; font-weight: 700; color: #174ea6; cursor: pointer; }
    .note { grid-column: 1 / -1; }
    .detail { border: 0; background: #e8f0fe; color: #174ea6; border-radius: 999px; padding: 1px 7px; font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; }
    .pop { position: static; width: auto; margin: 0; background: #f6f7f8; color: #333;
      border-radius: 8px; box-shadow: none; padding: 8px 10px; font-size: 12px; font-weight: 400; line-height: 1.45; }
    .pop[hidden] { display: none; }
    .pop-bar { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 4px; }
    .pop-h { flex: 1; font-weight: 700; margin: 0; }
    .pop-bar .x { flex: none; }
    .pop p { margin: 2px 0; }
    .calc { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; column-gap: 8px; row-gap: 2px; align-items: baseline; }
    .calc span:nth-child(4n+2),
    .calc span:nth-child(4n+3),
    .calc span:nth-child(4n) { text-align: right; font-variant-numeric: tabular-nums; }
    .calc .sum { grid-column: 1 / -1; margin-top: 6px; color: #666; font-size: 11px; line-height: 1.4; }
    .dlg { padding: 0; border: 0; border-top: 4px solid #d93025; border-radius: 12px; width: 320px; max-width: calc(100vw - 32px);
      background: #fff; color: #1f1f1f; box-shadow: 0 10px 32px rgba(0,0,0,.24);
      font: 13px/1.45 -apple-system, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; }
    .dlg::backdrop { background: rgba(0,0,0,.32); }
    .dlg-body { padding: 16px; }
    .dlg p { margin: 0 0 14px; word-break: break-word; }
    .dlg .acts { justify-content: flex-end; }
    .dlg .btn { flex: none; padding: 6px 14px; }
    .dlg .btn.danger { background: #d93025; }
    .recs { padding: 8px 12px; border-top: 1px solid #eee; flex: none; }
    .recs-h { font-weight: 700; color: #333; }
    .recs-sub { color: #888; font-size: 11px; margin-bottom: 4px; }
    .rec { display: flex; gap: 6px; align-items: baseline; padding: 2px 0; font-size: 12px; }
    .rec a { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #174ea6; text-decoration: none; }
    .rec a:hover { text-decoration: underline; }
    .rec .cat { flex: none; color: #888; font-size: 11px; }
    .cand-note { padding: 6px 12px; border-top: 1px solid #eee; color: #9334e6; font-size: 12px; font-weight: 700; flex: none;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fb { display: flex; align-items: center; gap: 6px; padding: 7px 12px; border-top: 1px solid #dadce0; background: #fafafa; color: #3c4043; font-size: 12px; flex: none; }
    .fb span { flex: 1; }
    .fb .question { font-weight: 600; }
    .fb .thanks { color: #188038; font-weight: 600; }
    .fb .btn { flex: none; padding: 4px 10px; }
  `;

  const PAGE_CSS = `
    .itemem-pct { position: absolute; left: 50%; bottom: 6px; transform: translateX(-50%); z-index: 5; pointer-events: none;
      padding: 1px 6px; border-radius: 999px; font: 700 12px/1.35 -apple-system, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
      color: #fff; background: rgba(60,64,67,.9); box-shadow: 0 1px 3px rgba(0,0,0,.28); white-space: nowrap; }
    .itemem-pct.mid { background: rgba(232,113,10,.94); }
    .itemem-pct.hi { background: rgba(217,48,37,.94); }
  `;

  const I18n = globalThis.ItememI18n;
  const Tel = globalThis.ItememTelemetry;
  const JUDGE_COLOR = {
    "같은 상품": "#d93025",
    "거의 같은 상품": "#9334e6",
    "매우 비슷": "#e8710a",
    "비슷": "#00897b",
    "같은 종류": "#1a73e8",
    "보통": "#188038",
    "낮음": "#5f6368",
  };
  let host = null;
  let shadow = null;
  let pageStyle = null;
  let paintGen = 0;
  let lastHref = "";
  let dismissedHref = "";
  let lang = "ko";
  let langPref = "system";
  let statsOn = false;
  let trackedHref = "";
  let feedbackHref = "";

  function systemLang() {
    try {
      return chrome.i18n && chrome.i18n.getUILanguage ? chrome.i18n.getUILanguage() : navigator.language;
    } catch {
      return navigator.language || "en";
    }
  }

  function tr(key, vars) {
    return I18n ? I18n.t(lang, key, vars) : key;
  }

  async function loadLang() {
    try {
      const got = await chrome.storage.local.get("lang");
      langPref = got && got.lang ? got.lang : "system";
    } catch {
      langPref = "system";
    }
    lang = I18n ? I18n.resolve(langPref, systemLang()) : "ko";
  }

  async function loadConsent() {
    try {
      const { consent } = await chrome.storage.local.get("consent");
      statsOn = Boolean(Tel && Tel.consentOf(consent).stats);
    } catch {
      statsOn = false;
    }
  }

  // What the page recognised and how it matched, once per page. The background keeps only the whitelisted fields.
  function report(product, result, bundle) {
    if (!statsOn || trackedHref === product.url) return;
    trackedHref = product.url;
    send({ type: "track", kind: "extract", data: { product } });
    send({ type: "track", kind: "match", data: { product, result, bundle: bundle || null } });
  }

  function segmentLabel(seg) {
    if (!Tel || seg === "all") return "";
    // "30s", "30s-f", "14-19-f": the age bucket itself may hold a hyphen, the gender never does.
    const cut = seg.lastIndexOf("-");
    const [age, gender] = Tel.AGE_LABEL[seg] ? [seg, ""] : [seg.slice(0, cut), seg.slice(cut + 1)];
    return [Tel.AGE_LABEL[age], Tel.GENDER_LABEL[gender]].filter(Boolean).map((k) => tr(k)).join(" ");
  }

  function searchUrl(name) {
    const q = encodeURIComponent(name);
    return lang === "ko" ? `https://search.shopping.naver.com/search/all?query=${q}` : `https://www.google.com/search?tbm=shop&q=${q}`;
  }

  function recsBlock(recs) {
    const who = segmentLabel(recs.segment);
    const sub = recs.kind === "pair"
      ? tr("다른 사용자들이 함께 본 것")
      : who ? tr("{who} 사용자들이 많이 본 것", { who }) : tr("다른 사용자들이 많이 본 것");
    return el(
      "div",
      { class: "recs" },
      el("div", { class: "recs-h" }, tr("겹치지 않는 다른 선택")),
      el("div", { class: "recs-sub" }, sub),
      ...recs.items.map((r) => el(
        "div",
        { class: "rec" },
        el("a", { href: searchUrl(r.name), target: "_blank", rel: "noopener", title: tr("{name} 검색", { name: r.name }) }, r.name),
        r.category ? el("span", { class: "cat" }, r.category.split(">").pop().trim()) : null
      ))
    );
  }

  // Picked in the background from a table downloaded as a whole; added to the card already on screen.
  async function addRecs(product) {
    const href = location.href;
    const res = await send({ type: "recs", product });
    if (!res || !res.ok || !res.data || location.href !== href || !shadow) return;
    const list = shadow.querySelector(".card > .list");
    if (!list || shadow.querySelector(".recs")) return;
    list.after(recsBlock(res.data));
  }

  function feedbackBar(product, row) {
    const bar = el("div", { class: "fb", "aria-live": "polite" });
    const answer = (correct) => {
      feedbackHref = location.href;
      send({ type: "track", kind: "feedback", data: { product, row, correct } });
      bar.replaceChildren(el("span", { class: "thanks" }, tr("알려 주셔서 고마워요")));
    };
    bar.append(
      el("span", { class: "question" }, tr("이 판단이 맞나요?")),
      el("button", { class: "btn ghost", type: "button", onclick: () => answer(true) }, tr("맞아요")),
      el("button", { class: "btn ghost", type: "button", onclick: () => answer(false) }, tr("아니에요"))
    );
    return bar;
  }

  function showSide(v) {
    if (!v || v === "없음") return tr("없음");
    return String(v).replace(/원$/, tr("원"));
  }

  function explain(d) {
    if (!d || !d.reason) return d && d.because ? tr(d.because) : "";
    const vars = { ...d.reason };
    if (vars.key) vars.label = tr({ capacity: "용량", color: "색상", size: "사이즈" }[vars.key] || vars.key);
    return tr(vars.id, vars);
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

  function safeUrl(u) {
    return /^https?:\/\//i.test(u || "") ? u : "";
  }

  function send(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (res) => resolve(chrome.runtime.lastError ? null : res));
      } catch {
        resolve(null);
      }
    });
  }

  function mount(content, tone) {
    if (!host) {
      host = document.createElement("itemem-overlay");
      shadow = host.attachShadow({ mode: "closed" });
      document.documentElement.append(host);
    }
    shadow.replaceChildren(el("style", {}, CSS), el("div", { class: "wrap", style: `--tone:${tone}` }, content));
  }

  function unmount() {
    if (host) host.remove();
    host = null;
    shadow = null;
  }

  function artFor(m, bundle) {
    const rows = bundle && Array.isArray(bundle.versus) ? bundle.versus : [];
    return rows.find((v) => v.itemId === m.item.id) || null;
  }

  function matchRow(m, art, opts = {}) {
    const it = m.item;
    const img = safeUrl(it.image) ? el("img", { src: it.image, alt: "" }) : el("div", { class: "ph" });
    const visual = art || m.visual || null;
    const images = (art && art.stickers && art.stickers.length && art.stickers)
      || (m.visual && m.visual.stickers)
      || [];
    const factorWord = (percent) => {
      if (percent >= 90) return "매우 비슷";
      if (percent >= 70) return "비슷";
      if (percent >= 50) return "보통";
      return "낮음";
    };
    const openPop = (detailRow) => {
      const root = detailRow.getRootNode();
      const opening = detailRow.hasAttribute("hidden");
      root.querySelectorAll("tr.detail-row").forEach((n) => n.setAttribute("hidden", ""));
      if (opening) detailRow.removeAttribute("hidden");
    };
    const judgeClass = (word) => {
      if (word === "같은 상품") return "j-exact";
      if (word === "거의 같은 상품") return "j-near";
      if (word === "매우 비슷") return "j-very";
      if (word === "비슷") return "j-alike";
      if (word === "같은 종류") return "j-kind";
      if (word === "보통") return "j-mid";
      if (word === "낮음") return "j-low";
      return "";
    };
    const makeRow = (label, percent, word, pop, hot) => {
      const num = percent == null ? "—" : `${percent}%`;
      const shownText = [num, word ? tr(word) : ""].filter(Boolean).join(" ");
      const tone = judgeClass(word);
      const act = el("td", { class: "act" });
      const rows = [el(
        "tr",
        hot ? { class: "total" } : {},
        el("td", { class: "lab" }, tr(label)),
        el("td", { class: tone ? `num ${tone}` : "num" }, num),
        el("td", { class: tone ? `word ${tone}` : "word" }, word ? tr(word) : ""),
        act
      )];
      if (pop) {
        pop.removeAttribute("hidden");
        const detailRow = el("tr", { class: "detail-row", hidden: "" }, el("td", { colspan: "4" }, pop));
        const detailBtn = el("button", {
          class: "detail",
          type: "button",
          title: tr("상세 근거"),
          onclick: () => openPop(detailRow),
        }, "detail");
        if (!pop.querySelector(".pop-x")) {
          const title = pop.querySelector(".pop-h") || el("div", { class: "pop-h" }, `${tr(label)} ${shownText}`);
          pop.prepend(el(
            "div",
            { class: "pop-bar" },
            title,
            el("button", { class: "x pop-x", type: "button", title: tr("닫기"), onclick: () => detailRow.setAttribute("hidden", "") }, "×")
          ));
        }
        act.append(detailBtn);
        rows.push(detailRow);
      }
      return rows;
    };
    const factorPop = (d) => el(
      "div",
      { class: "pop", hidden: "" },
      el("p", {}, explain(d)),
      el("p", { class: "sub" }, `${tr("전")}: ${showSide(d.left)}`),
      el("p", { class: "sub" }, `${tr("후")}: ${showSide(d.right)}`)
    );
    const factors = (m.details || []).map((d) => ({ key: d.key, label: d.label, percent: d.percent, pop: factorPop(d) }));
    let imageNote = null;
    if (visual && visual.percent != null) {
      const n = images.length || visual.counted || 0;
      const pop = el("div", { class: "pop", hidden: "" }, el("p", {}, tr("개별 이미지 {n}개의 평균", { n })));
      for (const [i, s] of images.entries()) {
        pop.append(el("p", { class: "sub" }, `${tr("이미지 {n}", { n: i + 1 })} ${s.percent}% ${tr(factorWord(s.percent))}`));
      }
      factors.push({ key: "image", label: "개별 이미지 유사도", percent: visual.percent, pop });
    } else if (opts.pending) {
      imageNote = el("div", { class: "sub note" }, tr("이미지 비교 중…"));
    } else if (!m.exact) {
      imageNote = el("div", { class: "sub note" }, tr("이미지로 비교하지 못했어요"));
    }
    const byKey = new Map(factors.map((f) => [f.key, f]));
    const impactOf = (key) => {
      const w = (m.weights || []).find((row) => row.key === key);
      return w ? w.points : 0;
    };
    const byImpact = (a, b) => impactOf(b.key) - impactOf(a.key) || (b.percent ?? -1) - (a.percent ?? -1);
    const ranked = [...(m.weights || [])].filter((w) => w.points > 0).sort((a, b) => b.points - a.points || b.score - a.score);
    const shown = [];
    for (const w of ranked) {
      if (shown.length >= 3) break;
      if (byKey.has(w.key)) shown.push(byKey.get(w.key));
    }
    const picked = new Set(shown.map((f) => f.key));
    const folded = factors.filter((f) => !picked.has(f.key)).sort(byImpact);
    const headRows = [];
    if (m.percent != null) {
      const word = m.exact ? "같은 상품" : (m.band || factorWord(m.percent));
      let totalPop = null;
      if (!m.exact && Array.isArray(m.weights) && m.weights.length) {
        const byPoints = [...m.weights].sort((a, b) => b.points - a.points || b.score - a.score);
        const lines = byPoints.flatMap((w) => [
          el("span", {}, tr(w.label)),
          el("span", {}, `${w.applied}%`),
          el("span", {}, `× ${w.score}`),
          el("span", {}, String(w.points)),
        ]);
        const sum = byPoints.map((w) => w.points).join("+");
        const dropped = (m.omitted || []).map((o) => `${tr(o.label)} ${o.weight}%`).join(", ");
        const why = [
          dropped ? tr("{items}는 값이 없어서 뺐습니다.", { items: dropped }) : "",
          `${sum} = ${m.percent}`,
        ].filter(Boolean).join(" ");
        totalPop = el("div", { class: "pop", hidden: "" }, el("div", { class: "calc" }, ...lines, el("div", { class: "sum" }, why)));
      } else if (m.exact) {
        totalPop = el("div", { class: "pop", hidden: "" }, el("p", {}, tr("같은 상품 페이지")));
      }
      const totalRows = makeRow("종합", m.percent, word, totalPop, true);
      headRows.push(totalRows[0]);
      if (!m.exact && Array.isArray(m.weights) && m.weights.length) {
        const ratio = [...m.weights]
          .sort((a, b) => b.points - a.points || b.score - a.score)
          .map((w) => `${tr(w.label)} ${w.applied}%`)
          .join(" · ");
        headRows.push(el("tr", {}, el("td", { class: "ratio", colspan: "4" }, ratio)));
      }
      if (totalRows[1]) headRows.push(totalRows[1]);
    }
    for (const f of shown) {
      const word = f.percent == null ? "" : factorWord(f.percent);
      headRows.push(...makeRow(f.label, f.percent, word, f.pop, false));
    }
    const extraRows = [];
    for (const f of folded) {
      const word = f.percent == null ? "" : factorWord(f.percent);
      extraRows.push(...makeRow(f.label, f.percent, word, f.pop, false));
    }
    const more = extraRows.length ? el("tbody", { class: "more", hidden: "" }, ...extraRows) : null;
    const restLabel = tr("나머지 {n}", { n: folded.length });
    const foldBtn = more
      ? el("button", {
        class: "fold",
        type: "button",
        onclick: () => {
          const open = more.hasAttribute("hidden");
          if (open) more.removeAttribute("hidden");
          else more.setAttribute("hidden", "");
          foldBtn.textContent = open ? tr("접기") : restLabel;
        },
      }, restLabel)
      : null;
    const scoreRows = [
      el("tbody", {}, ...headRows, foldBtn ? el("tr", {}, el("td", { colspan: "4" }, foldBtn)) : null),
      more,
    ];
    const link = safeUrl(it.url) ? el("a", { href: it.url, target: "_blank", rel: "noopener" }, tr("상품 보기")) : null;
    const del = el("button", { class: "del", type: "button", onclick: () => removeItem(it) }, tr("삭제"));
    const meta = [it.purchasedAt, it.shop, it.qty > 1 ? tr("{n}개", { n: it.qty }) : ""].filter(Boolean).join(" · ");
    return el(
      "div",
      { class: "row" },
      img,
      el(
        "div",
        { class: "info" },
        el(
          "div",
          { class: "name", title: it.name },
          it.name,
          " ",
          el("span", { class: it.purpose === "gift" ? "owner" : "owner mine" }, it.purpose === "gift" ? String(it.recipient || "").trim() || tr("받는 사람 없음") : "MY")
        ),
        el("div", { class: "sub" }, meta, " · ", del, link ? " · " : "", link)
      ),
      scoreRows.length ? el("table", { class: "scores" }, ...scoreRows) : null,
      imageNote
    );
  }

  // Our own confirm: the browser's shows the shop's domain as if the shop were asking.
  // showModal puts it in the top layer, above anything the page draws.
  function ask(text, okLabel) {
    if (!shadow) return Promise.resolve(false);
    return new Promise((resolve) => {
      const no = el("button", { class: "btn ghost", type: "button" }, tr("취소"));
      const yes = el("button", { class: "btn danger", type: "button" }, okLabel);
      const dlg = el("dialog", { class: "dlg" }, el("div", { class: "dlg-body" }, el("p", {}, text), el("div", { class: "acts" }, no, yes)));
      const done = (v) => {
        dlg.close();
        dlg.remove();
        resolve(v);
      };
      no.addEventListener("click", () => done(false));
      yes.addEventListener("click", () => done(true));
      dlg.addEventListener("cancel", (e) => {
        e.preventDefault();
        done(false);
      });
      // Only the backdrop hits the dialog itself; the body covers the rest.
      dlg.addEventListener("click", (e) => { if (e.target === dlg) done(false); });
      shadow.append(dlg);
      dlg.showModal();
      no.focus();
    });
  }

  async function removeItem(it) {
    const who = it.purpose === "gift" ? String(it.recipient || "").trim() || tr("받는 사람 없음") : "MY";
    if (!(await ask(tr("{who}의 \"{name}\" 기록을 삭제할까요?", { who, name: it.name }), tr("삭제")))) return;
    const res = await send({ type: "removeProduct", id: it.id });
    if (!res || !res.ok) {
      mount(el("div", { class: "card" }, el("div", { class: "toast", style: "background:#d93025" }, tr("삭제하지 못했어요"))), "#d93025");
    }
    run();
  }

  async function recordCurrent(product, extra = {}) {
    const gift = extra.purpose === "gift";
    const shortlist = extra.status === "candidate";
    const who = String(extra.recipient || "").trim();
    const res = await send({ type: "record", item: { ...product, ...extra } });
    let text = res && res.error ? tr(res.error) : tr("기록하지 못했어요");
    let tone = "#d93025";
    if (res && res.ok) {
      const d = res.data;
      if (d.owned && gift) text = tr("{name}에게 이미 선물한 상품이에요", { name: who });
      else if (d.owned && shortlist) text = tr("이미 산 상품이에요");
      else if (d.duplicate && shortlist) text = gift ? tr("{name}에게 줄 후보에 이미 있어요", { name: who }) : tr("이미 후보에 있어요");
      else if (d.duplicate) text = tr("이미 산 물건이라 또 기록하지 않았어요");
      else {
        tone = "#1e8e3e";
        if (shortlist) text = gift ? tr("{name}에게 줄 후보에 담았어요", { name: who }) : tr("후보에 담았어요");
        else if (d.fromCandidate) text = gift ? tr("{name}에게 줄 후보에서 선물한 것으로 옮겼어요", { name: who }) : tr("후보에서 산 물건으로 옮겼어요");
        else text = gift ? tr("{name}에게 선물한 것으로 기록했어요", { name: who }) : tr("산 물건으로 기록했어요");
      }
    }
    mount(el("div", { class: "card" }, el("div", { class: "toast", style: `background:${tone}` }, text)), tone);
    setTimeout(run, 1600);
  }

  async function openGift(product, btn) {
    const wrap = btn.closest(".wrap");
    if (!wrap) return;
    const fold = () => {
      const open = wrap.querySelector(":scope > .gift");
      if (open) open.remove();
      const card = wrap.querySelector(":scope > .card");
      if (card) card.style.borderTopLeftRadius = card.style.borderBottomLeftRadius = "";
    };
    if (wrap.querySelector(":scope > .gift")) {
      fold();
      return;
    }
    const res = await send({ type: "recipients" });
    const people = res && res.ok && Array.isArray(res.data) ? res.data : [];
    const input = el("input", { type: "text", placeholder: tr("받는 사람") });
    // Checked: the person gets this as a gift candidate instead of a gift already given.
    const asCandidate = el("input", { type: "checkbox" });
    const giftFor = (name) => recordCurrent(product, { purpose: "gift", recipient: name, ...(asCandidate.checked ? { status: "candidate" } : {}) });
    const save = () => {
      const name = input.value.trim();
      if (!name) {
        input.focus();
        return;
      }
      giftFor(name);
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        save();
      }
    });
    const panel = el(
      "div",
      { class: "gift" },
      el(
        "div",
        { class: "gift-bar" },
        el("div", { class: "gift-h" }, tr("받는 사람")),
        el("button", { class: "x", type: "button", title: tr("접기"), onclick: fold }, "»")
      ),
      people.length
        ? el(
            "div",
            { class: "people" },
            ...people.map((name) => el("button", { class: "person", type: "button", onclick: () => giftFor(name) }, name))
          )
        : el("div", { class: "empty" }, tr("아직 등록한 사람이 없어요")),
      el("div", { class: "gift-new" }, input, el("button", { class: "btn", type: "button", onclick: save }, tr("등록"))),
      el("label", { class: "as-cand" }, asCandidate, tr("후보로만 담기"))
    );
    wrap.append(panel);
    const card = wrap.querySelector(":scope > .card");
    if (card) card.style.borderTopLeftRadius = card.style.borderBottomLeftRadius = "0";
    input.focus();
  }

  function actions(product) {
    return el(
      "div",
      { class: "acts" },
      el("button", { class: "btn", type: "button", onclick: () => recordCurrent(product, { purpose: "self" }) }, tr("샀어요")),
      el("button", { class: "btn ghost", type: "button", onclick: (e) => openGift(product, e.currentTarget) }, tr("선물했어요")),
      el("button", { class: "btn ghost", type: "button", title: tr("사지 않았지만 고민 중인 상품"), onclick: () => recordCurrent(product, { purpose: "self", status: "candidate" }) }, tr("후보"))
    );
  }

  const LANGS = [
    ["system", () => tr("시스템 언어")],
    ["ko", () => "한국어"],
    ["zh", () => "中文"],
    ["ja", () => "日本語"],
    ["en", () => "English"],
  ];

  function langSelect() {
    return el(
      "select",
      { class: "pick" },
      ...LANGS.map(([id, label]) => {
        const opt = el("option", { value: id }, label());
        if (id === langPref) opt.selected = true;
        return opt;
      })
    );
  }

  function hideNow() {
    clearPageBadges();
    unmount();
    send({ type: "clear" });
  }

  function muteSelect() {
    const options = [
      ["show", tr("항상 표시")],
      ...[1, 3, 7, 14, 30].map((n) => [String(n), tr("{n}일간 표시하지 않음", { n })]),
      ["custom", tr("직접 입력…")],
      ["never", tr("항상 표시하지 않음")],
    ];
    const select = el("select", { class: "pick" }, ...options.map(([v, label]) => el("option", { value: v }, label)));
    const days = el("input", { type: "number", min: "1", max: "3650", step: "1", placeholder: tr("일수") });
    const custom = el(
      "div",
      { class: "gift-new custom", hidden: "" },
      days,
      el("span", { class: "unit" }, tr("일"))
    );
    select.addEventListener("change", () => {
      if (select.value === "custom") {
        custom.removeAttribute("hidden");
        days.focus();
      } else custom.setAttribute("hidden", "");
    });
    // Returns null when the custom day count is not a valid number yet.
    const read = () => {
      const v = select.value;
      if (v === "show") return { muteUntil: 0, muteForever: false };
      if (v === "never") return { muteUntil: 0, muteForever: true };
      const n = v === "custom" ? Math.floor(Number(days.value)) : Number(v);
      if (!(n >= 1)) {
        days.focus();
        return null;
      }
      return { muteUntil: Date.now() + Math.min(n, 3650) * 86400000, muteForever: false };
    };
    return { node: el("div", { class: "mute-row" }, select, custom), read };
  }

  async function saveSettings(langPick, mute) {
    const muted = mute.read();
    if (!muted) return;
    langPref = langPick.value || "system";
    await chrome.storage.local.set({ lang: langPref, ...muted });
    lang = I18n ? I18n.resolve(langPref, systemLang()) : "ko";
    if (muted.muteForever || muted.muteUntil > Date.now()) hideNow();
    else run();
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

  function siteMuted(list, host) {
    const h = host.replace(/^www\./, "");
    return list.some((s) => h === s || h.endsWith(`.${s}`));
  }

  function siteManager() {
    const box = el("div", { class: "sites" });
    const input = el("input", { type: "text", placeholder: "example.com" });
    const list = el("div", { class: "site-list" });
    const paint = async () => {
      const { mutedSites = [] } = await chrome.storage.local.get("mutedSites");
      list.replaceChildren(
        ...(mutedSites.length
          ? mutedSites.map((s) => el(
              "div",
              { class: "site" },
              el("span", {}, s),
              el("button", { class: "x", type: "button", title: tr("삭제"), onclick: () => removeSite(s) }, "×")
            ))
          : [el("div", { class: "empty" }, tr("등록한 사이트가 없어요"))])
      );
    };
    const save = async (list) => {
      await chrome.storage.local.set({ mutedSites: list });
      if (siteMuted(list, location.hostname)) hideNow();
      else paint();
    };
    const addSite = async (raw) => {
      const host = siteHost(raw);
      if (!host) {
        input.focus();
        return;
      }
      const { mutedSites = [] } = await chrome.storage.local.get("mutedSites");
      if (!mutedSites.includes(host)) mutedSites.push(host);
      input.value = "";
      save(mutedSites);
    };
    const removeSite = async (host) => {
      const { mutedSites = [] } = await chrome.storage.local.get("mutedSites");
      save(mutedSites.filter((s) => s !== host));
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addSite(input.value);
      }
    });
    box.append(
      list,
      el("div", { class: "gift-new" }, input, el("button", { class: "btn", type: "button", onclick: () => addSite(input.value) }, tr("등록"))),
      el("button", { class: "person here", type: "button", onclick: () => addSite(location.hostname) }, tr("이 사이트 추가 ({site})", { site: siteHost(location.hostname) }))
    );
    paint();
    return box;
  }

  async function isMuted() {
    try {
      const { muteUntil = 0, muteForever = false, mutedSites = [] } = await chrome.storage.local.get(["muteUntil", "muteForever", "mutedSites"]);
      return muteForever || Date.now() < muteUntil || siteMuted(mutedSites, location.hostname);
    } catch {
      return false;
    }
  }

  function openLang(btn) {
    const card = btn.closest(".card");
    const wrap = btn.closest(".wrap");
    const host = card || wrap;
    if (!host) return;
    const old = host.querySelector(":scope > .lang");
    if (old) {
      old.remove();
      btn.classList.remove("on");
      return;
    }
    btn.classList.add("on");
    const langPick = langSelect();
    const mute = muteSelect();
    const panel = el(
      "div",
      { class: "lang" },
      el(
        "div",
        { class: "set-bar" },
        el("div", { class: "gift-h" }, tr("언어")),
        el("button", { class: "btn save", type: "button", onclick: () => saveSettings(langPick, mute) }, tr("저장"))
      ),
      langPick,
      el("div", { class: "gift-h" }, tr("표시")),
      mute.node,
      el("div", { class: "empty" }, tr("다시 보려면 확장 아이콘을 눌러 ‘다시 표시’를 누르세요.")),
      el("div", { class: "gift-h sec" }, tr("표시하지 않는 사이트")),
      siteManager()
    );
    if (card) card.append(panel);
    else wrap.insertBefore(panel, btn.closest(".pill"));
  }

  async function fetchImage(url) {
    const res = await send({ type: "imageData", url });
    if (!res || !res.ok) throw new Error("image");
    return res.data;
  }

  function toast(text, tone) {
    const wrap = shadow && shadow.querySelector(".wrap");
    if (!wrap) return;
    const old = wrap.querySelector(":scope > .note-toast");
    if (old) old.remove();
    const n = el("div", { class: "note-toast", style: `background:${tone}` }, text);
    wrap.prepend(n);
    setTimeout(() => n.remove(), 2500);
  }

  function shareIcon() {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "15");
    svg.setAttribute("height", "15");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2.2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    for (const d of ["M12 15V3", "M7 8l5-5 5 5", "M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"]) {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", d);
      svg.append(p);
    }
    return svg;
  }

  function shareButton(getList) {
    const btn = el("button", { class: "x share", type: "button", title: tr("목록 공유"), "aria-label": tr("목록 공유") }, shareIcon());
    btn.addEventListener("click", async () => {
      if (!globalThis.ItememShare || btn.disabled) return;
      btn.disabled = true;
      try {
        const list = getList();
        const blob = await globalThis.ItememShare.render(list, fetchImage);
        const day = new Date().toISOString().slice(0, 10);
        const how = await globalThis.ItememShare.deliver(blob, `ddabulu-${day}.png`, list.title);
        if (how === "copied") toast(tr("목록 이미지를 복사하고 저장했어요"), "#1e8e3e");
        else if (how === "saved") toast(tr("목록 이미지를 저장했어요"), "#1e8e3e");
      } catch {
        toast(tr("목록 이미지를 만들지 못했어요"), "#d93025");
      } finally {
        btn.disabled = false;
      }
    });
    return btn;
  }

  function shareRows(rows) {
    return rows.map((m) => {
      const it = m.item;
      const word = m.exact ? "같은 상품" : (m.band || (m.percent >= 50 ? "보통" : "낮음"));
      return {
        image: it.image,
        name: it.name,
        owner: it.purpose === "gift" ? String(it.recipient || "").trim() || tr("받는 사람 없음") : "MY",
        mine: it.purpose !== "gift",
        meta: [it.purchasedAt, it.shop].filter(Boolean).join(" · "),
        percent: m.percent,
        word: tr(word),
        color: JUDGE_COLOR[word],
      };
    });
  }

  function gearButton() {
    return el("button", { class: "x gear", type: "button", title: tr("환경설정"), onclick: (e) => openLang(e.currentTarget) }, "⚙");
  }

  function stampTip(s) {
    if (s.percent == null) return tr("비교할 스탬프가 없어요");
    const who = s.owned || s.nearest;
    if (!who) return `${s.percent}%`;
    if (s.owned) {
      return `${s.percent}% · ${tr("보유: {name}", { name: who.itemName })}${s.how === "same-image" ? tr("(같은 그림, 다른 상품)") : ""}`;
    }
    return `${s.percent}% · ${tr("가장 비슷: {name}", { name: who.itemName })}`;
  }

  function percentClass(percent) {
    if (percent >= 85) return "hi";
    if (percent >= 50) return "mid";
    return "";
  }

  function stickerGrid(bundle) {
    return el(
      "div",
      { class: "grid" },
      ...bundle.stickers.map((s) => {
        const level = percentClass(s.percent);
        const badge = s.percent == null ? null : el("span", { class: level ? `badge ${level}` : "badge" }, `${s.percent}%`);
        return el(
          "div",
          { class: s.owned ? "st own" : "st", title: stampTip(s) },
          safeUrl(s.image) ? el("img", { src: s.image, alt: "", loading: "lazy" }) : null,
          badge
        );
      })
    );
  }

  function clearPageBadges() {
    paintGen++;
    document.querySelectorAll(".itemem-pct").forEach((n) => n.remove());
    document.querySelectorAll("[data-itemem-pos]").forEach((n) => {
      n.style.position = "";
      delete n.dataset.itememPos;
    });
  }

  function stickerIdFromUrl(url) {
    const m = String(url || "").match(/\/sticker\/(\d+)\//);
    return m ? m[1] : "";
  }

  function stampHosts() {
    const hosts = [];
    const seen = new Set();
    const used = new Set();
    const add = (host, rawId) => {
      const id = String(rawId || "");
      if (!host || !id || seen.has(host) || used.has(id)) return;
      seen.add(host);
      used.add(id);
      hosts.push({ host, id });
    };
    for (const node of document.querySelectorAll("[data-preview]")) {
      try {
        add(node, JSON.parse(node.getAttribute("data-preview")).id);
      } catch {
        // A sticker cell without parseable preview data is skipped.
      }
    }
    for (const img of document.querySelectorAll("img")) {
      const id = stickerIdFromUrl(img.currentSrc || img.src);
      if (!id) continue;
      const box = img.getBoundingClientRect();
      if (box.width && (box.width < 72 || box.width > 360)) continue;
      add(img.parentElement || img, id);
    }
    for (const node of document.querySelectorAll("[style*='/sticker/']")) {
      const id = stickerIdFromUrl(node.getAttribute("style"));
      if (!id) continue;
      const box = node.getBoundingClientRect();
      if (box.width && (box.width < 72 || box.width > 360)) continue;
      add(node, id);
    }
    return hosts;
  }

  function paintBadges(bundle, art) {
    document.querySelectorAll(".itemem-pct").forEach((n) => n.remove());
    if (!bundle || !Array.isArray(bundle.stickers)) return;
    const focused = art ? new Map(art.stickers.map((s) => [String(s.id), s.percent])) : null;
    if (!pageStyle) {
      pageStyle = document.createElement("style");
      pageStyle.textContent = PAGE_CSS;
      document.documentElement.append(pageStyle);
    }
    const byId = new Map(bundle.stickers.map((s) => [String(s.id), s]));
    for (const { host: cell, id } of stampHosts()) {
      const s = byId.get(id);
      const percent = focused && focused.has(id) ? focused.get(id) : s && s.percent;
      if (percent == null) continue;
      if (getComputedStyle(cell).position === "static") {
        cell.dataset.itememPos = "1";
        cell.style.position = "relative";
      }
      const level = percentClass(percent);
      const tip = art ? `${percent}% · ${tr("{name}와 비교", { name: art.name })}` : s ? stampTip(s) : `${percent}%`;
      cell.append(el("span", { class: level ? `itemem-pct ${level}` : "itemem-pct", title: tip }, `${percent}%`));
    }
  }

  function annotatePage(bundle, art) {
    const gen = ++paintGen;
    const href = location.href;
    const paint = () => {
      if (gen !== paintGen || location.href !== href) return;
      paintBadges(bundle, art);
    };
    paint();
    // The sticker sheet is often painted after the product card.
    setTimeout(paint, 1500);
  }

  function sameImage(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    try {
      return new URL(a, location.href).pathname === new URL(b, location.href).pathname;
    } catch {
      return false;
    }
  }

  function annotatePhotos(visual) {
    const gen = ++paintGen;
    const href = location.href;
    const paint = () => {
      if (gen !== paintGen || location.href !== href || !visual) return;
      document.querySelectorAll(".itemem-pct").forEach((n) => n.remove());
      if (!pageStyle) {
        pageStyle = document.createElement("style");
        pageStyle.textContent = PAGE_CSS;
        document.documentElement.append(pageStyle);
      }
      for (const img of document.querySelectorAll("img")) {
        const hit = (visual.stickers || []).find((s) => sameImage(img.currentSrc || img.src, s.image));
        if (!hit || hit.percent == null) continue;
        const cell = img.parentElement || img;
        if (getComputedStyle(cell).position === "static") {
          cell.dataset.itememPos = "1";
          cell.style.position = "relative";
        }
        const level = percentClass(hit.percent);
        cell.append(el("span", { class: level ? `itemem-pct ${level}` : "itemem-pct", title: `${hit.percent}% · ${tr("개별 이미지 유사도")}` }, `${hit.percent}%`));
      }
    };
    paint();
    setTimeout(paint, 1500);
  }

  function bundleCard(product, result, bundle, close) {
    const tone = bundle.percent >= 50 ? "#d93025" : "#e8710a";
    const wasted = bundle.wasted ? ` · ${tr("약 {n}원어치 중복", { n: bundle.wasted.toLocaleString() })}` : "";
    mount(
      el(
        "div",
        { class: "card" },
        el("div", { class: "head" }, el("div", { class: "title" }, tr("스탬프 {total}개 중 {owned}개는 이미 있어요", bundle)), gearButton(), close),
        el("div", { class: "summary" }, el("span", { class: "pct" }, tr("{n}% 겹침", { n: bundle.percent })), wasted),
        el("div", { class: "pkgs" }, ...bundle.byPackage.map((p) => el("div", {}, `· ${tr("{name} — {count}개", p)}`))),
        stickerGrid(bundle),
        el("div", { class: "legend" }, tr("숫자는 가진 스탬프와 얼마나 닮았는지 · ✓ 는 같은 그림")),
        el("div", { class: "foot" }, actions(product))
      ),
      tone
    );
  }

  function shortlistText(result) {
    const hit = result.shortlist && result.shortlist[0];
    if (!hit) return "";
    const who = hit.item.purpose === "gift" ? String(hit.item.recipient || "").trim() : "";
    if (who) return hit.exact ? tr("{name}에게 줄 후보에 담아 둔 상품이에요", { name: who }) : tr("{who}에게 줄 비슷한 후보가 있어요 · {name}", { who, name: hit.item.name });
    return hit.exact ? tr("후보에 담아 둔 상품이에요") : tr("비슷한 후보가 있어요 · {name}", { name: hit.item.name });
  }

  function render(product, result, extra = {}) {
    if (dismissedHref === location.href) return unmount();
    const close = el("button", { class: "x", title: tr("닫기"), onclick: () => { dismissedHref = location.href; unmount(); } }, "×");
    const { bundle, loading } = extra;

    if (!result.exact.length && bundle && bundle.owned > 0) return bundleCard(product, result, bundle, close);

    if (!result.exact.length && !result.similar.length) {
      const label = loading
        ? tr("Ddabulu · 이미지 하나하나 비교 중…")
        : bundle
          ? tr("Ddabulu · 스탬프 {n}개 모두 처음 보는 것", { n: bundle.total })
          : shortlistText(result)
            ? `Ddabulu · ${shortlistText(result)}`
            : tr("Ddabulu · 겹치는 물건 없음");
      mount(el("div", { class: "pill" }, label, actions(product), gearButton(), close), shortlistText(result) ? "#9334e6" : "#5f6368");
      return;
    }
    const rows = [...result.exact, ...result.similar];
    const mine = rows.some((r) => r.item.purpose !== "gift");
    const gifts = [];
    for (const r of rows) {
      if (r.item.purpose !== "gift") continue;
      const name = String(r.item.recipient || "").trim();
      if (name && !gifts.some((g) => g.replace(/\s+/g, "").toLowerCase() === name.replace(/\s+/g, "").toLowerCase())) gifts.push(name);
    }
    const who = gifts.length === 1 ? gifts[0] : tr("{n}명", { n: gifts.length });
    const other = product.collectible && !result.exact.length ? tr(" (다른 상품)") : "";
    const exactMine = result.exact.some((r) => r.item.purpose !== "gift");
    const top = rows[0];
    const topWord = top.exact ? "같은 상품" : (top.band || (top.percent >= 50 ? "보통" : "낮음"));
    const tone = JUDGE_COLOR[topWord] || "#e8710a";
    const title = exactMine
      ? tr("이미 산 상품이에요")
      : result.exact.length
        ? tr("이미 선물한 상품이에요 - {who}", { who })
        : !mine && gifts.length
          ? tr("비슷한 걸 선물 했어요 - {who}", { who }) + other
          : mine && gifts.length
            ? tr("비슷한 걸 갖고 있어요 - MY · {who}", { who }) + other
            : tr("비슷한 걸 갖고 있어요 - MY") + other;
    mount(
      el(
        "div",
        { class: "card" },
        el(
          "div",
          { class: "head" },
          el("div", { class: "title" }, title),
          shareButton(() => ({
            title,
            subtitle: product.name,
            tone,
            rows: shareRows(rows),
            footer: `Ddabulu · ${new Date().toLocaleDateString()}`,
          })),
          gearButton(),
          close
        ),
        el(
          "div",
          { class: "list" },
          ...rows.map((m) => matchRow(m, artFor(m, bundle), { collectible: product.collectible, pending: Boolean(loading) }))
        ),
        shortlistText(result) ? el("div", { class: "cand-note" }, shortlistText(result)) : null,
        statsOn && !loading && feedbackHref !== location.href ? feedbackBar(product, top) : null,
        el("div", { class: "foot" }, actions(product))
      ),
      tone
    );
  }

  function attachPageImages(product) {
    const images = [];
    const push = (u) => {
      if (u && /^https?:\/\//i.test(u) && !images.includes(u)) images.push(u);
    };
    for (const u of product.images || []) push(typeof u === "string" ? u : u && u.image);
    push(product.image);
    const root = document.querySelector("main, [role='main']") || document.body;
    for (const img of root.querySelectorAll("img")) {
      if (images.length >= 24) break;
      if (img.closest("aside, nav, footer, header")) continue;
      const src = img.currentSrc || img.src || "";
      const w = img.getBoundingClientRect().width || img.naturalWidth || 0;
      if (!/^https?:\/\//i.test(src) || (w && (w < 96 || w > 1000))) continue;
      push(src);
    }
    product.images = images;
    if (!product.image && images[0]) product.image = images[0];
    return product;
  }

  async function run() {
    await loadLang();
    await loadConsent();
    lastHref = location.href;
    if (await isMuted()) {
      hideNow();
      return;
    }
    clearPageBadges();
    const found = globalThis.ItememExtract.extract(document, location.href);
    const product = found ? attachPageImages(found) : null;
    if (!product) {
      unmount();
      send({ type: "clear" });
      return;
    }
    const href = location.href;
    const isLine = /store\.line\.me\/stickershop\/product\//.test(href);
    const res = await send({ type: "check", product });
    if (!res || !res.ok || location.href !== href) return;
    if (!isLine) {
      render(product, res.data);
      report(product, res.data);
      addRecs(product);
      const focus = (res.data.similar || []).find((row) => row.visual) || res.data.similar[0];
      if (focus && focus.visual) annotatePhotos(focus.visual);
      return;
    }
    if (res.data.exact.length) render(product, res.data);
    else render(product, res.data, { loading: true });
    const b = await send({ type: "bundle", product });
    if (location.href !== href) return;
    const bundle = b && b.ok ? b.data : null;
    if (!res.data.exact.length) render(product, res.data, bundle ? { bundle } : {});
    report(product, res.data, bundle);
    addRecs(product);
    const focus = res.data.similar && res.data.similar[0];
    const art = focus && bundle ? artFor(focus, bundle) : null;
    annotatePage(bundle, art);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg && msg.type === "getProduct") {
      const found = globalThis.ItememExtract.extract(document, location.href);
      reply(found ? attachPageImages(found) : null);
    } else if (msg && msg.type === "recheck") {
      dismissedHref = "";
      run();
      reply(true);
    }
  });

  globalThis.__itememRun = () => {
    dismissedHref = "";
    run();
  };

  run();
  // Late-rendered product data and client-side navigation both change what is on screen.
  setTimeout(() => { if (!host) run(); }, 2500);
  setInterval(() => { if (location.href !== lastHref) run(); }, 1500);
})();
