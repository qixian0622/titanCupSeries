import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const STORAGE_KEY = "titan-cup-series-data";
const SUPABASE_TABLE = "tournament_results";
const DEFAULT_REDIRECT = `${window.location.origin}${window.location.pathname}`;

const defaultHistory = [
  { month: "2026-03", name: "Titan Alpha", placement: 1, points: 50 },
  { month: "2026-03", name: "Nova Strikers", placement: 2, points: 35 },
  { month: "2026-03", name: "Iron Pulse", placement: 3, points: 25 },
  { month: "2026-03", name: "Storm Rift", placement: 4, points: 18 },
  { month: "2026-03", name: "Vortex Unit", placement: 5, points: 12 }
];

const standingsBody = document.getElementById("standingsBody");
const podium = document.getElementById("podium");
const historyList = document.getElementById("historyList");
const rankingForm = document.getElementById("rankingForm");
const authForm = document.getElementById("authForm");
const signOutButton = document.getElementById("signOutButton");
const lastUpdated = document.getElementById("lastUpdated");
const leaderName = document.getElementById("leaderName");
const leaderPoints = document.getElementById("leaderPoints");
const leaderMonth = document.getElementById("leaderMonth");
const authStatus = document.getElementById("authStatus");
const connectionBanner = document.getElementById("connectionBanner");
const formHint = document.getElementById("formHint");
const exportButton = document.getElementById("exportButton");
const importInput = document.getElementById("importInput");
const csvImportInput = document.getElementById("csvImportInput");
const downloadCsvTemplateButton = document.getElementById("downloadCsvTemplateButton");
const resetButton = document.getElementById("resetButton");

const supabaseSettings = window.TITAN_CUP_SUPABASE ?? null;
const supabase =
  supabaseSettings?.url && supabaseSettings?.anonKey
    ? createClient(supabaseSettings.url, supabaseSettings.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      })
    : null;

let currentUser = null;
let currentMode = supabase ? "supabase" : "demo";

function formatMonth(monthValue) {
  if (!monthValue) return "No update yet";
  const value = monthValue.length === 7 ? `${monthValue}-01` : monthValue;
  const date = new Date(value);
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function monthToStorageFormat(monthValue) {
  return monthValue.slice(0, 7);
}

function monthToDatabaseFormat(monthValue) {
  return `${monthToStorageFormat(monthValue)}-01`;
}

function loadLocalHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : defaultHistory;
    return Array.isArray(parsed) ? parsed : defaultHistory;
  } catch (error) {
    console.warn("Local demo data could not be loaded.", error);
    return defaultHistory;
  }
}

function persistLocalHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function deriveStandings(history) {
  const map = new Map();

  history.forEach((item) => {
    const existing = map.get(item.name.toLowerCase());
    if (existing) {
      existing.points += item.points;

      if (item.month >= existing.lastMonth) {
        existing.lastMonth = item.month;
        existing.lastPlacement = item.placement;
        existing.name = item.name;
      }
      return;
    }

    map.set(item.name.toLowerCase(), {
      name: item.name,
      points: item.points,
      lastPlacement: item.placement,
      lastMonth: item.month
    });
  });

  return [...map.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.name.localeCompare(b.name);
  });
}

function renderPodium(standings) {
  const topThree = standings.slice(0, 3);
  const labels = ["1st Place", "2nd Place", "3rd Place"];
  const classes = ["first", "second", "third"];

  podium.innerHTML = topThree
    .map(
      (entry, index) => `
        <article class="podium-card ${classes[index]}">
          <span class="podium-rank">${labels[index]}</span>
          <div>
            <h3 class="podium-name">${entry.name}</h3>
            <p class="podium-points">${entry.points} pts</p>
          </div>
          <p class="hero-card-meta">Last result: #${entry.lastPlacement} in ${formatMonth(entry.lastMonth)}</p>
        </article>
      `
    )
    .join("");
}

function renderStandings(standings) {
  standingsBody.innerHTML = standings
    .map(
      (entry, index) => `
        <tr>
          <td>#${index + 1}</td>
          <td>${entry.name}</td>
          <td>${entry.points}</td>
          <td>${formatMonth(entry.lastMonth)} - #${entry.lastPlacement}</td>
        </tr>
      `
    )
    .join("");
}

