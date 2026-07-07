const PIP_COLORS = {
  W: "#f8f6d8",
  U: "#0e68ab",
  B: "#150b00",
  R: "#d3202a",
  G: "#00733e",
};

let allCards = [];
let progress = {};
let sessionQueue = []; // array of card objects, front of array = next up
let currentCard = null;
let answerShown = false;

async function init() {
  const res = await fetch("data/cards.json");
  allCards = await res.json();
  progress = srsLoadProgress();
  wireControls();
  rebuildQueue();
  showNextCard();
}

function wireControls() {
  document.getElementById("settings-toggle").addEventListener("click", () => {
    document.getElementById("settings-panel").classList.toggle("hidden");
  });

  document.querySelectorAll(".color-filter, #kind-instant, #kind-flash").forEach((el) => {
    el.addEventListener("change", () => {
      rebuildQueue();
      showNextCard();
    });
  });

  document.getElementById("show-answer-btn").addEventListener("click", showAnswer);

  document.querySelectorAll(".rate-btn").forEach((btn) => {
    btn.addEventListener("click", () => rateCurrentCard(btn.dataset.rating));
  });

  document.getElementById("export-btn").addEventListener("click", exportProgress);
  document.getElementById("import-btn").addEventListener("click", () => {
    document.getElementById("import-file").click();
  });
  document.getElementById("import-file").addEventListener("change", importProgress);
  document.getElementById("reset-btn").addEventListener("click", resetProgress);

  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.code === "Space") {
      e.preventDefault();
      if (!answerShown) showAnswer();
    } else if (["Digit1", "Digit2", "Digit3", "Digit4"].includes(e.code) && answerShown) {
      const ratings = ["again", "hard", "good", "easy"];
      rateCurrentCard(ratings[Number(e.code.slice(-1)) - 1]);
    }
  });
}

function activeFilters() {
  const colors = Array.from(document.querySelectorAll(".color-filter:checked")).map((el) => el.value);
  return {
    colors,
    instants: document.getElementById("kind-instant").checked,
    flashPermanents: document.getElementById("kind-flash").checked,
  };
}

function cardMatchesFilters(card, filters) {
  const isMulti = card.colors.length > 1;
  const isColorless = card.colors.length === 0;
  const colorMatch = card.colors.some((c) => filters.colors.includes(c)) || ((isMulti || isColorless) && filters.colors.includes("C"));
  const kindMatch = card.is_instant ? filters.instants : filters.flashPermanents;
  return colorMatch && kindMatch;
}

function rebuildQueue() {
  const filters = activeFilters();
  const filtered = allCards.filter((c) => cardMatchesFilters(c, filters));

  const due = [];
  const fresh = [];
  filtered.forEach((card) => {
    const state = srsGetState(progress, card.id);
    if (srsIsNew(state)) fresh.push(card);
    else if (srsIsDue(state)) due.push(card);
  });

  due.sort((a, b) => new Date(srsGetState(progress, a.id).due) - new Date(srsGetState(progress, b.id).due));

  sessionQueue = [...due, ...fresh];
  updateStatsBar(due.length, fresh.length, filtered.length);
}

function updateStatsBar(dueCount, newCount, totalCount) {
  document.getElementById("stat-due").textContent = dueCount;
  document.getElementById("stat-new").textContent = newCount;
  document.getElementById("stat-total").textContent = totalCount;
}

function showNextCard() {
  answerShown = false;
  document.getElementById("card-back").classList.add("hidden");
  document.getElementById("rating-bar").classList.add("hidden");
  document.getElementById("show-answer-btn").classList.remove("hidden");

  if (sessionQueue.length === 0) {
    document.getElementById("card-area").classList.add("hidden");
    document.getElementById("empty-state").classList.remove("hidden");
    currentCard = null;
    return;
  }

  document.getElementById("card-area").classList.remove("hidden");
  document.getElementById("empty-state").classList.add("hidden");

  currentCard = sessionQueue[0];
  renderFront(currentCard);
}

