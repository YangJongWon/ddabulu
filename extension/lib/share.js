(() => {
  const FONT = '-apple-system, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", "Hiragino Sans", "Microsoft YaHei", sans-serif';
  const W = 420;
  const PAD = 16;
  const HEAD = 64;
  const ROW = 68;
  const FOOT = 34;
  const THUMB = 48;

  function fit(ctx, text, max) {
    const s = String(text == null ? "" : text);
    if (ctx.measureText(s).width <= max) return s;
    let lo = 0;
    let hi = s.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (ctx.measureText(`${s.slice(0, mid)}…`).width <= max) lo = mid;
      else hi = mid - 1;
    }
    return `${s.slice(0, lo)}…`;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  // rows: { image, name, owner, mine, meta, percent, word, color }
  // fetchImage turns a remote URL into a data URL so the canvas stays exportable.
  async function render({ title, subtitle, tone = "#1a73e8", rows = [], footer = "" }, fetchImage) {
    const pics = await Promise.all(
      rows.map(async (r) => {
        if (!r.image || !fetchImage) return null;
        try {
          return await loadImage(await fetchImage(r.image));
        } catch {
          return null;
        }
      })
    );
    const scale = 2;
    const height = HEAD + Math.max(rows.length, 1) * ROW + FOOT;
    const canvas = document.createElement("canvas");
    canvas.width = W * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, height);
    ctx.fillStyle = tone;
    ctx.fillRect(0, 0, W, 5);

    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = tone;
    ctx.font = `700 16px ${FONT}`;
    ctx.fillText(fit(ctx, title, W - PAD * 2), PAD, 32);
    if (subtitle) {
      ctx.fillStyle = "#777";
      ctx.font = `400 12px ${FONT}`;
      ctx.fillText(fit(ctx, subtitle, W - PAD * 2), PAD, 52);
    }

    rows.forEach((r, i) => {
      const y = HEAD + i * ROW;
      ctx.fillStyle = "#eee";
      ctx.fillRect(0, y, W, 1);
      const ty = y + (ROW - THUMB) / 2;
      ctx.save();
      roundRect(ctx, PAD, ty, THUMB, THUMB, 6);
      ctx.fillStyle = "#f1f1f1";
      ctx.fill();
      ctx.clip();
      const pic = pics[i];
      if (pic) {
        const k = Math.min(THUMB / pic.width, THUMB / pic.height);
        const w = pic.width * k;
        const h = pic.height * k;
        ctx.drawImage(pic, PAD + (THUMB - w) / 2, ty + (THUMB - h) / 2, w, h);
      }
      ctx.restore();

      const x = PAD + THUMB + 10;
      const right = W - PAD;
      let textRight = right;
      if (r.percent != null) {
        ctx.font = `800 20px ${FONT}`;
        const pct = `${r.percent}%`;
        const pw = ctx.measureText(pct).width;
        ctx.fillStyle = r.color || tone;
        ctx.fillText(pct, right - pw, y + 32);
        if (r.word) {
          ctx.font = `700 11px ${FONT}`;
          const ww = ctx.measureText(r.word).width;
          ctx.fillText(r.word, right - ww, y + 50);
          textRight = right - Math.max(pw, ww) - 10;
        } else textRight = right - pw - 10;
      }

      ctx.font = `600 13px ${FONT}`;
      const owner = r.owner ? ` ${r.owner}` : "";
      ctx.font = `800 11px ${FONT}`;
      const ow = owner ? ctx.measureText(owner).width : 0;
      ctx.font = `600 13px ${FONT}`;
      const name = fit(ctx, r.name, textRight - x - ow);
      ctx.fillStyle = "#1f1f1f";
      ctx.fillText(name, x, y + 30);
      if (owner) {
        const nw = ctx.measureText(name).width;
        ctx.font = `800 11px ${FONT}`;
        ctx.fillStyle = r.mine ? "#d93025" : "#1a73e8";
        ctx.fillText(owner, x + nw, y + 30);
      }
      if (r.meta) {
        ctx.font = `400 11px ${FONT}`;
        ctx.fillStyle = "#777";
        ctx.fillText(fit(ctx, r.meta, textRight - x), x, y + 48);
      }
    });

    const fy = HEAD + Math.max(rows.length, 1) * ROW;
    ctx.fillStyle = "#eee";
    ctx.fillRect(0, fy, W, 1);
    ctx.fillStyle = "#999";
    ctx.font = `400 11px ${FONT}`;
    ctx.fillText(fit(ctx, footer, W - PAD * 2), PAD, fy + 22);

    return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("image"))), "image/png"));
  }

  // Share sheet when the browser offers it, otherwise clipboard plus a downloaded file.
  async function deliver(blob, filename, title) {
    const file = new File([blob], filename, { type: "image/png" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title });
        return "shared";
      }
    } catch (err) {
      if (err && err.name === "AbortError") return "cancelled";
    }
    let copied = false;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      copied = true;
    } catch {
      copied = false;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return copied ? "copied" : "saved";
  }

  const api = { render, deliver };
  const root = typeof globalThis !== "undefined" ? globalThis : this;
  root.ItememShare = api;
})();
