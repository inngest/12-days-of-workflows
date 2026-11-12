import { esc, setHtml } from "./render.js";

const $ = (id) => document.getElementById(id);

// The hearth from ui/specimen.html: the artwork on every card and the empty state.
const SCENE = `<svg viewBox="0 0 360 220" role="img" aria-label="A cozy fireplace with two stockings"> <rect class="s-wall" width="360" height="150"/> <rect class="s-floor" y="150" width="360" height="70"/> <rect class="s-yellow" x="30" y="20" width="76" height="58" rx="4"/> <rect class="s-paper" x="38" y="28" width="60" height="42"/> <path class="s-wall" d="M68 36l16 28H52z"/> <circle class="s-coral" cx="86" cy="38" r="5"/> <circle class="s-coral" cx="300" cy="44" r="16"/> <path class="s-stroke" d="M300 60v50"/> <rect class="s-paper" x="118" y="62" width="124" height="92"/> <rect class="s-yellow" x="106" y="50" width="148" height="14" rx="3"/> <path class="s-night" d="M146 154v-44a34 34 0 0 1 68 0v44z"/> <path class="s-coral" d="M180 154c-22-2-26-22-12-36 2 10 8 12 12-4 14 12 28 24 20 40z"/> <path class="s-yellow" d="M182 154c-10 0-12-10-4-18 2 6 6 6 8-2 8 8 10 20-4 20z"/> <path class="s-coral" d="M130 64h14v24c0 6 8 6 8 14s-6 8-12 8-10-2-10-8z"/> <rect class="s-paper" x="128" y="64" width="18" height="6"/> <path class="s-paper" d="M214 64h14v24c0 6 8 6 8 14s-6 8-12 8-10-2-10-8z"/> <rect class="s-yellow" x="212" y="64" width="18" height="6"/> <path class="s-leaf" d="M300 120l22 32h-44zM300 96l18 30h-36z"/> <rect class="s-yellow" x="294" y="152" width="12" height="10"/> <circle class="s-yellow" cx="300" cy="94" r="4"/> <ellipse class="s-paper" cx="180" cy="190" rx="92" ry="16"/> <ellipse class="s-stroke" cx="180" cy="190" rx="78" ry="11" stroke="var(--coral)" stroke-dasharray="6 6"/> </svg>`;

let state = null;
let day = null; // the day the page follows (null = let the server choose)
let side = "problem"; // what the switch says the next card should use: "problem" or "fix"
let formDay = null; // the day the form was built for
let scenario = null; // the scenario picked in the presenter drawer
let presenter = new URLSearchParams(location.search).has("presenter");

// ---------- Talking to the server ----------

async function refresh() {
  try {
    // Give up after 5 s: the next tick tries again, so the page heals by itself.
    const res = await fetch(day ? `/api/state?day=${day}` : "/api/state", {
      signal: AbortSignal.timeout(5000),
    });
    state = await res.json();
    day = state.day; // stay on this day, even if another one gets busier
    draw(state);
  } catch {
    showNotice("The studio server is not answering. Start it with: pnpm studio");
  }
}

async function loop() {
  await refresh();
  setTimeout(loop, 1000);
}

function post(path, body) {
  return fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then(() => setTimeout(refresh, 250));
}

// ---------- Drawing ----------

function showNotice(text) {
  $("notice").textContent = text;
  $("notice").hidden = !text;
}

function draw(s) {
  drawDevPanel(s);
  if (s.days.length === 0 || !s.profile) {
    $("stage").hidden = true;
    setHtml($("days"), "");
    $("day-stamp").hidden = true;
    $("switch").hidden = true;
    $("switch-note").hidden = true;
    $("day-line").textContent = "Every card, durably delivered";
    showNotice("No day is running yet. In another terminal, start one with: pnpm day 01");
    return;
  }
  $("stage").hidden = false;
  if (s.error) showNotice(`That card could not be sent: ${s.error}`);
  else if (s.cloud.message) showNotice(s.cloud.message);
  else if (s.cloud.active) showNotice("");
  else if (!s.devServer)
    showNotice("The Dev Server is not answering on :8288. Restart the day with: pnpm day NN");
  else showNotice("");

  const p = s.profile;
  if (formDay !== p.nn) {
    formDay = p.nn;
    side = p.hasContrast ? "problem" : "fix";
    drawForm(p);
  }
  drawMasthead(s);
  drawSend(s);
  drawLive(s);
  drawQueue(s);
  drawTrace(s);
  drawCompare(s);
  drawDrawer(s);
}

