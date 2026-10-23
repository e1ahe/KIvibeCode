// GirlMath: earn gold coins with little to-dos, fill piggy banks, shop guilt-free.
// Everything is stored locally in the browser (localStorage). No accounts, no server.

const STORAGE_KEY = "girlmath:v1";

const JAR_EMOJIS = ["👟", "👜", "👗", "💄", "💅", "🎧", "💍", "🧸", "✈️", "🛍️", "📱", "🎮", "🌸", "☕"];

const SUGGESTIONS = [
  { name: "Tidy my room 🧹", coins: 20 },
  { name: "Workout 🏃‍♀️", coins: 30, repeat: true },
  { name: "Packed lunch 🥪", coins: 25, repeat: true },
  { name: "Drink 2L of water 💧", coins: 10, repeat: true },
  { name: "Study for 1 hour 📚", coins: 30, repeat: true },
  { name: "Skipped takeaway 🍕", coins: 40, repeat: true },
  { name: "Did the laundry 🧺", coins: 20 },
  { name: "Made my bed 🛏️", coins: 5, repeat: true },
];

// How the coins are stacked inside the jar drawing.
const PILE = { capacity: 63, perRow: 7, step: 22, rowHeight: 19 };
const DROP_GAP = 80; // ms between each coin landing

// ---------- State ----------

let state = load();
const shownCoins = {}; // jar id -> coin amount currently drawn in the jar

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.jars)) {
      for (const jar of saved.jars) {
        for (const task of jar.tasks || []) {
          // Older saves had "daily" to-dos; those are now repeatable.
          if ("daily" in task) {
            task.repeat = task.daily;
            if (task.repeat) task.lastDone = null;
            delete task.daily;
          }
        }
      }
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

// One-time to-dos get ticked off; repeat to-dos can be done again and again.
function isDone(task) {
  return !task.repeat && Boolean(task.lastDone);
}

function timesToday(task) {
  return task.today && task.today.date === today() ? task.today.count : 0;
}

// How many times this to-do has paid out in total (older saves didn't track it).
function timesDone(task) {
  if (typeof task.times === "number") return task.times;
  return task.repeat ? timesToday(task) : task.lastDone ? 1 : 0;
}

function activeJar() {
  return state.jars.find((j) => j.id === state.activeJarId) || state.jars[0] || null;
}

function percent(jar) {
  return Math.min(100, Math.round((jar.coins / jar.goal) * 100));
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- Sounds (made with the Web Audio API, no sound files) ----------

const sound = (() => {
  const KEY = "girlmath:sound";
  let ctx = null;
  let on = true;
  try {
    on = localStorage.getItem(KEY) !== "off";
  } catch (e) {}

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, type = "sine", vol = 0.15) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(ctx.destination);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  function noise(start, dur, vol, type, freq) {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = buffer;
    filter.type = type;
    filter.frequency.value = freq;
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start(start);
  }

  // Runs fn(currentTime) only when sound is on and audio is available.
  const play = (fn) => () => {
    if (!on || !audio()) return;
    fn(ctx.currentTime);
  };

  return {
    get on() {
      return on;
    },
    toggle() {
      on = !on;
      try {
        localStorage.setItem(KEY, on ? "on" : "off");
      } catch (e) {}
      if (on) audio();
      return on;
    },
    // Browsers (iPhone especially) only allow sound after the user has touched the page.
    unlock() {
      if (on) audio();
    },
    clink: play((t) => {
      const f = 2300 + Math.random() * 900;
      tone(f, t, 0.12, "triangle", 0.07);
      tone(f * 1.5, t, 0.08, "sine", 0.04);
    }),
    kaching: play((t) => {
      noise(t, 0.07, 0.3, "bandpass", 2500); // "ka"
      for (const f of [1976, 2637, 3951, 5274]) tone(f, t + 0.08, 0.9, "sine", 0.09); // "ching"
      for (const f of [2093, 3136]) tone(f, t + 0.14, 0.7, "triangle", 0.05);
    }),
    fanfare: play((t) => {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.11, 0.3, "triangle", 0.12));
      for (const f of [523, 659, 784, 1047]) tone(f, t + 0.46, 0.9, "triangle", 0.07);
    }),
    // A crack that gets higher and louder with every hit.
    crack: (stage) => play((t) => {
      tone(110, t, 0.12, "sine", 0.3);
      noise(t, 0.12, 0.2 + stage * 0.06, "bandpass", 2500 + stage * 600);
      tone(1400 + stage * 350, t, 0.07, "square", 0.04);
    })(),
    smash: play((t) => {
      tone(70, t, 0.35, "sine", 0.5); // thud
      noise(t, 0.35, 0.5, "lowpass", 1400); // crunch
      noise(t + 0.02, 0.7, 0.25, "highpass", 5000); // glass
      for (let i = 0; i < 14; i++) tone(3000 + Math.random() * 4500, t + Math.random() * 0.4, 0.09, "triangle", 0.05);
    }),
  };
})();

