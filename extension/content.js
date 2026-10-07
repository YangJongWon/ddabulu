(() => {
  const CSS = `
    :host { all: initial; }
    .wrap { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; width: 320px; max-width: calc(100vw - 32px);
      font: 13px/1.45 -apple-system, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; color: #1f1f1f; }
    .card { background: #fff; border-radius: 12px; box-shadow: 0 6px 24px rgba(0,0,0,.18); overflow: hidden; border-top: 4px solid var(--tone); }
    .head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; }
    .title { flex: 1; font-weight: 700; font-size: 14px; color: var(--tone); }
    .x { border: 0; background: none; font-size: 18px; line-height: 1; cursor: pointer; color: #777; padding: 2px 4px; }
    .list { max-height: 300px; overflow-y: auto; }
    .row { display: flex; gap: 10px; padding: 8px 12px; border-top: 1px solid #eee; }
    .row img, .ph { width: 48px; height: 48px; border-radius: 6px; object-fit: cover; background: #f1f1f1; flex: none; }
    .info { min-width: 0; flex: 1; }
    .name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pct { font-weight: 700; color: var(--tone); }
    .sub { color: #666; font-size: 12px; }
    .sub a { color: #1a73e8; text-decoration: none; }
    .foot { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid #eee; }
    .btn { flex: 1; border: 0; border-radius: 8px; padding: 8px; font: inherit; font-weight: 600; cursor: pointer; background: #1a73e8; color: #fff; }
    .btn.ghost { background: #f1f3f4; color: #1f1f1f; }
    .pill { display: inline-flex; float: right; align-items: center; gap: 8px; background: #fff; border-radius: 999px; padding: 6px 6px 6px 12px;
      box-shadow: 0 4px 16px rgba(0,0,0,.16); color: #444; }
    .pill .btn { flex: none; padding: 5px 10px; border-radius: 999px; }
    .toast { padding: 8px 12px; background: #1e8e3e; color: #fff; font-weight: 600; }
    .summary { padding: 0 12px 8px; color: #444; }
    .pkgs { padding: 0 12px 8px; color: #666; font-size: 12px; }
    .grid { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 4px; padding: 8px 12px; border-top: 1px solid #eee; max-height: 220px; overflow-x: hidden; overflow-y: auto; }
    .st { position: relative; aspect-ratio: 1; border-radius: 6px; background: #f6f6f6; overflow: hidden; }
    .st img { display: block; width: 100%; height: 100%; object-fit: contain; }
    .st.own { background: #fdecea; outline: 2px solid var(--tone); outline-offset: -2px; }
    .st.own::after { content: "✓"; position: absolute; right: 2px; top: 0; font-size: 11px; font-weight: 800; color: var(--tone); }
    .legend { padding: 0 12px 8px; color: #888; font-size: 11px; }
  `;

  let host = null;
  let shadow = null;
  let lastHref = "";
  let dismissedHref = "";

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

  function matchRow(m) {
    const it = m.item;
    const img = safeUrl(it.image) ? el("img", { src: it.image, alt: "" }) : el("div", { class: "ph" });
    const reasons = [
      m.same.length ? `같음: ${m.same.join("·")}` : "",
      m.diff.length ? `다름: ${m.diff.join("·")}` : "",
    ].filter(Boolean).join(" / ");
    const link = safeUrl(it.url) ? el("a", { href: it.url, target: "_blank", rel: "noopener" }, "상품 보기") : null;
    const meta = [it.purchasedAt, it.shop, it.qty > 1 ? `${it.qty}개` : ""].filter(Boolean).join(" · ");
    return el(
      "div",
      { class: "row" },
      img,
      el(
        "div",
        { class: "info" },
        el("div", { class: "name", title: it.name }, it.name),
        el("div", {}, el("span", { class: "pct" }, `${m.percent}%`), ` ${m.band}`),
        reasons ? el("div", { class: "sub" }, reasons) : null,
        el("div", { class: "sub" }, meta, link ? " · " : "", link)
      )
    );
  }

  async function recordCurrent(product) {
    const res = await send({ type: "record", item: product });
    if (!res || !res.ok) return;
    mount(el("div", { class: "card" }, el("div", { class: "toast" }, res.data.updated ? "이미 있던 항목이라 수량을 늘렸어요" : "산 물건으로 기록했어요")), "#1e8e3e");
    setTimeout(run, 1600);
  }

  function stickerGrid(bundle) {
    return el(
      "div",
      { class: "grid" },
      ...bundle.stickers.map((s) => {
        const tip = s.owned
          ? `보유: ${s.owned.itemName}${s.how === "same-image" ? " (같은 그림, 다른 상품)" : ""}`
          : "새 스탬프";
        return el("div", { class: s.owned ? "st own" : "st", title: tip }, safeUrl(s.image) ? el("img", { src: s.image, alt: "", loading: "lazy" }) : null);
      })
    );
  }

  function bundleCard(product, result, bundle, close, buy) {
    const tone = bundle.percent >= 50 ? "#d93025" : "#e8710a";
    const wasted = bundle.wasted ? ` · 약 ${bundle.wasted.toLocaleString()}원어치 중복` : "";
    mount(
      el(
        "div",
        { class: "card" },
        el("div", { class: "head" }, el("div", { class: "title" }, `스탬프 ${bundle.total}개 중 ${bundle.owned}개는 이미 있어요`), close),
        el("div", { class: "summary" }, el("span", { class: "pct" }, `${bundle.percent}% 겹침`), wasted),
        el("div", { class: "pkgs" }, ...bundle.byPackage.map((p) => el("div", {}, `· ${p.name} — ${p.count}개`))),
        stickerGrid(bundle),
        el("div", { class: "legend" }, "✓ 표시 = 이미 가진 스탬프 (마우스를 올리면 어느 패키지인지 보여요)"),
        el("div", { class: "foot" }, buy)
      ),
      tone
    );
  }

  function render(product, result, extra = {}) {
    if (dismissedHref === location.href) return unmount();
    const close = el("button", { class: "x", title: "닫기", onclick: () => { dismissedHref = location.href; unmount(); } }, "×");
    const buy = el("button", { class: "btn ghost", onclick: () => recordCurrent(product) }, "샀어요 · 기록");
    const { bundle, loading } = extra;

    if (!result.exact.length && bundle && bundle.owned > 0) return bundleCard(product, result, bundle, close, buy);

    if (!result.exact.length && !result.similar.length) {
      const label = loading
        ? "itemem · 스탬프 하나하나 비교 중…"
        : bundle
          ? `itemem · 스탬프 ${bundle.total}개 모두 처음 보는 것`
          : "itemem · 겹치는 물건 없음";
      mount(el("div", { class: "pill" }, label, buy, close), "#5f6368");
      return;
    }
    const exact = result.exact.length > 0;
    const tone = exact ? "#d93025" : "#e8710a";
    const title = exact
      ? "이미 산 상품이에요"
      : product.collectible
        ? "비슷한 걸 갖고 있어요 (다른 상품)"
        : "비슷한 걸 갖고 있어요";
    mount(
      el(
        "div",
        { class: "card" },
        el("div", { class: "head" }, el("div", { class: "title" }, title), close),
        el("div", { class: "list" }, ...[...result.exact, ...result.similar].map(matchRow)),
        el("div", { class: "foot" }, buy)
      ),
      tone
    );
  }

  async function run() {
    lastHref = location.href;
    const product = globalThis.ItememExtract.extract(document, location.href);
    if (!product) {
      unmount();
      send({ type: "clear" });
      return;
    }
    const href = location.href;
    const res = await send({ type: "check", product });
    if (!res || !res.ok) return;
    if (res.data.exact.length || !/store\.line\.me\/stickershop\/product\//.test(href)) {
      render(product, res.data);
      return;
    }
    render(product, res.data, { loading: true });
    const b = await send({ type: "bundle", product });
    if (location.href !== href) return;
    render(product, res.data, b && b.ok ? { bundle: b.data } : {});
  }

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg && msg.type === "getProduct") {
      reply(globalThis.ItememExtract.extract(document, location.href));
    } else if (msg && msg.type === "recheck") {
      dismissedHref = "";
      run();
      reply(true);
    }
  });

  run();
  // Late-rendered product data and client-side navigation both change what is on screen.
  setTimeout(() => { if (!host) run(); }, 2500);
  setInterval(() => { if (location.href !== lastHref) run(); }, 1500);
})();