function renderManaCost(manaCost) {
  const container = document.getElementById("front-mana");
  container.innerHTML = "";
  if (!manaCost) return;
  const tokens = manaCost.match(/\{[^}]+\}/g) || [];
  tokens.forEach((token) => {
    const symbol = token.slice(1, -1);
    const pip = document.createElement("span");
    pip.className = "pip";
    const letters = symbol.split("/").filter((s) => PIP_COLORS[s]);
    if (letters.length === 2) {
      pip.style.background = `linear-gradient(135deg, ${PIP_COLORS[letters[0]]} 50%, ${PIP_COLORS[letters[1]]} 50%)`;
    } else if (letters.length === 1) {
      pip.style.background = PIP_COLORS[letters[0]];
    } else {
      pip.style.background = "#c9c9c9";
    }
    pip.textContent = symbol.length <= 2 ? symbol.replace("/", "") : symbol;
    container.appendChild(pip);
  });
}

function renderFront(card) {
  renderManaCost(card.mana_cost);
  document.getElementById("front-name").textContent = card.name;
  document.getElementById("front-type").textContent = card.type_line;
}

function showAnswer() {
  if (!currentCard) return;
  answerShown = true;

  const imagesEl = document.getElementById("back-images");
  imagesEl.innerHTML = "";
  currentCard.images.forEach((img) => {
    const wrap = document.createElement("figure");
    const image = document.createElement("img");
    image.src = img.url;
    image.alt = img.label;
    const caption = document.createElement("figcaption");
    caption.textContent = img.label;
    wrap.appendChild(image);
    wrap.appendChild(caption);
    imagesEl.appendChild(wrap);
  });

  let oracle = currentCard.oracle_text || "";
  if (currentCard.back_face) {
    oracle += `\n\n— Transforms into ${currentCard.back_face.name} (${currentCard.back_face.type_line}) —\n${currentCard.back_face.oracle_text}`;
  }
  document.getElementById("back-oracle").textContent = oracle;
  document.getElementById("back-scryfall-link").href = currentCard.scryfall_uri;

  document.getElementById("card-back").classList.remove("hidden");
  document.getElementById("show-answer-btn").classList.add("hidden");
  document.getElementById("rating-bar").classList.remove("hidden");
  renderIntervalPreviews(currentCard);
}

function renderIntervalPreviews(card) {
  const state = srsGetState(progress, card.id);
  ["again", "hard", "good", "easy"].forEach((rating) => {
    const next = srsNextState(state, rating);
    document.getElementById(`preview-${rating}`).textContent = srsFormatInterval(next.interval);
  });
}

function rateCurrentCard(rating) {
  if (!currentCard || !answerShown) return;
  const state = srsGetState(progress, currentCard.id);
  const next = srsNextState(state, rating);
  progress[currentCard.id] = next;
  srsSaveProgress(progress);

  const justReviewed = sessionQueue.shift();
  if (rating === "again") {
    // Re-insert a few cards later in this session so it comes back around.
    const insertAt = Math.min(sessionQueue.length, 3);
    sessionQueue.splice(insertAt, 0, justReviewed);
  }

  updateStatsBar(
    sessionQueue.filter((c) => srsIsDue(srsGetState(progress, c.id))).length,
    sessionQueue.filter((c) => srsIsNew(srsGetState(progress, c.id))).length,
    sessionQueue.length
  );

  showNextCard();
}

function exportProgress() {
  const blob = new Blob([JSON.stringify(progress, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `msh-limited-tricks-progress-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importProgress(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      progress = { ...progress, ...imported };
      srsSaveProgress(progress);
      rebuildQueue();
      showNextCard();
      alert("Progress imported.");
    } catch (err) {
      alert("That file doesn't look like a valid progress export.");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

function resetProgress() {
  if (!confirm("This clears all review history on this device. Continue?")) return;
  progress = {};
  srsSaveProgress(progress);
  rebuildQueue();
  showNextCard();
}

init();