function renderSoundBtn() {
  const btn = $("soundBtn");
  btn.textContent = sound.on ? "🔊" : "🔇";
  btn.setAttribute("aria-label", sound.on ? "Sound on, tap to mute" : "Sound off, tap to turn on");
}

function cheerFor(jar) {
  const p = percent(jar);
  const left = jar.goal - jar.coins;
  if (jar.coins > jar.goal) return "Overflowing! You earned it, queen 👑";
  if (p >= 100) return "Jar is full! You earned it, queen 👑";
  if (p >= 75) return `Almost there! Only ${left} coins to go 😍`;
  if (p >= 50) return `Over halfway! ${left} coins left ✨`;
  if (p >= 25) return `Look at you go! ${left} coins left 💪`;
  if (p > 0) return `Great start! ${left} coins left 🌱`;
  return "Finish a to-do to drop in your first coins 🪙";
}

// Small question dialog. Resolves true (yes), false (no) or null (cancelled).
function askChoice({ emoji = "🥺", text, yes, no, cancel = null, yesClass = "btn-danger" }) {
  return new Promise((resolve) => {
    const dialog = $("confirmDialog");
    $("confirmEmoji").textContent = emoji;
    $("confirmText").textContent = text;
    $("confirmYes").textContent = yes;
    $("confirmYes").className = "btn " + yesClass;
    $("confirmNo").textContent = no;
    $("confirmCancel").hidden = !cancel;
    if (cancel) $("confirmCancel").textContent = cancel;
    const finish = (answer) => {
      $("confirmYes").onclick = $("confirmNo").onclick = $("confirmCancel").onclick = dialog.oncancel = null;
      dialog.close();
      resolve(answer);
    };
    $("confirmYes").onclick = () => finish(true);
    $("confirmNo").onclick = () => finish(false);
    $("confirmCancel").onclick = () => finish(null);
    dialog.oncancel = (e) => {
      e.preventDefault();
      finish(null);
    };
    dialog.showModal();
  });
}

// ---------- Rendering ----------

// Returns how long (ms) the coin-drop animation in the jar will take.
function render({ animate = false } = {}) {
  const jar = activeJar();
  if (jar) state.activeJarId = jar.id;

  renderTabs(jar);
  $("emptyState").hidden = Boolean(jar);
  $("jarView").hidden = !jar;
  let dropTime = 0;
  if (jar) {
    dropTime = renderJar(jar, animate);
    renderTasks(jar);
  }
  renderHistory();
  return dropTime;
}

function renderTabs(active) {
  const tabs = $("jarTabs");
  tabs.replaceChildren();
  for (const jar of state.jars) {
    const full = jar.coins >= jar.goal;
    tabs.append(el("button", {
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
    ]));
  }
  tabs.append(el("button", {
    className: "tab new",
    type: "button",
    textContent: "+ New jar",
    onclick: () => openJarDialog(),
  }));
}

