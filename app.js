// GirlMath: earn gold coins with little to-dos, fill piggy banks, shop guilt-free.
// Everything is stored locally in the browser (localStorage). No accounts, no server.

const STORAGE_KEY = "girlmath:v1";

const JAR_EMOJIS = ["👟", "👜", "👗", "💄", "💅", "🎧", "💍", "🧸", "✈️", "🛍️", "📱", "🎮", "🌸", "☕"];

const SUGGESTIONS = [
  { name: "Tidy my room 🧹", coins: 20 },
  { name: "Workout 🏃‍♀️", coins: 30 },
  { name: "Packed lunch 🥪", coins: 25 },
  { name: "Drink 2L of water 💧", coins: 10, daily: true },
  { name: "Study for 1 hour 📚", coins: 30 },
  { name: "Skipped takeaway 🍕", coins: 40 },
  { name: "Did the laundry 🧺", coins: 20 },
  { name: "Made my bed 🛏️", coins: 5, daily: true },
];

// ---------- State ----------

let state = load();

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.jars)) {
      return {
        jars: saved.jars,
        history: Array.isArray(saved.history) ? saved.history : [],
        activeJarId: saved.activeJarId || null,
      };
    }
  } catch (e) {
    // Storage blocked or corrupt; start fresh.
  }
  return { jars: [], history: [], activeJarId: null };
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // Private mode etc. The app still works for this visit.
  }
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Daily to-dos count as done only on the day they were ticked; one-off to-dos stay done.
function isDone(task) {
  return task.daily ? task.lastDone === today() : Boolean(task.lastDone);
}

function activeJar() {
  return state.jars.find((j) => j.id === state.activeJarId) || state.jars[0] || null;
}

function percent(jar) {
  return Math.min(100, Math.round((jar.coins / jar.goal) * 100));
}

// ---------- DOM helpers ----------

const $ = (id) => document.getElementById(id);

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of [].concat(children)) {
    if (child != null) node.append(child);
  }
  return node;
}

let toastTimer;
function toast(message) {
  const t = $("toast");
  t.textContent = message;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}

function cheerFor(jar) {
  const p = percent(jar);
  const left = jar.goal - jar.coins;
  if (p >= 100) return "Jar is full! You earned it, queen 👑";
  if (p >= 75) return `Almost there! Only ${left} coins to go 😍`;
  if (p >= 50) return `Over halfway! ${left} coins left ✨`;
  if (p >= 25) return `Look at you go! ${left} coins left 💪`;
  if (p > 0) return `Great start! ${left} coins left 🌱`;
  return "Finish a to-do to drop in your first coins 🪙";
}

// ---------- Rendering ----------

function render() {
  const jar = activeJar();
  if (jar) state.activeJarId = jar.id;

  renderTabs(jar);
  $("emptyState").hidden = Boolean(jar);
  $("jarView").hidden = !jar;
  if (jar) {
    renderJar(jar);
    renderTasks(jar);
  }
  renderHistory();
}

function renderTabs(active) {
  const tabs = $("jarTabs");
  tabs.replaceChildren();
  for (const jar of state.jars) {
    const full = jar.coins >= jar.goal;
    const tab = el("button", {
      className: "tab" + (active && jar.id === active.id ? " active" : "") + (full ? " full" : ""),
      type: "button",
      onclick: () => {
        state.activeJarId = jar.id;
        save();
        render();
      },
    }, [
      el("span", { textContent: jar.emoji }),
      el("span", { textContent: jar.name }),
      el("span", { className: "pct", textContent: full ? "full!" : percent(jar) + "%" }),
    ]);
    tabs.append(tab);
  }
  tabs.append(el("button", {
    className: "tab new",
    type: "button",
    textContent: "+ New jar",
    onclick: () => openJarDialog(),
  }));
}

function renderJar(jar) {
  const p = percent(jar);
  $("jarEmoji").textContent = jar.emoji;
  $("jarName").textContent = jar.name;
  $("jarGoalText").textContent = `Goal: ${jar.goal} coins`;
  $("jarCoins").textContent = jar.coins;
  $("jarFill").style.height = p + "%";
  $("progressFill").style.width = p + "%";
  $("progressBar").setAttribute("aria-valuenow", p);
  $("cheer").textContent = cheerFor(jar);
  $("smashBtn").hidden = jar.coins < jar.goal;
}

