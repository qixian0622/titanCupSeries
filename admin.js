import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const STORAGE_KEY = "titan-cup-series-data";
const SUPABASE_TABLE = "tournament_results";

const defaultHistory = [
  { month: "2026-03", name: "Titan Alpha", placement: 1, points: 50 },
  { month: "2026-03", name: "Nova Strikers", placement: 2, points: 35 },
  { month: "2026-03", name: "Iron Pulse", placement: 3, points: 25 },
  { month: "2026-03", name: "Storm Rift", placement: 4, points: 18 },
  { month: "2026-03", name: "Vortex Unit", placement: 5, points: 12 }
];

const rankingForm = document.getElementById("rankingForm");
const authForm = document.getElementById("authForm");
const signOutButton = document.getElementById("signOutButton");
const lastUpdated = document.getElementById("lastUpdated");
const authStatus = document.getElementById("authStatus");
const connectionBanner = document.getElementById("connectionBanner");
const formHint = document.getElementById("formHint");
const liveUrlValue = document.getElementById("liveUrlValue");
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

function isLocalhostHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function getLiveRedirectUrl() {
  const currentUrl = `${window.location.origin}${window.location.pathname}`;
  const configuredUrl = String(supabaseSettings?.redirectTo ?? "").trim();

  if (!isLocalhostHost(window.location.hostname)) {
    return currentUrl;
  }

  if (configuredUrl) {
    return configuredUrl.endsWith("/admin.html") ? configuredUrl : `${configuredUrl.replace(/\/$/, "")}/admin.html`;
  }

  return currentUrl;
}

function monthToStorageFormat(monthValue) {
  return monthValue.slice(0, 7);
}

function monthToDatabaseFormat(monthValue) {
  return `${monthToStorageFormat(monthValue)}-01`;
}

function persistLocalHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function loadLocalHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : defaultHistory;
    return Array.isArray(parsed) ? parsed : defaultHistory;
  } catch (error) {
    console.warn("Local admin data could not be loaded.", error);
    return defaultHistory;
  }
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

function updateBanner(message, tone = "warning") {
  connectionBanner.textContent = message;
  connectionBanner.className = `status-banner ${tone}`;
}

function updateAuthUi() {
  const canEdit = currentMode === "demo" || Boolean(currentUser);
  rankingForm.querySelector("button[type='submit']").disabled = !canEdit;
  liveUrlValue.textContent = getLiveRedirectUrl();

  if (currentMode === "demo") {
    authStatus.textContent = "Demo mode is active. Sign-in is not required, but data is not shared publicly.";
    formHint.textContent = "Demo mode lets you test the admin page before the live database is ready.";
    return;
  }

  if (currentUser?.email) {
    authStatus.textContent = `Signed in as ${currentUser.email}. You can now save and import results.`;
    formHint.textContent = "Saving or importing results updates the public leaderboard automatically.";
    return;
  }

  authStatus.textContent = "Sign in with an approved organizer email to unlock the admin tools.";
  formHint.textContent = "Until you sign in, save and import actions remain locked.";
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
    lastUpdated.textContent = "Demo mode active";
    updateBanner("Demo mode is active. Connect Supabase to enable shared live updates.", "warning");
    updateAuthUi();
    return;
  }

  try {
    const history = await fetchRemoteHistory();
    const latestEntry = history[0];
    lastUpdated.textContent = latestEntry
      ? `Latest tournament recorded: ${latestEntry.month}`
      : "No tournaments recorded yet";
    updateBanner("Live Supabase connection is active. Admin tools are ready.", "connected");
  } catch (error) {
    console.error(error);
    updateBanner("Supabase could not be reached. Check auth and database settings.", "error");
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
      emailRedirectTo: getLiveRedirectUrl()
    }
  });

  if (error) {
    updateBanner(`Sign-in failed: ${error.message}`, "error");
    return;
  }

  updateBanner(`Magic link sent. It should return to ${getLiveRedirectUrl()}.`, "connected");
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
    updateBanner("Organizer sign-in is required before you can save public rankings.", "warning");
    return;
  }

  try {
    await upsertResults([result]);
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

    if (supabase && !currentUser) {
      throw new Error("Sign in before importing shared rankings.");
    }

    await upsertResults(parsed.map(normalizeImportedResult));
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
    updateBanner("Demo reset is disabled in live mode to protect shared rankings.", "warning");
    return;
  }

  persistLocalHistory(defaultHistory);
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