function renderJar(jar, animate) {
  const p = percent(jar);
  const full = jar.coins >= jar.goal;
  $("jarEmoji").textContent = jar.emoji;
  $("jarName").textContent = jar.name;
  $("jarSub").textContent = full ? "Full! 🎉" : `${p}% full`;
  $("jarGoal").textContent = jar.goal;
  $("progressFill").style.width = p + "%";
  $("progressBar").setAttribute("aria-valuenow", p);
  $("cheer").textContent = cheerFor(jar);
  $("jar").classList.toggle("full", full);
  const wrap = $("jarWrap");
  wrap.classList.toggle("full", full);
  wrap.classList.toggle("smashable", full);
  wrap.classList.remove("broken");
  if (full) {
    wrap.setAttribute("role", "button");
    wrap.setAttribute("tabindex", "0");
    wrap.setAttribute("aria-label", "Tap the jar to smash it");
  } else {
    wrap.removeAttribute("role");
    wrap.removeAttribute("tabindex");
    wrap.removeAttribute("aria-label");
  }
  if (hits.jarId !== jar.id || !full) hits = { jarId: jar.id, count: 0 };
  showCracks(hits.count);
  $("smashHint").hidden = !full;
  updateSmashHint();

  const from = animate && shownCoins[jar.id] != null ? shownCoins[jar.id] : jar.coins;
  shownCoins[jar.id] = jar.coins;
  const dropTime = drawPile(jar, animate && jar.coins > from);
  countUp($("jarCoins"), from, jar.coins, dropTime);
  return dropTime;
}

function visualCount(coins, goal) {
  if (coins <= 0) return 0;
  return Math.max(1, Math.round((Math.min(coins, goal) / goal) * PILE.capacity));
}

// Same "random" wobble for the same coin every time, so the pile doesn't jump around.
function wobble(i, k) {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x) - 0.5;
}

function coinSpot(i) {
  const row = Math.floor(i / PILE.perRow);
  const col = i % PILE.perRow;
  return {
    left: 4 + col * PILE.step + (row % 2 ? 9 : 0) + wobble(i, 1) * 3,
    bottom: 3 + row * PILE.rowHeight + wobble(i, 2) * 3,
    rot: wobble(i, 3) * 50,
  };
}

function makeCoin({ left, bottom, rot }) {
  const coin = el("div", { className: "coin" });
  coin.style.left = left + "px";
  coin.style.bottom = bottom + "px";
  coin.style.transform = `rotate(${rot}deg)`;
  return coin;
}

// Drops a coin from the top of the jar onto its spot. "Bonus" coins fade away after landing.
function dropCoin(coin, { bottom, rot }, delay, bonus = false) {
  const h = 230 - bottom;
  const frames = [
    { transform: `translateY(${-h}px) rotate(${rot - 120}deg)`, opacity: 0 },
    { opacity: 1, offset: 0.08 },
    { transform: `translateY(0) rotate(${rot}deg)`, offset: bonus ? 0.55 : 0.72 },
    { transform: `translateY(-7px) rotate(${rot}deg)`, offset: bonus ? 0.66 : 0.86 },
    { transform: `translateY(0) rotate(${rot}deg)`, opacity: 1, offset: bonus ? 0.78 : 1 },
  ];
  if (bonus) frames.push({ transform: `translateY(0) rotate(${rot}deg) scale(0.6)`, opacity: 0 });
  return coin.animate(frames, {
    duration: bonus ? 760 : 560,
    delay,
    easing: "ease-in",
    fill: bonus ? "both" : "backwards",
  });
}

