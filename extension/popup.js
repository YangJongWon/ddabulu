const $ = (id) => document.getElementById(id);
let tab = null;
let pageProduct = null;
let items = [];

async function call(msg) {
  const res = await chrome.runtime.sendMessage(msg);
  if (!res || !res.ok) throw new Error((res && res.error) || "응답 없음");
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
    $("formTitle").textContent = "직접 추가 (이 페이지에서 상품을 못 찾았어요)";
  }
}

function render() {
  const q = $("search").value.trim().toLowerCase();
  const shown = items.filter((it) =>
    !q || [it.name, it.brand, it.category, it.shop].some((v) => String(v || "").toLowerCase().includes(q))
  );
  $("count").textContent = `${items.filter((i) => i.status !== "disposed").length}개 보유`;
  $("list").replaceChildren(
    ...shown.map((it) => {
      const img = /^https?:\/\//i.test(it.image || "") ? el("img", { src: it.image, alt: "" }) : el("div", { class: "ph" });
      const meta = [
        it.purchasedAt,
        it.shop,
        it.qty > 1 ? `${it.qty}개` : "",
        Array.isArray(it.members) ? `스탬프 ${it.members.length}개` : it.category,
      ].filter(Boolean).join(" · ");
      const disposed = it.status === "disposed";
      return el(
        "li",
        { class: disposed ? "disposed" : "" },
        img,
        el("div", { class: "info" }, el("div", { class: "name", title: it.name }, it.name), el("div", { class: "muted" }, meta)),
        el(
          "div",
          { class: "act" },
          el("button", { title: "중복 판정에서 제외/복귀", onclick: () => toggleDisposed(it) }, disposed ? "복귀" : "처분"),
          el("button", { class: "del", onclick: () => remove(it) }, "삭제")
        )
      );
    })
  );
}

async function refresh() {
  items = await call({ type: "list" });
  render();
  if (tab) chrome.tabs.sendMessage(tab.id, { type: "recheck" }).catch(() => {});
}

async function toggleDisposed(it) {
  await call({ type: "update", id: it.id, patch: { status: it.status === "disposed" ? "owned" : "disposed" } });
  await refresh();
}

async function remove(it) {
  if (!confirm(`"${it.name}" 을(를) 삭제할까요?`)) return;
  await call({ type: "remove", id: it.id });
  await refresh();
}

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const item = { ...(pageProduct || {}), url: (pageProduct && pageProduct.url) || (tab && tab.url) || "" };
  for (const k of ["name", "brand", "category", "price", "shop", "purchasedAt"]) item[k] = f[k].value.trim();
  try {
    const { updated } = await call({ type: "record", item });
    $("formMsg").textContent = updated ? "이미 있던 항목이라 수량을 늘렸어요" : "기록했어요";
    await refresh();
  } catch (err) {
    $("formMsg").textContent = err.message;
  }
});

$("search").addEventListener("input", render);

$("export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ items }, null, 2)], { type: "application/json" });
  const a = el("a", { href: URL.createObjectURL(blob), download: `itemem-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
});

$("import").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const { added, skipped } = await call({ type: "import", items: Array.isArray(data) ? data : data.items });
    $("formMsg").textContent = `가져오기: ${added}개 추가, ${skipped}개 중복이라 건너뜀`;
    await refresh();
  } catch (err) {
    $("formMsg").textContent = `가져오기 실패: ${err.message}`;
  }
  e.target.value = "";
});

loadPage().then(refresh);