function renderTasks(jar) {
  const list = $("taskList");
  list.replaceChildren();

  for (const task of jar.tasks) {
    const done = isDone(task);
    const li = el("li", { className: "task" + (done ? " done" : "") });

    const main = el("button", {
      className: "task-main",
      type: "button",
      ariaLabel: `${task.name}, ${task.coins} coins, ${done ? "done, tap to undo" : "tap when done"}`,
      onclick: (e) => toggleTask(jar, task, e.currentTarget),
    }, [
      el("span", { className: "check", textContent: done ? "✓" : "" }),
      el("span", { className: "task-text" }, [
        el("span", { className: "task-name", textContent: task.name }),
        task.daily ? el("span", { className: "task-tag", textContent: "🔁 every day" }) : null,
      ]),
      el("span", { className: "task-coins", textContent: `+${task.coins} 🪙` }),
    ]);

    const del = el("button", {
      className: "task-delete",
      type: "button",
      ariaLabel: `Delete ${task.name}`,
      textContent: "×",
      onclick: () => {
        jar.tasks = jar.tasks.filter((t) => t.id !== task.id);
        save();
        render();
      },
    });

    li.append(main, del);
    list.append(li);
  }

  // Suggestions only while the jar has few to-dos, and never ones already added.
  const names = new Set(jar.tasks.map((t) => t.name));
  const ideas = SUGGESTIONS.filter((s) => !names.has(s.name));
  $("suggestions").hidden = jar.tasks.length >= 5 || ideas.length === 0;
  const chips = $("suggestionChips");
  chips.replaceChildren();
  for (const idea of ideas.slice(0, 6)) {
    chips.append(el("button", {
      className: "chip",
      type: "button",
      textContent: `${idea.name} · ${idea.coins}🪙`,
      onclick: () => addTask(jar, idea.name, idea.coins, Boolean(idea.daily)),
    }));
  }
}

function renderHistory() {
  const list = $("historyList");
  list.replaceChildren();
  $("history").hidden = state.history.length === 0;
  for (const item of [...state.history].reverse()) {
    const date = new Date(item.smashedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    list.append(el("li", {}, [
      el("span", { className: "h-emoji", textContent: item.emoji }),
      el("span", {}, [
        el("span", { className: "h-name", textContent: item.name }),
        el("span", { className: "h-meta", textContent: `${item.goal} coins · ${date}` }),
      ]),
    ]));
  }
}

// ---------- Actions ----------

function addTask(jar, name, coins, daily) {
  jar.tasks.push({ id: uid(), name, coins, daily, lastDone: null });
  save();
  render();
}

function toggleTask(jar, task, button) {
  if (isDone(task)) {
    task.lastDone = null;
    jar.coins = Math.max(0, jar.coins - task.coins);
    save();
    render();
    toast(`Undone. ${task.coins} coins taken back.`);
    return;
  }

  const wasFull = jar.coins >= jar.goal;
  task.lastDone = today();
  jar.coins += task.coins;
  save();

  // The to-do ticks off right away; the jar fills when the coin lands.
  flyCoin(button.querySelector(".task-coins"), () => {
    render();
    const j = $("jar");
    j.classList.remove("bump");
    void j.offsetWidth; // restart the animation
    j.classList.add("bump");
  });
  renderTasks(jar);

  if (!wasFull && jar.coins >= jar.goal) {
    toast("Your jar is full! Time to smash it 🔨");
  } else {
    toast(`+${task.coins} coins! 💰`);
  }
}

function smashJar() {
  const jar = activeJar();
  if (!jar || jar.coins < jar.goal) return;

  state.history.push({ name: jar.name, emoji: jar.emoji, goal: jar.goal, smashedAt: new Date().toISOString() });
  state.jars = state.jars.filter((j) => j.id !== jar.id);
  state.activeJarId = state.jars[0] ? state.jars[0].id : null;
  save();

  confetti();
  $("celebrateEmoji").textContent = jar.emoji;
  $("celebrateText").textContent = `You earned your ${jar.name} with ${jar.coins} gold coins.`;
  $("celebrateDialog").showModal();
  render();
}

// ---------- Jar dialog ----------

let editingJarId = null;
let selectedEmoji = JAR_EMOJIS[0];

function renderEmojiPicker() {
  const picker = $("emojiPicker");
  picker.replaceChildren();
  for (const emoji of JAR_EMOJIS) {
    picker.append(el("button", {
      type: "button",
      className: emoji === selectedEmoji ? "selected" : "",
      textContent: emoji,
      ariaLabel: `Icon ${emoji}`,
      onclick: () => {
        selectedEmoji = emoji;
        renderEmojiPicker();
      },
    }));
  }
}

function openJarDialog(jar = null) {
  editingJarId = jar ? jar.id : null;
  selectedEmoji = jar ? jar.emoji : JAR_EMOJIS[state.jars.length % JAR_EMOJIS.length];
  $("jarDialogTitle").textContent = jar ? "Edit piggy bank" : "New piggy bank";
  $("jarNameInput").value = jar ? jar.name : "";
  $("jarGoalInput").value = jar ? jar.goal : 500;
  $("deleteJarBtn").hidden = !jar;
  renderEmojiPicker();
  $("jarDialog").showModal();
  if (!jar) $("jarNameInput").focus();
}

$("jarForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("jarNameInput").value.trim();
  const goal = Math.round(Number($("jarGoalInput").value));
  if (!name || !(goal >= 1)) return;

  if (editingJarId) {
    const jar = state.jars.find((j) => j.id === editingJarId);
    Object.assign(jar, { name, goal, emoji: selectedEmoji });
    toast("Jar updated ✨");
  } else {
    const jar = { id: uid(), name, emoji: selectedEmoji, goal, coins: 0, tasks: [], createdAt: new Date().toISOString() };
    state.jars.push(jar);
    state.activeJarId = jar.id;
    toast(`New jar for ${name}! 🐷`);
  }
  save();
  render();
  $("jarDialog").close();
});