// Keeps the coins already in the jar and only adds/removes the difference,
// so nothing flickers when the jar is nearly full.
function drawPile(jar, animate) {
  const pile = $("jarPile");
  if (pile.dataset.jar !== jar.id) {
    pile.replaceChildren();
    pile.dataset.jar = jar.id;
    animate = false;
  }
  pile.querySelectorAll(".bonus").forEach((c) => c.remove());

  const target = visualCount(jar.coins, jar.goal);
  const coins = pile.children;
  while (coins.length > target) coins[coins.length - 1].remove();
  const have = coins.length;
  const newOnes = target - have;
  const motion = animate && !reducedMotion() && Boolean(pile.animate);
  // Lots of new coins fall faster so a big to-do still finishes in about 2 seconds.
  const gap = Math.min(DROP_GAP, 1500 / Math.max(newOnes, 1));

  for (let i = have; i < target; i++) {
    const spot = coinSpot(i);
    const coin = makeCoin(spot);
    pile.append(coin);
    if (motion) {
      dropCoin(coin, spot, (i - have) * gap);
      // A little clink as coins land (not for every coin when lots fall at once).
      if (i - have < 12 && (newOnes < 12 || (i - have) % 2 === 0)) {
        setTimeout(sound.clink, (i - have) * gap + 400);
      }
    }
  }
  if (!motion) return 0;

  // Always show at least 3 coins falling in, even when the pile can't grow
  // (a big goal, or a jar that is already full).
  const bonus = Math.max(0, 3 - newOnes);
  for (let k = 0; k < bonus; k++) {
    const i = Math.min(target + k, PILE.capacity - 1 - k * 3);
    const spot = coinSpot(i);
    if (target + k >= PILE.capacity) spot.bottom += 10;
    const coin = makeCoin(spot);
    coin.classList.add("bonus");
    pile.append(coin);
    const anim = dropCoin(coin, spot, (newOnes + k) * DROP_GAP, true);
    anim.onfinish = () => coin.remove();
    setTimeout(sound.clink, (newOnes + k) * DROP_GAP + 420);
  }
  const last = newOnes > 0 ? (newOnes - 1) * gap + 560 : 0;
  return Math.max(last, bonus ? (newOnes + bonus - 1) * DROP_GAP + 560 : 0);
}

function countUp(node, from, to, duration) {
  if (!duration || from === to) {
    node.textContent = to;
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    node.textContent = Math.round(from + (to - from) * t);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderTasks(jar) {
  const list = $("taskList");
  list.replaceChildren();

  for (const task of jar.tasks) {
    const done = isDone(task);
    const count = task.repeat ? timesToday(task) : 0;
    const li = el("li", { className: "task" + (done ? " done" : "") });
    li.dataset.id = task.id;

    let tag = null;
    if (task.repeat) {
      tag = el("span", {
        className: "task-tag",
        textContent: "🔁 repeat" + (count ? ` · done ${count}× today` : ""),
      });
    }

    const main = el("button", {
      className: "task-main",
      type: "button",
      ariaLabel: task.repeat
        ? `${task.name}, ${task.coins} coins, tap every time you do it`
        : `${task.name}, ${task.coins} coins, ${done ? "done, tap to undo" : "tap when done"}`,
      onclick: (e) => {
        if (done) undoTask(jar, task);
        else completeTask(jar, task, e.currentTarget);
      },
    }, [
      el("span", {
        className: "check" + (task.repeat ? " plus" : ""),
        textContent: task.repeat ? "+" : done ? "✓" : "",
      }),
      el("span", { className: "task-text" }, [
        el("span", { className: "task-name", textContent: task.name }),
        tag,
      ]),
      el("span", { className: "task-coins", textContent: `+${task.coins} 🪙` }),
    ]);
    li.append(main);

    if (task.repeat && count > 0) {
      li.append(el("button", {
        className: "task-icon-btn",
        type: "button",
        ariaLabel: `Undo one ${task.name}`,
        title: "Undo one",
        textContent: "↶",
        onclick: () => undoTask(jar, task),
      }));
    }

    li.append(el("button", {
      className: "task-icon-btn",
      type: "button",
      ariaLabel: `Delete ${task.name}`,
      title: "Delete",
      textContent: "×",
      onclick: () => deleteTask(jar, task),
    }));

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
      onclick: () => addTask(jar, idea.name, idea.coins, Boolean(idea.repeat)),
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
      el("span", { className: "h-text" }, [
        el("span", { className: "h-name", textContent: item.name }),
        el("span", { className: "h-meta", textContent: `${item.goal} coins · ${date}` }),
      ]),
      el("button", {
        className: "task-icon-btn",
        type: "button",
        ariaLabel: `Remove ${item.name} from your treats`,
        title: "Remove",
        textContent: "×",
        onclick: () => removeTreat(item),
      }),
    ]));
  }
}

// ---------- Actions ----------

function addTask(jar, name, coins, repeat) {
  jar.tasks.push({ id: uid(), name, coins, repeat, lastDone: null });
  save();
  render();
}