function drawMasthead(s) {
  const p = s.profile;
  $("day-line").textContent = `Day ${p.nn}: ${p.title}`;
  $("day-stamp").textContent = p.nn.endsWith("b")
    ? "Bonus day"
    : `Day ${Number.parseInt(p.nn, 10)}/12`;
  $("day-stamp").hidden = false;

  // Day buttons appear only when several days run at once (pnpm day all).
  const buttons = s.days.length > 1 ? s.days : [];
  setHtml(
    $("days"),
    buttons
      .map(
        (d) =>
          `<button type="button" class="button quiet" data-day="${d.nn}" aria-pressed="${d.nn === s.day}">${d.nn}</button>`,
      )
      .join(""),
  );

  $("switch").hidden = false;
  for (const button of $("switch").children) {
    button.setAttribute("aria-pressed", String(button.dataset.side === side));
    button.disabled = !p.hasContrast;
  }
  $("switch-note").textContent = "Nothing to compare today: this one is all fix.";
  $("switch-note").hidden = p.hasContrast;
}

// ---------- The send-a-card panel ----------

function fieldHtml(f, value) {
  const id = `field-${f.id}`;
  let control;
  if (f.kind === "select") {
    const options = f.options.map(
      ([v, label]) =>
        `<option value="${esc(v)}"${v === value ? " selected" : ""}>${esc(label)}</option>`,
    );
    control = `<select id="${id}" name="${f.id}">${options.join("")}</select>`;
  } else if (f.kind === "textarea") {
    control = `<textarea id="${id}" name="${f.id}" rows="2" placeholder="${esc(f.placeholder ?? "")}">${esc(value)}</textarea>`;
  } else {
    control = `<input id="${id}" name="${f.id}" value="${esc(value)}" placeholder="${esc(f.placeholder ?? "")}" autocomplete="off">`;
  }
  const hint = f.hint ? `<small class="hint">${esc(f.hint)}</small>` : "";
  return `<label class="field"><span>${esc(f.label)}</span>${control}${hint}</label>`;
}

/** Built once per day, so typing in the form is never interrupted by the one-second refresh. */
function drawForm(p) {
  const fields = p.fields.map((f) => fieldHtml(f, p.defaults[f.id] ?? "")).join("");
  const shortcut = p.shortcut
    ? `<div class="shortcut"><button type="button" class="button" id="shortcut">${esc(p.shortcut.label)}</button><small class="hint">${esc(p.shortcut.hint)}</small><small class="hint" id="env-hint" hidden></small></div>`
    : "";
  $("send").innerHTML = `<h2>Send a card</h2>${fields}
    <div><button type="submit" class="button coral" id="send-btn">Send card</button><small class="hint" id="send-hint"></small></div>
    ${shortcut}`;
}

function drawSend(s) {
  const p = s.profile;
  const blocked = p.cloudOnly && !s.cloud.active; // a Cloud-only day, and the keys are not set
  const busy = s.sending || blocked;
  $("send-btn").disabled = busy;
  $("send-btn").textContent = s.sending ? "Sending..." : "Send card";
  const shortcut = $("shortcut");
  if (shortcut) shortcut.disabled = busy;

  const lines = [];
  if (blocked) lines.push(s.cloud.message);
  else if (p.tip) lines.push(p.tip);
  setHtml($("send-hint"), lines.map(esc).join("<br>"));

  // A running app cannot take a scenario's env, so say how to start the day for the rush button.
  const envHint = $("env-hint");
  if (envHint && p.shortcut) {
    const name =
      side === "problem" && p.hasContrast ? `${p.shortcut.scenario}-before` : p.shortcut.scenario;
    const env = Object.entries(s.scenarios.find((x) => x.name === name)?.env ?? {}).map(
      ([k, v]) => `${k}=${v}`,
    );
    envHint.hidden = env.length === 0;
    envHint.textContent = env.length
      ? `Start the day with: ${env.join(" ")} pnpm day ${s.day}`
      : "";
  }
}