function renderHistory(history) {
  const template = document.getElementById("historyItemTemplate");
  historyList.innerHTML = "";

  history
    .slice()
    .sort((a, b) => {
      if (a.month !== b.month) return a.month < b.month ? 1 : -1;
      if (a.placement !== b.placement) return a.placement - b.placement;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 8)
    .forEach((item) => {
      const node = template.content.cloneNode(true);
      node.querySelector(".history-month").textContent = formatMonth(item.month);
      node.querySelector(".history-name").textContent = item.name;
      node.querySelector(".history-placement").textContent = `Placement #${item.placement}`;
      node.querySelector(".history-points").textContent = `+${item.points} pts`;
      historyList.appendChild(node);
    });
}

function renderMeta(standings, history) {
  const leader = standings[0];
  leaderName.textContent = leader?.name ?? "No standings yet";
  leaderPoints.textContent = leader ? `${leader.points} pts` : "0 pts";
  leaderMonth.textContent = leader
    ? `Latest update: ${formatMonth(leader.lastMonth)}`
    : "Latest update: none";

  const latestHistory = history
    .slice()
    .sort((a, b) => (a.month < b.month ? 1 : -1))[0];

  lastUpdated.textContent = latestHistory
    ? `Latest tournament recorded: ${formatMonth(latestHistory.month)}`
    : "No tournaments recorded yet";
}

function renderAll(history) {
  const standings = deriveStandings(history);
  renderPodium(standings);
  renderStandings(standings);
  renderHistory(history);
  renderMeta(standings, history);
}

function updateBanner(message, tone = "warning") {
  connectionBanner.textContent = message;
  connectionBanner.className = `status-banner ${tone}`;
}

function updateAuthUi() {
  const canEdit = currentMode === "demo" || Boolean(currentUser);
  rankingForm.querySelector("button[type='submit']").disabled = !canEdit;

  if (currentMode === "demo") {
    authStatus.textContent =
      "Demo mode is active. Anyone on this device can test updates, but they are not shared publicly.";
    formHint.textContent =
      "Connect Supabase to make monthly ranking changes visible to everyone on the public website.";
    return;
  }

  if (currentUser?.email) {
    authStatus.textContent = `Signed in as ${currentUser.email}. Shared updates are now enabled.`;
    formHint.textContent =
      "Saving a result updates the shared Supabase database so everyone sees the latest rankings.";
    return;
  }

  authStatus.textContent =
    "Sign in with an approved organizer email to update shared rankings. Viewers can still see the public table.";
  formHint.textContent =
    "Without sign-in, the form stays locked to protect your public rankings from unauthorized edits.";
}

function getFormResult() {
  const formData = new FormData(rankingForm);
  const result = {
    month: String(formData.get("month") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    placement: Number(formData.get("placement") ?? ""),
    points: Number(formData.get("points") ?? "")
  };

  if (!result.month || !result.name || Number.isNaN(result.placement) || Number.isNaN(result.points)) {
    return null;
  }

  return result;
}

function normalizeImportedResult(item) {
  const normalized = {
    month: String(item.month ?? "").trim(),
    name: String(item.name ?? "").trim(),
    placement: Number(item.placement),
    points: Number(item.points)
  };

  if (
    !normalized.month ||
    !normalized.name ||
    Number.isNaN(normalized.placement) ||
    Number.isNaN(normalized.points)
  ) {
    throw new Error("Each row must include month, name, placement, and points.");
  }

  return normalized;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === "\"") {
      if (inQuotes && nextChar === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsvResults(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV file must include a header row and at least one result row.");
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const expectedHeaders = ["month", "name", "placement", "points"];

  if (expectedHeaders.some((header, index) => headers[index] !== header)) {
    throw new Error("CSV header must be: month,name,placement,points");
  }

  return lines.slice(1).map((line) => {
    const [month, name, placement, points] = parseCsvLine(line);
    return normalizeImportedResult({ month, name, placement, points });
  });
}

async function upsertResults(results) {
  if (!supabase) {
    const history = loadLocalHistory();

    results.forEach((result) => {
      const existingIndex = history.findIndex(
        (item) => item.month === result.month && item.name.toLowerCase() === result.name.toLowerCase()
      );

      if (existingIndex >= 0) {
        history[existingIndex] = result;
      } else {
        history.unshift(result);
      }
    });

    persistLocalHistory(history);
    renderAll(history);
    updateAuthUi();
    return;
  }

  const rows = results.map((result) => ({
    month: monthToDatabaseFormat(result.month),
    participant_name: result.name,
    placement: result.placement,
    points: result.points
  }));

  const { error } = await supabase.from(SUPABASE_TABLE).upsert(rows, {
    onConflict: "month,participant_name"
  });

  if (error) throw error;
  await loadAndRender();
}

async function fetchRemoteHistory() {
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select("month, participant_name, placement, points")
    .order("month", { ascending: false })
    .order("placement", { ascending: true });

  if (error) throw error;

  return data.map((row) => ({
    month: monthToStorageFormat(row.month),
    name: row.participant_name,
    placement: row.placement,
    points: row.points
  }));
}

async function loadAndRender() {
  if (!supabase) {
    renderAll(loadLocalHistory());
    updateBanner("Demo mode is active. Connect Supabase to make rankings public and shared.", "warning");
    updateAuthUi();
    return;
  }

  try {
    const history = await fetchRemoteHistory();
    renderAll(history);
    updateBanner("Live Supabase connection is active. Rankings are public and shared.", "connected");
  } catch (error) {
    console.error(error);
    renderAll(loadLocalHistory());
    updateBanner("Supabase could not be reached, so the site fell back to demo data.", "error");
  }

  updateAuthUi();
}

async function refreshSession() {
  if (!supabase) {
    currentUser = null;
    return;
  }

  const {
    data: { session }
  } = await supabase.auth.getSession();

  currentUser = session?.user ?? null;
}

async function saveResult(result) {
  await upsertResults([result]);
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabase) {
    updateBanner("Add your Supabase keys first. Use supabase-config.example.js as the template.", "warning");
    return;
  }

  const email = String(new FormData(authForm).get("email") ?? "").trim();
  if (!email) return;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: supabaseSettings.redirectTo || DEFAULT_REDIRECT
    }
  });

  if (error) {
    updateBanner(`Sign-in failed: ${error.message}`, "error");
    return;
  }

  updateBanner("Magic link sent. Open the email on your phone or browser to sign in.", "connected");
});