function completeTask(jar, task, button) {
  const wasFull = jar.coins >= jar.goal;
  task.times = timesDone(task) + 1;
  if (task.repeat) task.today = { date: today(), count: timesToday(task) + 1 };
  else task.lastDone = today();
  jar.coins += task.coins;
  save();

  const nowFull = jar.coins >= jar.goal;
  const overflow = nowFull ? Math.min(task.coins, jar.coins - jar.goal) : 0;

  // The to-do ticks off right away; the coins drop in when the flying coin lands.
  flyCoin(button.querySelector(".task-coins"), () => {
    if (activeJar() !== jar) return;
    sound.kaching();
    const dropTime = render({ animate: true });
    setTimeout(() => {
      if (activeJar() !== jar) return;
      if (!wasFull && nowFull) celebrateFull();
      if (overflow > 0) spillCoins(Math.min(12, Math.max(4, Math.round((overflow / jar.goal) * PILE.capacity))));
    }, dropTime);
  });
  renderTasks(jar);

  const li = $("taskList").querySelector(`[data-id="${task.id}"]`);
  if (li && task.repeat) li.classList.add("flash");

  if (!wasFull && nowFull) toast("Your jar is full! 🎉");
  else toast(`+${task.coins} coins! 💰`);
}

function undoTask(jar, task) {
  if (task.repeat) {
    const count = timesToday(task);
    if (!count) return;
    task.today = { date: today(), count: count - 1 };
  } else {
    task.lastDone = null;
  }
  task.times = Math.max(0, timesDone(task) - 1);
  jar.coins = Math.max(0, jar.coins - task.coins);
  save();
  render();
  toast(`Undone. ${task.coins} coins taken back.`);
}

async function removeTreat(item) {
  const ok = await askChoice({
    emoji: item.emoji,
    text: `Remove "${item.name}" from your treats?`,
    yes: "Remove",
    no: "Keep it",
  });
  if (!ok) return;
  state.history = state.history.filter((h) => h !== item);
  save();
  render();
  toast("Treat removed");
}

async function deleteTask(jar, task) {
  const earned = timesDone(task) * task.coins;
  let takeBack = false;
  if (earned > 0) {
    const answer = await askChoice({
      emoji: "🪙",
      text: `"${task.name}" earned ${earned} coins. Take them back out of the jar too?`,
      yes: "Take back",
      no: "Keep coins",
      cancel: "Cancel",
      yesClass: "btn-primary",
    });
    if (answer === null) return;
    takeBack = answer;
  }
  jar.tasks = jar.tasks.filter((t) => t.id !== task.id);
  if (takeBack) jar.coins = Math.max(0, jar.coins - earned);
  save();
  render();
  toast(takeBack ? `To-do deleted, ${earned} coins taken back` : "To-do deleted");
}

function deleteJar(jar) {
  state.jars = state.jars.filter((j) => j.id !== jar.id);
  state.activeJarId = state.jars[0] ? state.jars[0].id : null;
  delete shownCoins[jar.id];
  save();
  render();
  toast("Jar deleted");
}

async function confirmDeleteJar(jar) {
  if (!jar) return;
  const ok = await askChoice({
    text: `Delete "${jar.name}"? Its ${jar.coins} coins and to-dos will be gone for good.`,
    yes: "Delete",
    no: "Keep it",
  });
  if (ok) deleteJar(jar);
}

// A full jar breaks a little more with every tap, and smashes on the last one.
const HITS_TO_SMASH = 5;
let hits = { jarId: null, count: 0 };
let smashing = false;

function showCracks(count) {
  document.querySelectorAll(".crack").forEach((c, i) => c.classList.toggle("show", i < count));
}

function updateSmashHint() {
  const left = HITS_TO_SMASH - hits.count;
  $("smashHint").textContent = hits.count === 0
    ? "👆 Tap the jar to smash it!"
    : left === 1 ? "One more tap! 💥" : `Keep tapping! ${left} more 🔨`;
}

