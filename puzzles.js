(() => {
  "use strict";
  const PREFIX = "tas:stage4-swinging-sign:puzzle:";
  const parse = (value, fallback = {}) => {
    try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
  };

  const save = (puzzle) => {
    const values = {};
    puzzle.querySelectorAll("[data-puzzle-input]").forEach((input) => {
      values[input.name] = input.value;
    });
    localStorage.setItem(`${PREFIX}${puzzle.dataset.puzzle}:v1`, JSON.stringify({ values, updated_at: new Date().toISOString(), label: "Formative practice" }));
  };

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-puzzle]").forEach((puzzle) => {
      const key = `${PREFIX}${puzzle.dataset.puzzle}:v1`;
      const record = parse(localStorage.getItem(key), {});
      puzzle.querySelectorAll("[data-puzzle-input]").forEach((input) => {
        if (record.values?.[input.name] != null) input.value = record.values[input.name];
        input.addEventListener("change", () => save(puzzle));
      });

      puzzle.querySelector("[data-check-puzzle]")?.addEventListener("click", () => {
        const inputs = [...puzzle.querySelectorAll("[data-puzzle-input]")];
        const answered = inputs.filter((input) => input.value).length;
        const correct = inputs.filter((input) => input.value === input.dataset.correct).length;
        const feedback = puzzle.querySelector("[data-puzzle-feedback]");
        if (answered < inputs.length) {
          feedback.textContent = `Complete all ${inputs.length} items before checking.`;
          feedback.className = "question-feedback try-again";
        } else if (correct === inputs.length) {
          feedback.textContent = `All ${correct} are correct. Explain one choice aloud or in your folio to strengthen the learning.`;
          feedback.className = "question-feedback correct";
        } else {
          feedback.textContent = `${correct} of ${inputs.length} are correct. Revisit the linked module ideas, then try again.`;
          feedback.className = "question-feedback try-again";
        }
        feedback.focus();
        save(puzzle);
      });

      puzzle.querySelector("[data-reset-puzzle]")?.addEventListener("click", () => {
        if (!window.confirm("Reset only this puzzle on this device?")) return;
        localStorage.removeItem(key);
        puzzle.querySelectorAll("[data-puzzle-input]").forEach((input) => { input.value = ""; });
        const feedback = puzzle.querySelector("[data-puzzle-feedback]");
        feedback.textContent = "Your checked result will appear here.";
        feedback.className = "question-feedback";
      });
    });
  });
})();