signOutButton.addEventListener("click", async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
  currentUser = null;
  updateAuthUi();
});

rankingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const result = getFormResult();

  if (!result) return;
  if (supabase && !currentUser) {
    updateBanner("Organizer sign-in is required before you can update the public rankings.", "warning");
    return;
  }

  try {
    await saveResult(result);
    rankingForm.reset();
    updateBanner("Tournament result saved successfully.", "connected");
  } catch (error) {
    console.error(error);
    updateBanner(`Unable to save result: ${error.message}`, "error");
  }
});

exportButton.addEventListener("click", async () => {
  try {
    const history = supabase ? await fetchRemoteHistory() : loadLocalHistory();
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "titan-cup-series-results.json";
    anchor.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error(error);
    updateBanner(`Export failed: ${error.message}`, "error");
  }
});

importInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error("The import file must be an array of tournament results.");
    }

    const normalizedResults = parsed.map(normalizeImportedResult);

    if (supabase && !currentUser) {
      throw new Error("Sign in before importing shared rankings.");
    }

    await upsertResults(normalizedResults);

    updateBanner("Ranking data imported successfully.", "connected");
  } catch (error) {
    console.error(error);
    updateBanner(`Import failed: ${error.message}`, "error");
  } finally {
    importInput.value = "";
  }
});

csvImportInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    if (supabase && !currentUser) {
      throw new Error("Sign in before importing shared rankings.");
    }

    const text = await file.text();
    const results = parseCsvResults(text);
    await upsertResults(results);
    updateBanner(`Imported ${results.length} CSV row(s) successfully.`, "connected");
  } catch (error) {
    console.error(error);
    updateBanner(`CSV import failed: ${error.message}`, "error");
  } finally {
    csvImportInput.value = "";
  }
});

downloadCsvTemplateButton.addEventListener("click", () => {
  const csvTemplate = [
    "month,name,placement,points",
    "2026-03,Titan Alpha,1,50",
    "2026-03,Nova Strikers,2,35",
    "2026-03,Iron Pulse,3,25"
  ].join("\n");

  const blob = new Blob([csvTemplate], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "titan-cup-series-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
});

resetButton.addEventListener("click", async () => {
  if (supabase) {
    updateBanner("Demo reset is disabled in live mode to protect the shared rankings.", "warning");
    return;
  }

  persistLocalHistory(defaultHistory);
  renderAll(defaultHistory);
  updateBanner("Demo data restored.", "connected");
});

if (supabase) {
  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user ?? null;
    updateAuthUi();
    await loadAndRender();
  });
}

await refreshSession();
await loadAndRender();
updateAuthUi();