function hitJar(e) {
  const jar = activeJar();
  if (!jar || jar.coins < jar.goal || smashing) return;
  if (hits.jarId !== jar.id) hits = { jarId: jar.id, count: 0 };
  hits.count++;
  if (hits.count >= HITS_TO_SMASH) {
    hits.count = 0;
    smashJar();
    return;
  }

  const r = $("jar").getBoundingClientRect();
  const x = e && e.clientX ? e.clientX : r.left + r.width / 2;
  const y = e && e.clientY ? e.clientY : r.top + r.height / 2;

  sound.crack(hits.count);
  showCracks(hits.count);
  updateSmashHint();

  const jarEl = $("jar");
  jarEl.classList.remove("hit");
  void jarEl.offsetWidth; // restart the animation
  jarEl.classList.add("hit");

  if (!reducedMotion() && document.body.animate) {
    const hammer = el("div", { className: "hammer mini", textContent: "🔨" });
    hammer.style.left = x - 12 + "px";
    hammer.style.top = y - 48 + "px";
    document.body.append(hammer);
    setTimeout(() => hammer.remove(), 320);
    shards({ left: x - 20, top: y - 20, width: 40, height: 40 }, 3 + hits.count, 0.5);
    coinFountain({ left: r.left, top: r.top, width: r.width, height: 40 }, hits.count, 0.5);
  }
}

async function smashJar() {
  const jar = activeJar();
  if (!jar || jar.coins < jar.goal || smashing) return;
  smashing = true;

  if (reducedMotion()) {
    sound.smash();
  } else {
    await smashSequence(jar);
  }

  state.history.push({ name: jar.name, emoji: jar.emoji, goal: jar.goal, smashedAt: new Date().toISOString() });
  state.jars = state.jars.filter((j) => j.id !== jar.id);
  state.activeJarId = state.jars[0] ? state.jars[0].id : null;
  delete shownCoins[jar.id];
  save();

  $("celebrateEmoji").textContent = jar.emoji;
  $("celebrateText").textContent = `You earned your ${jar.name} with ${jar.coins} gold coins.`;
  $("celebrateDialog").showModal();
  sound.fanfare();
  render();
  smashing = false;
}

// The final hit: flash, the jar shatters and coins + glitter fly everywhere.
async function smashSequence(jar) {
  const wrap = $("jarWrap");
  const r = $("jar").getBoundingClientRect();
  sound.smash();
  wrap.classList.add("broken");
  document.body.append(el("div", { className: "flash" }));
  document.body.classList.add("quake");
  shards(r);
  coinFountain(r, 45);
  glitterBurst($("jar"));
  setTimeout(() => glitterBurst($("jar")), 200);
  confetti(160);
  emojiRain([jar.emoji, "💖", "✨", "💸", "🛍️", "👑", "🪙"]);
  setTimeout(sound.kaching, 250);
  setTimeout(() => {
    document.body.classList.remove("quake");
    document.querySelectorAll(".flash").forEach((f) => f.remove());
  }, 700);
  await wait(1100);
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
  $("jarDialog").close();
  confirmDeleteJar(jar);
});

// ---------- Effects ----------

function flyCoin(fromEl, onArrive) {
  const target = $("jar");
  if (!fromEl || !target || reducedMotion() || !target.animate) {
    onArrive();
    return;
  }
  // On phones the jar can be scrolled out of view; glide up so the coins are seen landing.
  const jarBox = target.getBoundingClientRect();
  if (jarBox.top < 0 || jarBox.bottom > window.innerHeight) {
    const start = fromEl.getBoundingClientRect();
    const scrollBefore = window.scrollY;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      const moved = window.scrollY - scrollBefore;
      const top = Math.min(start.top - moved, window.innerHeight - 30);
      launchCoin({ left: start.left, top, width: start.width, height: start.height }, target, onArrive);
    }, 450);
    return;
  }
  launchCoin(fromEl.getBoundingClientRect(), target, onArrive);
}

function launchCoin(from, target, onArrive) {
  const to = target.getBoundingClientRect();
  const coin = el("div", { className: "coin loose" });
  document.body.append(coin);

  const x0 = from.left + from.width / 2 - 11;
  const y0 = from.top + from.height / 2 - 11;
  const x1 = to.left + to.width / 2 - 11;
  const y1 = to.top - 30;
  const midX = (x0 + x1) / 2;
  const midY = Math.min(y0, y1) - 80;

  const anim = coin.animate([
    { transform: `translate(${x0}px, ${y0}px) scale(1)` },
    { transform: `translate(${midX}px, ${midY}px) scale(1.5) rotate(180deg)`, offset: 0.5 },
    { transform: `translate(${x1}px, ${y1}px) scale(0.9) rotate(360deg)` },
  ], { duration: 600, easing: "ease-in-out" });

  anim.onfinish = () => {
    coin.remove();
    onArrive();
  };
}