// ---------- The live card ----------

/** With a rush of cards several steps run at once: only the last one gets the big, bold look. */
function lineHtml(line, i, feed) {
  const lastRunning = feed.findLastIndex((l) => l.status === "running");
  const quiet = line.status === "running" && i !== lastRunning ? " data-quiet" : "";
  return `<li data-status="${line.status}"${quiet}>${esc(line.text)}</li>`;
}

function drawLive(s) {
  const live = s.live;
  const idle = !live || live.state === "idle";

  $("stamp").hidden = !live?.stamp;
  $("stamp").textContent = live?.stamp ?? "";
  $("progress").hidden = idle || live.total < 2;
  $("progress").textContent = idle ? "" : `${live.finished} of ${live.total} finished`;

  $("feed").hidden = idle;
  setHtml($("feed"), idle ? "" : live.feed.map((l, i) => lineHtml(l, i, live.feed)).join(""));

  if (idle) {
    setHtml(
      $("card"),
      `<div class="empty"><div class="scene">${SCENE}</div><h3>Nothing to deliver yet</h3><p class="muted">Fill in the form and your card will show up here.</p></div>`,
    );
    return;
  }
  const action = live.action
    ? `<button type="button" class="button" id="action">${esc(live.action)}</button>`
    : "";
  const card = live.card
    ? `<article class="holiday-card"><div class="scene">${SCENE}</div>
        <h3 class="holiday-card-title">${esc(live.card.title)}</h3>
        <p class="holiday-card-message">${esc(live.card.message)}</p>
        ${live.card.to ? `<p class="holiday-card-from">To ${esc(live.card.to)}</p>` : ""}</article>`
    : "";
  setHtml($("card"), action + card);
}

// ---------- The queue strip (Days 06 and 10) ----------

// Chips are drawn in a lane's order: served first, then the waiting cards, next up on the left.
function chipHtml(c, label) {
  const pro = c.group === "pro";
  const hue = pro ? "pro" : c.group.length === 1 ? c.group : "free";
  return `<span class="chip" data-state="${c.state}" data-group="${esc(hue)}" title="${esc(label ?? c.id)}">${esc(c.id)}${pro ? '<b class="pill">Pro</b>' : ""}</span>`;
}

function drawQueue(s) {
  const q = s.live?.queue;
  $("queue").hidden = !q;
  if (!q) return;
  const lanes = q.lanes
    .map((lane) => {
      const slots = Array.from({ length: lane.slots }, (_, i) => {
        const c = lane.serving[i];
        return `<span class="slot">${c ? chipHtml(c, `${c.id}: being made`) : ""}</span>`;
      }).join("");
      const waiting =
        lane.waiting
          .map((c, i) => chipHtml(c, `${c.id}: queued #${i + 1} of ${lane.waiting.length}`))
          .join("") + lane.retrying.map((c) => chipHtml(c, `${c.id}: trying again`)).join("");
      return `<div class="lane"><span class="lane-name">${esc(lane.name)}</span><span class="slots">${slots}</span><span class="lane-count">${lane.waiting.length ? `${lane.waiting.length} waiting` : "No one waiting"}</span><span class="line">${waiting}</span></div>`;
    })
    .join("");
  const done = q.done.map((c, i) => chipHtml(c, `${c.id}: delivered #${i + 1}`)).join("");
  const notes = q.notes
    .map(
      (n) =>
        `<li data-group="${esc(n.group === "pro" ? "pro" : n.group)}"><b>${esc(n.id)}</b> ${esc(n.text)}</li>`,
    )
    .join("");
  setHtml(
    $("queue"),
    `${lanes}${done ? `<div class="lane"><span class="lane-name">Delivered</span><span class="line">${done}</span></div>` : ""}<ul class="queue-notes">${notes}</ul>`,
  );
}

// ---------- Under the hood ----------

