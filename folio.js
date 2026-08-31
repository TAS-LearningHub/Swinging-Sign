(() => {
  "use strict";

  const FOLIO_KEY = "tas:stage4-swinging-sign:folio:v1";
  const MAX_SOURCE_BYTES = 6 * 1024 * 1024;
  const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

  const parse = (value, fallback = {}) => {
    try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
  };
  const read = () => parse(localStorage.getItem(FOLIO_KEY), { schema: 1, fields: {}, images: {} });
  const write = (record) => {
    record.updated_at = new Date().toISOString();
    record.boundary = "Browser-local student folio; not proof of submission.";
    localStorage.setItem(FOLIO_KEY, JSON.stringify(record));
    updateStatus(record);
  };

  const download = (filename, text, type) => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const substantive = (value) => String(value || "").trim().length >= 40;
  const stageIds = () => [...document.querySelectorAll("[data-folio-field]")].map((field) => field.dataset.folioField);

  const updateStatus = (record = read()) => {
    const ids = stageIds();
    const complete = ids.filter((id) => substantive(record.fields?.[id])).length;
    const percent = ids.length ? Math.round((complete / ids.length) * 100) : 0;
    document.querySelectorAll("[data-folio-progress]").forEach((bar) => { bar.style.width = `${percent}%`; });
    document.querySelectorAll("[data-folio-progress-text]").forEach((node) => {
      node.textContent = `${complete} of ${ids.length} evidence cards contain a substantive response`;
    });
    document.querySelectorAll("[data-folio-save-status]").forEach((node) => {
      node.textContent = record.updated_at
        ? `Saved on this device at ${new Date(record.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : "Nothing has been saved yet.";
    });
    const next = ids.find((id) => !substantive(record.fields?.[id]));
    const nextElement = next ? document.querySelector(`[data-folio-card="${next}"]`) : null;
    document.querySelectorAll("[data-folio-resume]").forEach((button) => {
      button.textContent = nextElement ? `Next: ${nextElement.dataset.folioTitle}` : "All evidence cards have a response";
      button.disabled = !nextElement;
      button.dataset.target = nextElement?.id || "";
    });
  };

  const compressImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("The selected file is not a readable image."));
      image.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d", { alpha: false });
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  const escapeHtml = (value) => String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  const exportSubmission = () => {
    const record = read();
    const sections = [...document.querySelectorAll("[data-folio-card]")].map((card) => {
      const id = card.dataset.folioCard;
      const title = card.dataset.folioTitle;
      const response = record.fields?.[id] || "No response saved.";
      const image = record.images?.[id]
        ? `<figure><img src="${record.images[id]}" alt="Student-imported evidence for ${escapeHtml(title)}"><figcaption>Browser-local image evidence</figcaption></figure>`
        : "";
      return `<section><h2>${escapeHtml(title)}</h2><p>${escapeHtml(response).replaceAll("\n", "<br>")}</p>${image}</section>`;
    }).join("\n");

    const html = `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Swinging Sign folio export</title><style>body{max-width:900px;margin:40px auto;padding:0 24px;font:16px/1.55 Arial,sans-serif;color:#17241d}h1{color:#176046}section{page-break-inside:avoid;border-top:2px solid #2e6b3d;padding:18px 0}img{max-width:100%;max-height:520px;object-fit:contain}figcaption{font-size:13px;color:#56635c}.boundary{padding:12px;background:#fff3cf}</style></head><body><h1>Swinging Sign project folio</h1><p>Exported ${escapeHtml(new Date().toLocaleString())}</p><p class="boundary"><strong>Submission boundary:</strong> This self-contained file is a student-created backup/export. Follow teacher directions for formal submission.</p>${sections}</body></html>`;
    download("swinging-sign-folio-export.html", html, "text/html;charset=utf-8");
  };

  document.addEventListener("DOMContentLoaded", () => {
    const record = read();
    record.fields ||= {};
    record.images ||= {};

    document.querySelectorAll("[data-folio-field]").forEach((field) => {
      const id = field.dataset.folioField;
      field.value = record.fields[id] || "";
      let timer;
      field.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const current = read();
          current.fields ||= {};
          current.images ||= {};
          current.fields[id] = field.value;
          write(current);
        }, 250);
      });
    });

    document.querySelectorAll("[data-folio-image]").forEach((input) => {
      const id = input.dataset.folioImage;
      const preview = document.querySelector(`[data-folio-preview="${id}"]`);
      if (record.images[id] && preview) {
        preview.src = record.images[id];
        preview.hidden = false;
      }
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file) return;
        if (!ALLOWED_TYPES.has(file.type)) {
          window.alert("Choose a JPG, PNG or WebP image.");
          input.value = "";
          return;
        }
        if (file.size > MAX_SOURCE_BYTES) {
          window.alert("Choose an image smaller than 6 MB. A compressed copy stays only in this browser.");
          input.value = "";
          return;
        }
        try {
          const dataUrl = await compressImage(file);
          const current = read();
          current.fields ||= {};
          current.images ||= {};
          current.images[id] = dataUrl;
          write(current);
          if (preview) {
            preview.src = dataUrl;
            preview.hidden = false;
          }
        } catch (error) {
          window.alert(error.message);
        } finally {
          input.value = "";
        }
      });
    });

    document.querySelectorAll("[data-remove-folio-image]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.removeFolioImage;
        const current = read();
        if (!current.images?.[id]) return;
        if (!window.confirm("Remove only this browser-local image from the folio?")) return;
        delete current.images[id];
        write(current);
        const preview = document.querySelector(`[data-folio-preview="${id}"]`);
        if (preview) {
          preview.removeAttribute("src");
          preview.hidden = true;
        }
      });
    });

    document.querySelectorAll("[data-folio-resume]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = document.getElementById(button.dataset.target);
        if (!target) return;
        target.scrollIntoView({ block: "start" });
        target.querySelector("textarea")?.focus({ preventScroll: true });
      });
    });

    document.querySelector("[data-export-folio-html]")?.addEventListener("click", exportSubmission);
    document.querySelector("[data-export-folio-json]")?.addEventListener("click", () => {
      download("swinging-sign-folio-backup.json", JSON.stringify({ folio_key: FOLIO_KEY, record: read() }, null, 2), "application/json;charset=utf-8");
    });
    document.querySelector("[data-print-folio]")?.addEventListener("click", () => window.print());
    document.querySelector("[data-reset-folio]")?.addEventListener("click", () => {
      if (!window.confirm("Reset the entire Swinging Sign folio on this device? This cannot be undone. Export a backup first if needed.")) return;
      localStorage.removeItem(FOLIO_KEY);
      location.reload();
    });

    updateStatus(record);
  });
})();