// Coins that don't fit pop out of the jar and tumble away.
function spillCoins(count) {
  const jar = $("jar");
  if (reducedMotion() || !jar.animate) return;
  const r = jar.getBoundingClientRect();
  for (let k = 0; k < count; k++) {
    const coin = el("div", { className: "coin loose" });
    document.body.append(coin);
    const dir = k % 2 ? 1 : -1;
    const x = r.left + r.width / 2 - 11 + (Math.random() - 0.5) * 60;
    const y = r.top - 10;
    const anim = coin.animate([
      { transform: `translate(${x}px, ${y}px) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${x + dir * (30 + Math.random() * 50)}px, ${y - 50 - Math.random() * 50}px) rotate(${dir * 180}deg)`, offset: 0.3 },
      { transform: `translate(${x + dir * (90 + Math.random() * 120)}px, ${y + 300 + Math.random() * 250}px) rotate(${dir * 540}deg)`, opacity: 0 },
    ], { duration: 1300 + Math.random() * 500, delay: k * 80, easing: "cubic-bezier(.25,.6,.45,1)", fill: "backwards" });
    anim.onfinish = () => coin.remove();
  }
}

function glitterBurst(target) {
  if (reducedMotion() || !document.body.animate) return;
  const r = target.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const colors = ["#ff6fa5", "#f7c234", "#c9a7ff", "#ffffff", "#ffd3e4"];
  for (let i = 0; i < 40; i++) {
    const sparkle = i % 3 === 0;
    const p = el("div", {
      className: "glitter" + (sparkle ? "" : " dot"),
      textContent: sparkle ? (i % 2 ? "✨" : "⭐") : "",
    });
    p.style.color = colors[i % colors.length];
    document.body.append(p);
    const angle = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * 140;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const anim = p.animate([
      { transform: `translate(${cx}px, ${cy}px) scale(0)`, opacity: 1 },
      { transform: `translate(${cx + dx * 0.7}px, ${cy + dy * 0.7}px) scale(1.2)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${cx + dx}px, ${cy + dy + 40}px) scale(0) rotate(180deg)`, opacity: 0 },
    ], { duration: 1000 + Math.random() * 700, delay: Math.random() * 200, easing: "ease-out", fill: "backwards" });
    anim.onfinish = () => p.remove();
  }
}

// Thrown along a curve with gravity: x = x0 + vx·t, y = y0 + vy·t + ½·g·t²
function throwPiece(node, x0, y0, vx, vy, spin, duration) {
  const g = 1500;
  const T = duration / 1000;
  const frames = [];
  for (const s of [0, 0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 1]) {
    const t = s * T;
    frames.push({
      transform: `translate(${x0 + vx * t}px, ${y0 + vy * t + 0.5 * g * t * t}px) rotate(${spin * s}deg)`,
      opacity: s > 0.8 ? 1 - (s - 0.8) * 5 : 1,
    });
  }
  const anim = node.animate(frames, { duration, delay: Math.random() * 120, easing: "linear", fill: "backwards" });
  anim.onfinish = () => node.remove();
}

// power < 1 makes a smaller, gentler burst (used for the little hits before the smash).
function coinFountain(r, count, power = 1) {
  const cx = r.left + r.width / 2 - 11;
  const cy = r.top + r.height / 2 - 11;
  for (let i = 0; i < count; i++) {
    const coin = el("div", { className: "coin loose" });
    document.body.append(coin);
    throwPiece(coin, cx + (Math.random() - 0.5) * 60, cy + (Math.random() - 0.5) * 60,
      (Math.random() - 0.5) * 600 * power, -(350 + Math.random() * 450) * power, (Math.random() - 0.5) * 1440, 1500 + Math.random() * 600);
  }
}