const RUN_STATE = {
  done: "completed",
  running: "running",
  failed: "failed",
  cancelled: "cancelled",
  waiting: "waiting",
};

function drawTrace(s) {
  const t = s.trace;
  if (!t) {
    setHtml(
      $("trace"),
      `<section class="trace"><header class="trace-head"><span>no run yet</span></header><p class="trace-empty">Every step of your card shows up here, with the Inngest name for it.</p></section>`,
    );
    return;
  }
  const rows = t.rows
    .map(
      (r) =>
        `<li class="trace-row" data-status="${r.status}"><span class="trace-no">${esc(r.no)}</span><span class="trace-name">${esc(r.name)}<small class="trace-sub">${esc(r.sub)}</small></span><span class="trace-bar"><i style="--at:${r.at}%;--len:${r.len}%"></i></span><span class="trace-time">${esc(r.time)}</span></li>`,
    )
    .join("");
  setHtml(
    $("trace"),
    `<section class="trace" data-state="${esc(t.state)}"><header class="trace-head"><span>${esc(t.fn)}</span><span class="trace-state">${RUN_STATE[t.state] ?? t.state}</span></header>
      <ol class="trace-rows">${rows}</ol>
      <footer class="trace-foot"><span>run ${esc(t.runId.slice(0, 16))}</span><span>No. ${esc(t.no)}</span></footer></section>`,
  );
}

// ---------- The problem and the fix, side by side ----------

function sideHtml(name, which, snap) {
  const body = snap
    ? `<dl>${snap.figures.map((f) => `<div><dd>${esc(f.value)}</dd><dt>${esc(f.label)}</dt></div>`).join("")}</dl>`
    : `<p class="compare-empty">Run the ${which} to see it</p>`;
  const note = snap?.interrupted
    ? `<small class="compare-note" title="The other run started first.">Cut short</small>`
    : "";
  const active = which === side ? ' data-active="true"' : "";
  return `<section class="compare-side" data-side="${which}"${active}><div class="compare-name"><h3>${name}</h3>${note}</div>${body}</section>`;
}

function drawCompare(s) {
  const show = s.profile.hasContrast && presenter;
  $("compare").hidden = !show;
  // The slim product status bar and the presenter's strip share the bottom edge: one at a time.
  $("statusbar").hidden = presenter && s.profile.hasContrast;
  setHtml(
    $("statusbar"),
    (s.live?.status ?? ["Connected"]).map((t) => `<span>${esc(t)}</span>`).join(""),
  );
  if (!show) return;
  setHtml(
    $("compare"),
    sideHtml("The problem", "problem", s.compare.problem) +
      sideHtml("The fix", "fix", s.compare.fix),
  );
}

// ---------- Presenter drawer (?presenter=1, or press p) ----------

function drawDrawer(s) {
  $("drawer").hidden = !presenter;
  if (!presenter) return;
  if (!s.scenarios.some((x) => x.name === scenario)) scenario = s.scenarios[0]?.name ?? null;
  setHtml(
    $("scenarios"),
    s.scenarios
      .map(
        (x) =>
          `<button type="button" class="button ${x.name === scenario ? "" : "quiet"}" data-scenario="${esc(x.name)}">${esc(x.name)}</button>`,
      )
      .join(""),
  );
  // A running app cannot take a scenario's env, so say how to start the day instead.
  const picked = s.scenarios.find((x) => x.name === scenario);
  const env = Object.entries(picked?.env ?? {}).map(([k, v]) => `${k}=${v}`);
  const lines = [picked ? `${picked.description}.` : ""];
  if (env.length) lines.push(`Start the day with: ${env.join(" ")} pnpm day ${s.day}`);
  const noCloud = picked?.needsCloud && !s.cloud.active;
  if (noCloud)
    lines.push(
      `This one runs in Inngest Cloud. Set INNGEST_SIGNING_KEY and INNGEST_EVENT_KEY, start the day with pnpm day ${s.day} --cloud, then restart the studio.`,
    );
  setHtml($("scenario-note"), lines.map(esc).join("<br>"));
  $("run").disabled = s.sending || !picked || noCloud;
  $("run").textContent = s.sending ? "Sending..." : "Run scenario";
}

