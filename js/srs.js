// Simplified SM-2 style scheduler, modeled on Anki's defaults.
// Progress is stored in localStorage as { [cardId]: CardState }
// CardState: { ease, interval (days), due (ISO string), reps, lapses }

const SRS_STORAGE_KEY = "msh-srs-progress";

const SRS_DEFAULT_STATE = () => ({
  ease: 2.5,
  interval: 0,
  due: null, // null due = new card, always eligible
  reps: 0,
  lapses: 0,
});

function srsLoadProgress() {
  try {
    const raw = localStorage.getItem(SRS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("Failed to read progress from localStorage", e);
    return {};
  }
}

function srsSaveProgress(progress) {
  localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(progress));
}

function srsGetState(progress, cardId) {
  return progress[cardId] || SRS_DEFAULT_STATE();
}

function srsIsDue(state) {
  if (state.reps === 0) return false; // new, handled separately
  if (!state.due) return true;
  return new Date(state.due).getTime() <= Date.now();
}

function srsIsNew(state) {
  return state.reps === 0;
}

// Pure function: given a state and a rating, returns the next state.
// rating: "again" | "hard" | "good" | "easy"
function srsNextState(state, rating, now = new Date()) {
  const next = { ...state };
  const oneDay = 24 * 60 * 60 * 1000;

  switch (rating) {
    case "again":
      next.ease = Math.max(1.3, next.ease - 0.2);
      next.interval = 0;
      next.due = now.toISOString();
      next.lapses += 1;
      break;
    case "hard":
      next.ease = Math.max(1.3, next.ease - 0.15);
      next.interval = next.interval <= 0 ? 1 : next.interval * 1.2;
      next.due = new Date(now.getTime() + next.interval * oneDay).toISOString();
      next.reps += 1;
      break;
    case "good":
      if (next.reps === 0) {
        next.interval = 1;
      } else if (next.reps === 1) {
        next.interval = 6;
      } else {
        next.interval = next.interval * next.ease;
      }
      next.due = new Date(now.getTime() + next.interval * oneDay).toISOString();
      next.reps += 1;
      break;
    case "easy":
      next.ease = next.ease + 0.15;
      next.interval = next.interval <= 0 ? 4 : next.interval * next.ease * 1.3;
      next.due = new Date(now.getTime() + next.interval * oneDay).toISOString();
      next.reps += 1;
      break;
  }
  return next;
}

function srsFormatInterval(days) {
  if (days <= 0) return "<10m";
  if (days < 1) return `${Math.round(days * 24)}h`;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}
