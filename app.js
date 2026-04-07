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

const standingsBody = document.getElementById("standingsBody");
const podium = document.getElementById("podium");
const historyList = document.getElementById("historyList");
const searchInput = document.getElementById("searchInput");
const lastUpdated = document.getElementById("lastUpdated");
const leaderName = document.getElementById("leaderName");
const leaderPoints = document.getElementById("leaderPoints");
const leaderMonth = document.getElementById("leaderMonth");
const connectionBanner = document.getElementById("connectionBanner");

const supabaseSettings = window.TITAN_CUP_SUPABASE ?? null;
const supabase =
  supabaseSettings?.url && supabaseSettings?.anonKey
    ? createClient(supabaseSettings.url, supabaseSettings.anonKey)
    : null;

let latestHistory = [];

function formatMonth(monthValue) {
  if (!monthValue) return "No update yet";
  const value = monthValue.length === 7 ? `${monthValue}-01` : monthValue;
  const date = new Date(value);
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function monthToStorageFormat(monthValue) {
  return monthValue.slice(0, 7);
}

function loadLocalHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : defaultHistory;
    return Array.isArray(parsed) ? parsed : defaultHistory;
  } catch (error) {
    console.warn("Local public data could not be loaded.", error);
    return defaultHistory;
  }
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
  const query = searchInput.value.trim().toLowerCase();
  const filtered = query
    ? standings.filter((entry) => entry.name.toLowerCase().includes(query))
    : standings;

  standingsBody.innerHTML = filtered
    .map(
      (entry) => `
        <tr>
          <td>#${standings.indexOf(entry) + 1}</td>
          <td>${entry.name}</td>
          <td>${entry.points}</td>
          <td>${formatMonth(entry.lastMonth)} - #${entry.lastPlacement}</td>
        </tr>
      `
    )
    .join("");

  if (!filtered.length) {
    standingsBody.innerHTML = `
      <tr>
        <td colspan="4">No player or team matched your search.</td>
      </tr>
    `;
  }
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

  const latestEntry = history.slice().sort((a, b) => (a.month < b.month ? 1 : -1))[0];
  lastUpdated.textContent = latestEntry
    ? `Latest tournament recorded: ${formatMonth(latestEntry.month)}`
    : "No tournaments recorded yet";
}

function renderAll(history) {
  latestHistory = history;
  const standings = deriveStandings(history);
  renderPodium(standings);
  renderStandings(standings);
  renderHistory(history);
  renderMeta(standings, history);
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
    connectionBanner.textContent = "Demo mode is active. Public rankings are showing sample data.";
    connectionBanner.className = "status-banner warning";
    return;
  }

  try {
    const history = await fetchRemoteHistory();
    renderAll(history);
    connectionBanner.textContent = "Live rankings are connected. Search your player or team name below.";
    connectionBanner.className = "status-banner connected";
  } catch (error) {
    console.error(error);
    renderAll(loadLocalHistory());
    connectionBanner.textContent = "Live rankings could not be loaded, so sample data is being shown.";
    connectionBanner.className = "status-banner error";
  }
}

searchInput.addEventListener("input", () => {
  renderAll(latestHistory);
});

await loadAndRender();