// ---------- The Dev Server slide-up (press d) ----------

const DEV_SERVER = "http://localhost:8288";
let shownRun = ""; // the run the frame was pointed at when it last loaded ("" = the runs list)

const currentRun = () => state?.trace?.runId ?? "";
const runsUrl = (id) => (id ? `${DEV_SERVER}/runs?runID=${id}` : `${DEV_SERVER}/runs`);

function showRun(id) {
  shownRun = id;
  $("dev-frame").src = runsUrl(id);
  $("dev-tab").href = runsUrl(id);
}

/** Loads the frame lazily, and only while the Dev Server answers. Never yanks a page away. */
function drawDevPanel(s) {
  const cloud = s.cloud.active;
  $("dev-open").textContent = cloud ? "Inngest Cloud" : "Dev Server";
  $("dev-title").textContent = cloud ? "Inngest Cloud" : "Inngest Dev Server";
  $("cloud-open").href = s.cloud.url;
  $("cloud-panel").hidden = !cloud;
  $("dev-tab").hidden = cloud;
  if ($("devpanel").hidden) return;
  if (cloud) {
    // Inngest Cloud refuses to be framed, so there is a button instead of the page.
    $("dev-down").hidden = true;
    $("dev-frame").hidden = true;
    $("dev-current").hidden = true;
    return;
  }
  $("dev-down").hidden = s.devServer;
  $("dev-frame").hidden = !s.devServer;
  if (s.devServer && !$("dev-frame").getAttribute("src")) showRun(currentRun());
  $("dev-current").hidden = !s.devServer || currentRun() === "" || currentRun() === shownRun;
}

function setDevPanel(open) {
  $("devpanel").hidden = !open;
  // Keep Tab and screen readers inside the panel while it covers the page.
  for (const el of [document.querySelector(".masthead"), document.querySelector(".dashboard-page")])
    el.inert = open;
  if (open && state) {
    drawDevPanel(state);
    $("dev-close").focus();
  } else $("dev-open").focus();
}

$("dev-open").addEventListener("click", () => setDevPanel(true));
$("dev-close").addEventListener("click", () => setDevPanel(false));
$("dev-current").addEventListener("click", () => {
  showRun(currentRun());
  $("dev-current").hidden = true;
});

// ---------- Buttons ----------

$("send").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = Object.fromEntries(new FormData($("send")));
  post("/api/send", { day: state.day, problem: side === "problem", form });
});
$("send").addEventListener("click", (e) => {
  if (e.target.id !== "shortcut" || !state) return;
  const p = state.profile;
  const name =
    side === "problem" && p.hasContrast ? `${p.shortcut.scenario}-before` : p.shortcut.scenario;
  post("/api/run", { day: state.day, scenario: name });
});
$("card").addEventListener("click", (e) => {
  if (e.target.id === "action") post("/api/action", { day: state.day });
});
$("switch").addEventListener("click", (e) => {
  const picked = e.target.closest("[data-side]");
  if (!picked || picked.disabled || !state) return;
  side = picked.dataset.side;
  drawMasthead(state);
  drawSend(state);
  drawCompare(state);
});
$("days").addEventListener("click", (e) => {
  const picked = e.target.closest("[data-day]")?.dataset.day;
  if (!picked) return;
  day = picked;
  scenario = null;
  refresh();
});
$("scenarios").addEventListener("click", (e) => {
  const picked = e.target.closest("[data-scenario]")?.dataset.scenario;
  if (!picked) return;
  scenario = picked;
  if (state) drawDrawer(state);
});
$("run").addEventListener("click", () => {
  post("/api/run", { day: state.day, scenario });
  $("run").disabled = true;
});
$("clear").addEventListener("click", () => post("/api/clear", { day: state.day }));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("devpanel").hidden) return setDevPanel(false);
  if (e.metaKey || e.ctrlKey || e.target.closest("input, textarea, select")) return;
  if (e.key === "d") setDevPanel($("devpanel").hidden);
  if (e.key === "p") {
    presenter = !presenter;
    if (state) {
      drawDrawer(state);
      drawCompare(state);
    }
  }
});

loop();
