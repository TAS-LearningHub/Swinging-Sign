(() => {
  "use strict";

  const PREFIX = "tas:stage4-swinging-sign:";
  const LEARNING_PREFIX = `${PREFIX}learning:`;

  const safeParse = (value, fallback = {}) => {
    try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
  };

  const readRecord = (key) => safeParse(localStorage.getItem(key), {});
  const writeRecord = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("swinging-sign:storage", { detail: { key } }));
  };

  const downloadText = (filename, text, type = "text/plain") => {
    const blob = new Blob([text], { type: `${type};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const updateYear = () => {
    document.querySelectorAll("[data-year]").forEach((node) => {
      node.textContent = String(new Date().getFullYear());
    });
  };

  const bindNavigation = () => {
    const toggle = document.querySelector(".nav-toggle");
    const nav = document.querySelector(".site-nav");
    if (!toggle || !nav) return;

    const close = (returnFocus = false) => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = "Menu";
      if (returnFocus) toggle.focus();
    };

    toggle.addEventListener("click", () => {
      const opening = !nav.classList.contains("open");
      nav.classList.toggle("open", opening);
      toggle.setAttribute("aria-expanded", String(opening));
      toggle.textContent = opening ? "Close menu" : "Menu";
    });
    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) close(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && nav.classList.contains("open")) close(true);
    });
  };

  const bindVideoPlayer = () => {
    const buttons = [...document.querySelectorAll("[data-video-open]")];
    if (!buttons.length) return;
    const modal = document.createElement("div");
    modal.className = "video-modal";
    modal.hidden = true;
    modal.innerHTML = `<div class="video-modal__backdrop" data-video-close></div><section class="video-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="video-modal-title"><div class="video-modal__head"><h2 id="video-modal-title">Video</h2><button type="button" class="video-modal__close" data-video-close>Close video</button></div><div class="video-frame" data-video-frame></div><p class="fine">This player loads only after you choose Watch. Press Escape or Close video to stop playback.</p></section>`;
    document.body.appendChild(modal);
    const frame = modal.querySelector("[data-video-frame]");
    const title = modal.querySelector("#video-modal-title");
    const closeButton = modal.querySelector(".video-modal__close");
    let opener = null;

    const close = () => {
      frame.replaceChildren();
      modal.hidden = true;
      document.body.classList.remove("modal-open");
      opener?.focus();
    };
    const open = (button) => {
      opener = button;
      title.textContent = button.dataset.videoTitle || "Optional video";
      const iframe = document.createElement("iframe");
      iframe.src = button.dataset.videoSrc;
      iframe.title = button.dataset.videoTitle || "Optional learning video";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      iframe.allowFullscreen = true;
      frame.replaceChildren(iframe);
      modal.hidden = false;
      document.body.classList.add("modal-open");
      closeButton.focus();
    };
    buttons.forEach((button) => button.addEventListener("click", () => open(button)));
    modal.addEventListener("click", (event) => {
      if (event.target.closest("[data-video-close]")) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) close();
    });
  };

  const bindImageViewer = () => {
    const buttons = [...document.querySelectorAll("[data-image-open]")];
    if (!buttons.length) return;
    const modal = document.createElement("div");
    modal.className = "image-modal";
    modal.hidden = true;
    modal.innerHTML = `<div class="image-modal__backdrop" data-image-close></div><section class="image-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="image-modal-title"><div class="image-modal__head"><h2 id="image-modal-title">Image</h2><button type="button" class="image-modal__close" data-image-close>Close image</button></div><img data-image-view alt=""><p class="fine">Press Escape or Close image to return to the learning.</p></section>`;
    document.body.appendChild(modal);
    const image = modal.querySelector("[data-image-view]");
    const title = modal.querySelector("#image-modal-title");
    const closeButton = modal.querySelector(".image-modal__close");
    let opener = null;
    const close = () => {
      modal.hidden = true;
      image.removeAttribute("src");
      image.alt = "";
      document.body.classList.remove("modal-open");
      opener?.focus();
    };
    const open = (button) => {
      opener = button;
      title.textContent = button.dataset.imageTitle || "Learning image";
      const sourceImage = button.closest("figure")?.querySelector("img");
      image.src = button.dataset.imageSrc;
      image.alt = sourceImage?.alt || button.dataset.imageTitle || "Larger learning image";
      modal.hidden = false;
      document.body.classList.add("modal-open");
      closeButton.focus();
    };
    buttons.forEach((button) => button.addEventListener("click", () => open(button)));
    modal.addEventListener("click", (event) => {
      if (event.target.closest("[data-image-close]")) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) close();
    });
  };

  const answerBank = () => window.SWINGING_SIGN_ANSWERS || {};

  const packageComplete = (record, packageElement) => {
    const questionIds = [...packageElement.querySelectorAll(".mcq-question")].map((q) => q.id);
    const checked = questionIds.every((id) => record.question_completion?.[id]);
    const response = String(record.long_response || "").trim();
    return checked && response.length >= 40;
  };

  const updatePackageUI = (packageElement, record) => {
    const key = packageElement.dataset.storageKey;
    packageElement.querySelectorAll(".mcq-question").forEach((question) => {
      const savedValue = record.question_answers?.[question.id];
      if (savedValue) {
        const radio = question.querySelector(`input[type="radio"][value="${CSS.escape(savedValue)}"]`);
        if (radio) radio.checked = true;
      }
      if (record.question_completion?.[question.id]) {
        const feedback = question.querySelector("[data-question-feedback]");
        const selected = question.querySelector("input[type=radio]:checked");
        if (feedback && selected) {
          const correct = answerBank()[question.id] === selected.value;
          feedback.textContent = selected.dataset.feedback || "Response checked.";
          feedback.className = `question-feedback ${correct ? "correct" : "try-again"}`;
        }
      }
    });

    const response = packageElement.querySelector("[data-learning-response]");
    if (response && typeof record.long_response === "string") response.value = record.long_response;

    const status = packageElement.querySelector("[data-save-status]");
    if (status) {
      const complete = packageComplete(record, packageElement);
      const time = record.updated_at ? new Date(record.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "not yet saved";
      status.textContent = complete ? `Complete on this device · saved ${time}` : `Saved on this device · ${time}`;
      status.dataset.complete = String(complete);
    }
    if (key) updateModuleProgress();
  };

  const savePackage = (packageElement, mutator) => {
    const key = packageElement.dataset.storageKey;
    const record = readRecord(key);
    record.question_answers ||= {};
    record.question_completion ||= {};
    mutator(record);
    record.updated_at = new Date().toISOString();
    record.label = "Formative learning evidence";
    record.section_id = packageElement.dataset.sectionId;
    writeRecord(key, record);
    updatePackageUI(packageElement, record);
  };

  const exportPackage = (packageElement) => {
    const record = readRecord(packageElement.dataset.storageKey);
    const lines = [
      "SWINGING SIGN - FORMATIVE LEARNING EVIDENCE",
      `Section: ${packageElement.dataset.sectionTitle}`,
      `Saved: ${record.updated_at || "Not yet saved"}`,
      "",
      "Question responses",
      ...Object.entries(record.question_answers || {}).map(([id, value]) => `${id}: ${value}`),
      "",
      "Higher-order response",
      record.long_response || "No response saved yet.",
      "",
      "This is device-local formative evidence, not proof of submission."
    ];
    downloadText(`${packageElement.dataset.sectionId}-formative-evidence.txt`, lines.join("\n"));
  };

  const bindLearningPackages = () => {
    document.querySelectorAll("details.learning-package").forEach((packageElement) => {
      const key = packageElement.dataset.storageKey;
      updatePackageUI(packageElement, readRecord(key));

      packageElement.addEventListener("change", (event) => {
        const radio = event.target.closest("input[type=radio]");
        if (!radio) return;
        const question = radio.closest(".mcq-question");
        savePackage(packageElement, (record) => {
          record.question_answers[question.id] = radio.value;
          record.question_completion[question.id] = false;
        });
        const feedback = question.querySelector("[data-question-feedback]");
        if (feedback) {
          feedback.textContent = "Response selected. Use Check response for feedback.";
          feedback.className = "question-feedback";
        }
      });

      packageElement.querySelectorAll("[data-check-question]").forEach((button) => {
        button.addEventListener("click", () => {
          const question = button.closest(".mcq-question");
          const selected = question.querySelector("input[type=radio]:checked");
          const feedback = question.querySelector("[data-question-feedback]");
          if (!selected) {
            feedback.textContent = "Choose one response first.";
            feedback.className = "question-feedback try-again";
            question.querySelector("input[type=radio]")?.focus();
            return;
          }
          savePackage(packageElement, (record) => {
            record.question_answers[question.id] = selected.value;
            record.question_completion[question.id] = true;
          });
          const correct = answerBank()[question.id] === selected.value;
          feedback.textContent = selected.dataset.feedback || "Response checked.";
          feedback.className = `question-feedback ${correct ? "correct" : "try-again"}`;
          feedback.focus();
        });
      });

      const response = packageElement.querySelector("[data-learning-response]");
      if (response) {
        let timer;
        response.addEventListener("input", () => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            savePackage(packageElement, (record) => { record.long_response = response.value; });
          }, 250);
        });
      }

      packageElement.querySelector("[data-reset-package]")?.addEventListener("click", () => {
        if (!window.confirm(`Reset only ${packageElement.dataset.sectionTitle}? This cannot be undone.`)) return;
        localStorage.removeItem(key);
        packageElement.querySelectorAll("input[type=radio]").forEach((input) => { input.checked = false; });
        packageElement.querySelectorAll("[data-question-feedback]").forEach((node) => {
          node.textContent = "Choose a response, then check it for feedback.";
          node.className = "question-feedback";
        });
        if (response) response.value = "";
        updatePackageUI(packageElement, {});
      });

      packageElement.querySelector("[data-export-package]")?.addEventListener("click", () => exportPackage(packageElement));
      packageElement.querySelector("[data-print-package]")?.addEventListener("click", () => {
        packageElement.open = true;
        window.print();
      });
    });
  };

  const openFragment = (hash, focus = true) => {
    if (!hash || hash === "#") return false;
    const target = document.querySelector(hash);
    if (!target) return false;
    const details = target.matches("details") ? target : target.closest("details");
    if (details) details.open = true;
    target.scrollIntoView({ block: "start" });
    if (focus) {
      const focusTarget = details?.querySelector("summary") || target;
      focusTarget.setAttribute("tabindex", "-1");
      focusTarget.focus({ preventScroll: true });
    }
    return true;
  };

  const bindFragments = () => {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a[href^='#']");
      if (!link) return;
      if (openFragment(link.getAttribute("href"), true)) {
        history.replaceState(null, "", link.getAttribute("href"));
        event.preventDefault();
      }
    });
    if (location.hash) requestAnimationFrame(() => openFragment(location.hash, true));
  };

  const updateModuleProgress = () => {
    const packages = [...document.querySelectorAll("details.learning-package")];
    if (!packages.length) return;
    let complete = 0;
    packages.forEach((packageElement) => {
      const record = readRecord(packageElement.dataset.storageKey);
      const done = packageComplete(record, packageElement);
      if (done) complete += 1;
      document.querySelectorAll(`[data-package-state="${packageElement.id}"]`).forEach((state) => {
        state.textContent = done ? "✓" : "○";
        state.classList.toggle("complete", done);
        state.setAttribute("aria-label", done ? "Complete" : "Not complete");
      });
    });
    const percent = Math.round((complete / packages.length) * 100);
    document.querySelectorAll("[data-module-progress]").forEach((bar) => { bar.style.width = `${percent}%`; });
    document.querySelectorAll("[data-module-progress-text]").forEach((node) => {
      node.textContent = `${complete} of ${packages.length} section packages complete on this device`;
    });
    const next = packages.find((packageElement) => !packageComplete(readRecord(packageElement.dataset.storageKey), packageElement));
    const moduleReview = document.querySelector(".module-review[id]");
    document.querySelectorAll("[data-module-resume]").forEach((link) => {
      link.href = next ? `#${next.id}` : moduleReview ? `#${moduleReview.id}` : "#main";
      link.textContent = next ? "Resume the next section package" : "Review this completed module";
    });
  };

  const courseMap = () => window.SWINGING_SIGN_COURSE_MAP || [];
  const courseItemComplete = (item) => {
    const record = readRecord(item.storageKey);
    const answers = Object.keys(record.question_completion || {}).filter((id) => record.question_completion[id]);
    return answers.length === 10 && String(record.long_response || "").trim().length >= 40;
  };

  const updateCourseProgress = () => {
    const items = courseMap();
    if (!items.length) return;
    const completed = items.filter(courseItemComplete).length;
    const percent = Math.round((completed / items.length) * 100);
    document.querySelectorAll("[data-course-progress]").forEach((bar) => { bar.style.width = `${percent}%`; });
    document.querySelectorAll("[data-course-progress-text]").forEach((node) => {
      node.textContent = `${completed} of ${items.length} section packages complete on this device`;
    });
    const next = items.find((item) => !courseItemComplete(item));
    document.querySelectorAll("[data-course-resume]").forEach((link) => {
      link.href = next ? `${next.route}#${next.packageId}` : "folio.html";
      link.textContent = next ? `Resume: ${next.title}` : "Course packages complete — review your folio";
    });
  };

  const bindSimpleLocalFields = () => {
    document.querySelectorAll("[data-local-key]").forEach((field) => {
      const key = field.dataset.localKey;
      const record = readRecord(key);
      if (typeof record.value === "string") field.value = record.value;
      let timer;
      field.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => writeRecord(key, { value: field.value, updated_at: new Date().toISOString(), label: "Formative practice" }), 250);
      });
    });
    document.querySelectorAll("[data-reset-local]").forEach((button) => {
      button.addEventListener("click", () => {
        const field = document.getElementById(button.dataset.resetLocal);
        if (!field) return;
        if (!window.confirm("Reset only this saved practice response?")) return;
        localStorage.removeItem(field.dataset.localKey);
        field.value = "";
        field.focus();
      });
    });
  };

  const exportAll = () => {
    const records = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(PREFIX)) records[key] = safeParse(localStorage.getItem(key), localStorage.getItem(key));
    }
    downloadText("swinging-sign-device-backup.json", JSON.stringify({
      course: "Swinging Sign",
      exported_at: new Date().toISOString(),
      boundary: "Device-local learning evidence; not proof of submission.",
      records
    }, null, 2), "application/json");
  };

  const bindWholeCourseTools = () => {
    document.querySelectorAll("[data-export-learning]").forEach((button) => button.addEventListener("click", exportAll));
    document.querySelectorAll("[data-print-learning]").forEach((button) => button.addEventListener("click", () => window.print()));
    const input = document.querySelector("[data-import-learning]");
    input?.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const backup = JSON.parse(await file.text());
        const records = backup.records || {};
        const keys = Object.keys(records).filter((key) => key.startsWith(PREFIX));
        if (!keys.length) throw new Error("No Swinging Sign records were found.");
        if (!window.confirm(`Restore ${keys.length} Swinging Sign records on this device? Existing matching records will be replaced.`)) return;
        keys.forEach((key) => localStorage.setItem(key, JSON.stringify(records[key])));
        location.reload();
      } catch (error) {
        window.alert(`That backup could not be restored: ${error.message}`);
      } finally {
        input.value = "";
      }
    });
  };

  window.addEventListener("swinging-sign:storage", () => {
    updateModuleProgress();
    updateCourseProgress();
  });

  document.addEventListener("DOMContentLoaded", () => {
    updateYear();
    bindNavigation();
    bindVideoPlayer();
    bindImageViewer();
    bindLearningPackages();
    bindFragments();
    bindSimpleLocalFields();
    bindWholeCourseTools();
    updateModuleProgress();
    updateCourseProgress();
  });
})();