$("cancelJarBtn").addEventListener("click", () => $("jarDialog").close());

$("deleteJarBtn").addEventListener("click", () => {
  const jar = state.jars.find((j) => j.id === editingJarId);
  if (!jar) return;
  if (!confirm(`Delete "${jar.name}" and its ${jar.coins} coins? This can't be undone.`)) return;
  state.jars = state.jars.filter((j) => j.id !== jar.id);
  state.activeJarId = state.jars[0] ? state.jars[0].id : null;
  save();
  render();
  $("jarDialog").close();
  toast("Jar deleted");
});

// ---------- Effects ----------

function flyCoin(fromEl, onArrive) {
  const target = $("jar");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!fromEl || !target || reduced || !target.animate) {
    onArrive();
    return;
  }
  const from = fromEl.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const coin = el("div", { className: "flying-coin", textContent: "🪙" });
  document.body.append(coin);

  const x0 = from.left + from.width / 2 - 14;
  const y0 = from.top + from.height / 2 - 14;
  const x1 = to.left + to.width / 2 - 14;
  const y1 = to.top + to.height * 0.35;
  const midX = (x0 + x1) / 2;
  const midY = Math.min(y0, y1) - 80;

  const anim = coin.animate([
    { transform: `translate(${x0}px, ${y0}px) scale(1)` },
    { transform: `translate(${midX}px, ${midY}px) scale(1.4) rotate(180deg)`, offset: 0.5 },
    { transform: `translate(${x1}px, ${y1}px) scale(0.8) rotate(360deg)` },
  ], { duration: 700, easing: "ease-in-out" });

  anim.onfinish = () => {
    coin.remove();
    onArrive();
  };
}

function confetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#ff6fa5", "#f7c234", "#e9dcff", "#ffd3e4", "#9be3c8", "#ffffff"];
  for (let i = 0; i < 90; i++) {
    const piece = el("div", { className: "confetti" });
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.background = colors[i % colors.length];
    piece.style.animationDuration = 1.8 + Math.random() * 1.6 + "s";
    piece.style.animationDelay = Math.random() * 0.4 + "s";
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.append(piece);
    setTimeout(() => piece.remove(), 4000);
  }
}

// ---------- Wire up ----------

$("taskForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const jar = activeJar();
  const name = $("taskName").value.trim();
  const coins = Math.round(Number($("taskCoins").value));
  if (!jar || !name || !(coins >= 1)) return;
  addTask(jar, name, coins, $("taskDaily").checked);
  $("taskName").value = "";
  $("taskDaily").checked = false;
  $("taskName").focus();
});

$("emptyNewJar").addEventListener("click", () => openJarDialog());
$("editJarBtn").addEventListener("click", () => openJarDialog(activeJar()));
$("smashBtn").addEventListener("click", smashJar);
$("celebrateClose").addEventListener("click", () => $("celebrateDialog").close());

// Daily to-dos reset at midnight; re-render when the tab becomes visible again.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) render();
});

render();