function shards(r, count = 16, power = 1) {
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (let i = 0; i < count; i++) {
    const size = (18 + Math.random() * 30) * (power < 1 ? 0.6 : 1);
    const shard = el("div", { className: "shard" });
    shard.style.width = size + "px";
    shard.style.height = size + "px";
    const p = () => Math.round(Math.random() * 100) + "%";
    shard.style.clipPath = `polygon(${p()} 0, 100% ${p()}, ${p()} 100%, 0 ${p()})`;
    document.body.append(shard);
    throwPiece(shard, cx + (Math.random() - 0.5) * r.width, cy + (Math.random() - 0.5) * r.height,
      (Math.random() - 0.5) * 700 * power, -(150 + Math.random() * 400) * power, (Math.random() - 0.5) * 900, 1200 + Math.random() * 500);
  }
}

function emojiRain(emojis) {
  for (let i = 0; i < 30; i++) {
    const drop = el("div", { className: "rain", textContent: emojis[i % emojis.length] });
    drop.style.left = Math.random() * 95 + "vw";
    drop.style.fontSize = 1.4 + Math.random() * 1.4 + "rem";
    drop.style.animationDuration = 2 + Math.random() * 1.6 + "s";
    drop.style.animationDelay = 0.2 + Math.random() * 0.9 + "s";
    document.body.append(drop);
    setTimeout(() => drop.remove(), 5000);
  }
}

function celebrateFull() {
  sound.fanfare();
  const wrap = $("jarWrap");
  wrap.classList.remove("shake");
  void wrap.offsetWidth; // restart the animation
  wrap.classList.add("shake");
  glitterBurst($("jar"));
  setTimeout(() => glitterBurst($("jar")), 350);
}

function confetti(count = 90) {
  if (reducedMotion()) return;
  const colors = ["#ff6fa5", "#f7c234", "#e9dcff", "#ffd3e4", "#9be3c8", "#ffffff"];
  for (let i = 0; i < count; i++) {
    const piece = el("div", { className: "confetti" });
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.background = colors[i % colors.length];
    piece.style.animationDuration = 1.8 + Math.random() * 1.6 + "s";
    piece.style.animationDelay = Math.random() * 0.4 + "s";
    document.body.append(piece);
    setTimeout(() => piece.remove(), 4000);
  }
}

// ---------- Splash ----------

function hideSplash() {
  const splash = $("splash");
  if (!splash || splash.classList.contains("hide")) return;
  splash.classList.add("hide");
  setTimeout(() => splash.remove(), 600);
}
$("splash").addEventListener("click", hideSplash);
setTimeout(hideSplash, reducedMotion() ? 300 : 1900);

// ---------- Wire up ----------

$("taskForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const jar = activeJar();
  const name = $("taskName").value.trim();
  const coins = Math.round(Number($("taskCoins").value));
  if (!jar || !name || !(coins >= 1)) return;
  addTask(jar, name, coins, $("taskRepeat").checked);
  $("taskName").value = "";
  $("taskRepeat").checked = false;
  $("taskName").focus();
});

$("emptyNewJar").addEventListener("click", () => openJarDialog());
$("editJarBtn").addEventListener("click", () => openJarDialog(activeJar()));
$("deleteJarHeadBtn").addEventListener("click", () => confirmDeleteJar(activeJar()));
$("jarWrap").addEventListener("click", hitJar);
$("jarWrap").addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    hitJar(null);
  }
});
$("celebrateClose").addEventListener("click", () => $("celebrateDialog").close());
$("infoBtn").addEventListener("click", () => $("infoDialog").showModal());
$("infoClose").addEventListener("click", () => $("infoDialog").close());
$("soundBtn").addEventListener("click", () => {
  const on = sound.toggle();
  renderSoundBtn();
  if (on) sound.kaching();
});
document.addEventListener("pointerdown", () => sound.unlock(), { passive: true });

// Feel like an app on phones: no pinch-zoom (iPhone Safari ignores user-scalable=no,
// so its gesture events are blocked too). Double-tap zoom is turned off in the CSS.
for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}
document.addEventListener("touchmove", (e) => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

// "Done N× today" counters reset at midnight; refresh when coming back to the tab.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) render();
});

renderSoundBtn();
render();
