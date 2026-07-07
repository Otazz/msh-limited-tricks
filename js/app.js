const PIP_COLORS = {
  W: "#f8f6d8",
  U: "#0e68ab",
  B: "#150b00",
  R: "#d3202a",
  G: "#00733e",
};

const PIP_NAMES = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
};

const KIND_FILTER_IDS = {
  instant: "kind-instant",
  flash_permanent: "kind-flash",
  activated_ability: "kind-activated",
};

let allCards = [];
let progress = {};
let sessionQueue = []; // array of card objects, front of array = next up
let currentCard = null;
let answerShown = false;
let manaOnlyMode = false;

async function init() {
  let res;
  try {
    res = await fetch("data/cards.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allCards = await res.json();
  } catch (e) {
    console.error("Failed to load card data", e);
    showLoadError();
    return;
  }

  progress = srsLoadProgress();
  wireControls();
  rebuildQueue();
  showNextCard();
  renderBrowseView();
}

function showLoadError() {
  const main = document.querySelector("main");
  main.innerHTML =
    '<div id="empty-state"><p>Couldn\'t load card data (data/cards.json). Check your connection and reload the page.</p></div>';
}

function wireControls() {
  document.getElementById("settings-toggle").addEventListener("click", () => {
    const panel = document.getElementById("settings-panel");
    const nowHidden = panel.classList.toggle("hidden");
    document.getElementById("settings-toggle").setAttribute("aria-expanded", String(!nowHidden));
  });

  document
    .querySelectorAll(".color-filter, .role-filter, #kind-instant, #kind-flash, #kind-activated")
    .forEach((el) => {
      el.addEventListener("change", () => {
        rebuildQueue();
        showNextCard();
        renderBrowseView();
      });
    });

  document.getElementById("mana-only-mode").addEventListener("change", (e) => {
    manaOnlyMode = e.target.checked;
    if (currentCard && !answerShown) renderFront(currentCard);
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

  document.getElementById("tab-study").addEventListener("click", () => switchTab("study"));
  document.getElementById("tab-browse").addEventListener("click", () => switchTab("browse"));

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

function switchTab(tab) {
  const isStudy = tab === "study";
  document.getElementById("study-view").classList.toggle("hidden", !isStudy);
  document.getElementById("browse-view").classList.toggle("hidden", isStudy);
  document.getElementById("tab-study").classList.toggle("active", isStudy);
  document.getElementById("tab-study").setAttribute("aria-selected", String(isStudy));
  document.getElementById("tab-browse").classList.toggle("active", !isStudy);
  document.getElementById("tab-browse").setAttribute("aria-selected", String(!isStudy));
}

function activeFilters() {
  const colors = Array.from(document.querySelectorAll(".color-filter:checked")).map((el) => el.value);
  const roles = Array.from(document.querySelectorAll(".role-filter:checked")).map((el) => el.value);
  const kinds = Object.entries(KIND_FILTER_IDS)
    .filter(([, id]) => document.getElementById(id).checked)
    .map(([kind]) => kind);
  return { colors, roles, kinds };
}

function cardMatchesFilters(card, filters) {
  const isMulti = card.colors.length > 1;
  const isColorless = card.colors.length === 0;
  const colorMatch =
    card.colors.some((c) => filters.colors.includes(c)) || ((isMulti || isColorless) && filters.colors.includes("C"));
  const kindMatch = filters.kinds.includes(card.kind);
  const roleMatch = filters.roles.includes(card.role);
  return colorMatch && kindMatch && roleMatch;
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
  const graduated = allCards.filter((c) => srsIsGraduated(srsGetState(progress, c.id))).length;
  document.getElementById("stat-graduated").textContent = `${graduated}/${allCards.length}`;
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

function renderManaCost(manaCost, container) {
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
    const label = letters.length ? letters.map((l) => PIP_NAMES[l]).join(" or ") + " mana" : `${symbol} generic mana`;
    pip.setAttribute("aria-label", label);
    container.appendChild(pip);
  });
}

const KIND_LABELS = {
  instant: "Instant",
  flash_permanent: "Flash permanent",
  activated_ability: "Instant-speed activated ability",
};

function renderFront(card) {
  renderManaCost(card.mana_cost, document.getElementById("front-mana"));
  document.getElementById("front-name").textContent = manaOnlyMode ? "?" : card.name;
  document.getElementById("front-type").textContent = manaOnlyMode ? KIND_LABELS[card.kind] : card.type_line;
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
    image.alt = `${img.label} card art`;
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
  const saved = srsSaveProgress(progress);
  if (!saved) {
    alert("Couldn't save progress (browser storage may be full or disabled). Your rating for this card wasn't recorded.");
  }

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
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch (err) {
      alert("That file isn't valid JSON.");
      return;
    }
    const { valid, dropped } = srsSanitizeImport(parsed);
    if (Object.keys(valid).length === 0) {
      alert("That file doesn't contain any recognizable progress entries.");
      return;
    }
    progress = { ...progress, ...valid };
    srsSaveProgress(progress);
    rebuildQueue();
    showNextCard();
    const droppedMsg = dropped > 0 ? ` (${dropped} entr${dropped === 1 ? "y was" : "ies were"} skipped as invalid)` : "";
    alert(`Imported ${Object.keys(valid).length} card(s) of progress.${droppedMsg}`);
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

const ROLE_LABELS = {
  combat_trick: "Combat trick",
  removal: "Removal",
  protection: "Protection",
  counter: "Counter",
  card_advantage: "Card advantage",
  tempo_permanent: "Tempo permanent",
  utility: "Utility",
};

function renderBrowseView() {
  const filters = activeFilters();
  const filtered = allCards
    .filter((c) => cardMatchesFilters(c, filters))
    .sort((a, b) => a.cmc - b.cmc || a.name.localeCompare(b.name));

  const grid = document.getElementById("browse-grid");
  grid.innerHTML = "";

  if (filtered.length === 0) {
    grid.innerHTML = "<p>No cards match the current filters.</p>";
    return;
  }

  filtered.forEach((card) => {
    const entry = document.createElement("article");
    entry.className = "browse-card";

    const img = document.createElement("img");
    img.src = card.images[0].url;
    img.alt = `${card.name} card art`;
    entry.appendChild(img);

    const info = document.createElement("div");
    info.className = "browse-card-info";

    const title = document.createElement("h3");
    title.textContent = card.name;
    info.appendChild(title);

    const meta = document.createElement("p");
    meta.className = "browse-card-meta";
    meta.textContent = `${card.type_line} · ${KIND_LABELS[card.kind]} · ${ROLE_LABELS[card.role]}`;
    info.appendChild(meta);

    const oracle = document.createElement("p");
    oracle.className = "browse-card-oracle";
    oracle.textContent = card.oracle_text;
    info.appendChild(oracle);

    entry.appendChild(info);
    grid.appendChild(entry);
  });
}

init();
