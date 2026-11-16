// ==================================================
// GLOBAL CONFIGURATION
// ==================================================

const CATEGORY_ORDER = [
  "Kids",
  "U14",
  "U16",
  "U18",
  "18+"
];


const LOCAL_PLAYERS_KEY =
  "bballtools_3x3_local_players_v2";


const EVENING_SESSION_KEY =
  "bballtools_3x3_evening_session_v1";



// ==================================================
// GLOBAL STATE
// ==================================================

let masterPlayers = [];
let scheduleText = "";
let championshipPreview = null;
let restoredCategoryCourtMaximum = null;
let additionalCategoryRules = [];
let skillOverrides = {};
const SKILL_OVERRIDES_KEY = "bballtools_3x3_skill_overrides_v2";
try { skillOverrides = JSON.parse(localStorage.getItem(SKILL_OVERRIDES_KEY) || "{}"); } catch { /* Start with roster ratings. */ }
if (!skillOverrides || typeof skillOverrides !== "object" || Array.isArray(skillOverrides)) skillOverrides = {};

// Convert saved 1–5 ratings once. Player IDs and historical counts stay intact.
function migrateLegacySkills(value) {
  if (!value || typeof value !== "object") return;
  if (Number.isInteger(value.skill) && value.skill >= 1 && value.skill <= 5) value.skill *= 2;
  Object.values(value).forEach(child => {
    if (child && typeof child === "object") migrateLegacySkills(child);
  });
}

function showPanel(name) {
  const names = ["players", "setup", "teams", "schedule"];
  if (!names.includes(name)) return;
  names.forEach(item => {
    const tab = document.getElementById(`tab-${item}`);
    document.getElementById(`${item}Panel`).hidden = item !== name;
    tab.setAttribute("aria-selected", String(item === name));
    tab.tabIndex = item === name ? 0 : -1;
  });
  document.getElementById(`${name}Panel`).scrollIntoView({ block: "start", behavior: "instant" });
}
["players", "setup", "teams", "schedule"].forEach((name, index, names) => {
  const tab = document.getElementById(`tab-${name}`);
  tab.addEventListener("click", () => showPanel(name));
  tab.addEventListener("keydown", event => {
    let next;
    if (event.key === "ArrowRight") next = names[(index + 1) % names.length];
    if (event.key === "ArrowLeft") next = names[(index + names.length - 1) % names.length];
    if (event.key === "Home") next = names[0];
    if (event.key === "End") next = names[names.length - 1];
    if (!next) return;
    event.preventDefault();
    showPanel(next);
    document.getElementById(`tab-${next}`).focus();
  });
});
document.getElementById("scheduleNotes").addEventListener("input", event => {
  scheduleText = event.target.value.slice(0, 20000);
  saveEveningSession();
  updateNewSessionButtonState();
});
document.getElementById("appendSchedule").addEventListener("click", () => {
  if (!currentResult) return;
  const lines = currentResult.courtGames.map(game =>
    `Court ${game.court} · ${game.team1.name} vs ${game.team2.name} · ${game.teamSize}v${game.teamSize}`);
  scheduleText = [scheduleText, `Formation ${currentRoundNumber}${currentRoundApproved ? "" : " (draft)"}`, ...lines].filter(Boolean).join("\n").slice(0, 20000);
  document.getElementById("scheduleNotes").value = scheduleText;
  saveEveningSession();
  updateNewSessionButtonState();
});

let localPlayers = [];

let players = [];

// Temporary guests belong to this evening, never to the permanent roster.
let sessionDunkers = [];
let dunkerCounter = 0;
let kidsCourtSelection = null;
let kidsDialogRequest = null;
const kidsCourtDialog = document.getElementById("kidsCourtDialog");


let courts = 2;

const adultOnlyMode =
  document.getElementById("adultOnlyMode");
const matchupCategory1 = document.getElementById("matchupCategory1");
const matchupCategory2 = document.getElementById("matchupCategory2");

const adultCourtMaximum =
  document.getElementById("adultCourtMaximum");

const adultCourtSetting =
  document.getElementById("adultCourtSetting");

const adultOnlyStatus =
  document.getElementById("adultOnlyStatus");

const kidsOnlyMode = document.getElementById("kidsOnlyMode");
const kidsOnlyStatus = document.getElementById("kidsOnlyStatus");
const playerSearch = document.getElementById("playerSearch");
const clearPlayerSearch = document.getElementById("clearPlayerSearch");

let activeCategory =
  "All";


let presentPlayerIds =
  new Set();


let quickAddSkill = 6;


let currentResult = null;

let selectedSwapPlayer = null;

let lastSwapMessage = "";


let approvedFormations = [];


let currentRoundNumber = 1;

let suggestionNumber = 0;

let currentRoundApproved = false;

let selectedMoveTeamId = null;
const teamMoveStatus = document.getElementById("teamMoveStatus");
const cancelTeamMove = document.getElementById("cancelTeamMove");

let seenSuggestionSignatures =
  new Set();

let alternativesExhausted =
  false;

let currentRepeatNotice =
  false;



// ==================================================
// ELEMENTS
// ==================================================

const playerList =
  document.getElementById(
    "playerList"
  );


const playerSummary =
  document.getElementById(
    "playerSummary"
  );


const courtCount =
  document.getElementById(
    "courtCount"
  );


const resultsSection =
  document.getElementById(
    "resultsSection"
  );


const categoryTabs =
  document.getElementById(
    "categoryTabs"
  );


const addPlayerButton =
  document.getElementById(
    "addPlayerButton"
  );


const quickAddForm =
  document.getElementById(
    "quickAddForm"
  );


const quickAddTitle =
  document.getElementById(
    "quickAddTitle"
  );


const quickAddDescription =
  document.getElementById(
    "quickAddDescription"
  );


const quickAddCategoryRow =
  document.getElementById(
    "quickAddCategoryRow"
  );


const newPlayerName =
  document.getElementById(
    "newPlayerName"
  );


const newPlayerCategory =
  document.getElementById(
    "newPlayerCategory"
  );


const newcomerTools =
  document.getElementById(
    "newcomerTools"
  );


const newcomerCount =
  document.getElementById(
    "newcomerCount"
  );


const copyNewcomersButton =
  document.getElementById(
    "copyNewcomers"
  );


const swapStatus =
  document.getElementById(
    "swapStatus"
  );


const clearSwapButton =
  document.getElementById(
    "clearSwapButton"
  );


const alternativeButton =
  document.getElementById(
    "alternativeButton"
  );


const approveFormationButton =
  document.getElementById(
    "approveFormationButton"
  );


const remixButton =
  document.getElementById(
    "remixButton"
  );


const roundActionHelp =
  document.getElementById(
    "roundActionHelp"
  );


const eveningHistoryStatus =
  document.getElementById(
    "eveningHistoryStatus"
  );


const startNewSessionButton =
  document.getElementById(
    "startNewSessionButton"
  );


const manualAdjustmentCard =
  document.getElementById(
    "manualAdjustmentCard"
  );



// ==================================================
// HTML SAFETY
// ==================================================

function escapeHtml(value) {

  return String(value)
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      "\"",
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}



// ==================================================
// PLAYER NAME NORMALIZATION
// ==================================================

function cleanPlayerNameSpacing(
  value
) {

  return String(value)
    .trim()
    .replace(
      /\s+/g,
      " "
    );

}



function capitalizePlayerName(
  value
) {

  const cleaned =
    cleanPlayerNameSpacing(
      value
    );


  if (
    !cleaned
  ) {

    return "";

  }


  const lowercase =
    cleaned.toLocaleLowerCase();


  /*
    Capitalize letters at the beginning of:
    - the complete name
    - a new word
    - a hyphenated name
    - an apostrophe name
    - a name in brackets

    Examples:
    john smith      -> John Smith
    anna-maria      -> Anna-Maria
    o'connor        -> O'Connor
    alex (new)      -> Alex (New)
  */

  return lowercase.replace(
    /(^|[\s\-'"(])([a-zà-öø-ÿ])/g,
    (
      match,
      prefix,
      letter
    ) =>
      prefix +
      letter.toLocaleUpperCase()
  );

}



function normalizeName(
  name
) {

  return cleanPlayerNameSpacing(
    name
  )
    .toLocaleLowerCase();

}



/*
  Duplicate names intentionally ignore category.

  Alex in U14 and Alex in U18 are still two people
  with the same display name, so the second player
  needs a distinguishing name.
*/

function findPlayerWithSameName(
  name
) {

  const normalized =
    normalizeName(
      name
    );


  return (
    players.find(
      player =>
        normalizeName(
          player.name
        ) ===
        normalized
    ) || null
  );

}



/*
  If the entered name already exists, ask the leader
  for a distinguishing name immediately.

  The dialog repeats until:
  - a unique name is entered, or
  - the leader cancels.
*/

function requestUniquePlayerName(
  initialName
) {

  let candidate =
    capitalizePlayerName(
      initialName
    );


  while (
    candidate
  ) {

    const duplicate =
      findPlayerWithSameName(
        candidate
      );


    if (
      !duplicate
    ) {

      return candidate;

    }


    const differentiatedName =
      window.prompt(
        `A player named "${duplicate.name}" already exists in the roster (${duplicate.category}).\n\n` +
        "If this is another player, please give them a distinguishing name.\n\n" +
        "For example:\n" +
        `• ${duplicate.name} M.\n` +
        `• ${duplicate.name} J.\n` +
        `• ${duplicate.name} (New)\n\n` +
        "Enter the name to use:",
        ""
      );


    if (
      differentiatedName ===
      null
    ) {

      return null;

    }


    candidate =
      capitalizePlayerName(
        differentiatedName
      );


    if (
      !candidate
    ) {

      alert(
        "Please enter a name."
      );

    }

  }


  return null;

}



// ==================================================
// SKILL DISPLAY
// ==================================================

function skillBasketballs(skill) {
  if (!Number.isInteger(skill)) return '<span class="skill-unknown">Skill unknown</span>';
  return `<span class="skill-rating numbered-ball" role="img" aria-label="Skill ${skill} out of 10" title="Skill ${skill} out of 10"><span aria-hidden="true">${skill}</span></span>`;
}



// ==================================================
// LOCAL DATE
// ==================================================

function getTodayKey() {

  const now =
    new Date();


  const year =
    now.getFullYear();


  const month =
    String(
      now.getMonth() + 1
    )
      .padStart(
        2,
        "0"
      );


  const day =
    String(
      now.getDate()
    )
      .padStart(
        2,
        "0"
      );


  return (
    `${year}-${month}-${day}`
  );

}



// ==================================================
// NEW SESSION BUTTON STATE
// ==================================================

function updateNewSessionButtonState() {

  if (
    !startNewSessionButton
  ) {

    return;

  }


  const hasSessionState =
    approvedFormations.length > 0 ||
    presentPlayerIds.size > 0 || scheduleText.length > 0 ||
    currentResult !== null;


  startNewSessionButton.disabled =
    !hasSessionState;

}



// ==================================================
// EVENING SESSION HISTORY
// ==================================================

function loadEveningSession() {

  sessionDunkers = [];
  dunkerCounter = 0;
  kidsCourtSelection = null;

  approvedFormations = [];


  try {

    const raw =
      localStorage.getItem(
        EVENING_SESSION_KEY
      );


    if (
      !raw
    ) {

      currentRoundNumber =
        1;


      renderEveningHistoryStatus();


      return;

    }


    const stored = JSON.parse(raw);
    if (stored && stored.skillScale !== 10) migrateLegacySkills(stored);


    if (
      !stored ||
      stored.date !==
        getTodayKey()
    ) {

      localStorage.removeItem(
        EVENING_SESSION_KEY
      );


      currentRoundNumber =
        1;


      renderEveningHistoryStatus();


      return;

    }


    if (
      Array.isArray(
        stored.approvedFormations
      )
    ) {

      approvedFormations =
        stored.approvedFormations
          .filter(
            formation =>
              formation &&
              formation.signature &&
              Array.isArray(
                formation.teams
              )
          );

    }


    scheduleText = typeof stored.scheduleText === "string" ? stored.scheduleText.slice(0, 20000) : "";
    document.getElementById("scheduleNotes").value = scheduleText;
    if (Array.isArray(stored.presentPlayerIds)) presentPlayerIds = new Set(stored.presentPlayerIds.filter(id => typeof id === "string"));
    currentRoundNumber = approvedFormations.length + 1;

    sessionDunkers = (Array.isArray(stored.sessionDunkers) ? stored.sessionDunkers : []).filter(player =>
      player?.isPlaceholder === true && player.source === "session" && player.category === "Kids" &&
      (player.skill === null || Number.isInteger(player.skill) && player.skill >= 1 && player.skill <= 10));
    dunkerCounter = Math.max(Number.isSafeInteger(stored.dunkerCounter) ? stored.dunkerCounter : 0,
      ...sessionDunkers.map(player => Number(player.name.match(/^Dunker (\d+)$/)?.[1]) || 0));
    kidsCourtSelection = stored.kidsCourtSelection || null;

    if (stored.activeFormation && Array.isArray(stored.activeFormation.result?.teams) &&
        approvedFormations.some(formation => formation.round === stored.activeFormation.round)) {
      const active = stored.activeFormation;
      currentResult = active.result;
      const byId = new Map(currentResult.teams.map(team => [team.id, team]));
      currentResult.courtGames.forEach(game => {
        game.team1 = byId.get(game.team1.id);
        game.team2 = byId.get(game.team2.id);
        if (!game.team1 || !game.team2) throw new Error("Invalid saved court assignment");
      });
      currentResult.waitingTeams = currentResult.waitingTeams.map(team => byId.get(team.id));
      currentRoundNumber = active.round;
      suggestionNumber = Number.isSafeInteger(active.suggestionNumber) && active.suggestionNumber > 0 ? active.suggestionNumber : 1;
      currentRoundApproved = true;
      currentResult.championshipMode = true;
      if (!Array.isArray(stored.presentPlayerIds)) presentPlayerIds = new Set(currentResult.teams.flatMap(team => team.players)
        .concat(currentResult.rotationPlayers).map(player => player.id));
      currentResult.teams.forEach(recalculateTeam);
      courts = active.settings.availableBaskets;
      courtCount.textContent = courts;
      document.getElementById("gameFormat").value = active.settings.requestedFormat;
      kidsOnlyMode.checked = active.settings.kidsOnly;
      const rules = active.settings.categoryMatchups;
      const rule = rules?.[0] || active.settings.categoryMatchup;
      additionalCategoryRules = Array.isArray(rules) ? rules.slice(1) : [];
      adultOnlyMode.value = rule || active.settings.adultOnly ? "category" : "mixed";
      matchupCategory1.value = rule?.category1 || "18+";
      matchupCategory2.value = rule?.category2 || "18+";
      restoredCategoryCourtMaximum = rule?.maxCourts || active.settings.maxAdultCourts || 1;
      adultCourtMaximum.value = String(restoredCategoryCourtMaximum);
    }


    renderEveningHistoryStatus();

  }

  catch (error) {

    console.error(
      "Could not load evening history.",
      error
    );


    approvedFormations = [];

    currentResult = null;
    currentRoundApproved = false;
    sessionDunkers = [];
    kidsCourtSelection = null;

    currentRoundNumber =
      1;


    renderEveningHistoryStatus();

  }

}



function saveEveningSession() {

  const data = {

    date:
      getTodayKey(),

    skillScale: 10,
    scheduleText,
    presentPlayerIds: [...presentPlayerIds],
    approvedFormations,
    sessionDunkers,
    dunkerCounter,
    kidsCourtSelection,
    activeFormation: currentResult && currentRoundApproved ? {
      round: currentRoundNumber,
      suggestionNumber,
      result: currentResult,
      settings: { availableBaskets: courts, requestedFormat: document.getElementById("gameFormat").value, ...adultOnlyOptions() }
    } : null

  };


  localStorage.setItem(

    EVENING_SESSION_KEY,

    JSON.stringify(
      data
    )

  );


  renderEveningHistoryStatus();
  renderAutomaticSchedule();

}



function latestCompletion() {
  for (let i = approvedFormations.length - 1; i >= 0; i--) {
    const formation = approvedFormations[i];
    const completions = formation.completions || [];
    for (let j = completions.length - 1; j >= 0; j--) {
      if (!completions[j].undone) return { formation, completion: completions[j] };
    }
  }
  return null;
}

function updateCompletionControls() {
  const approved = Boolean(currentResult && currentRoundApproved && currentResult.courtGames.length);
  const pending = pendingGameCompletion();
  const missing = approved ? currentResult.courtGames.filter(game => ![game.team1.id, game.team2.id].includes(game.winnerTeamId)).length : 0;
  document.getElementById("completeAllGames").disabled = !approved || Boolean(pending) || missing > 0;
  document.getElementById("undoLastCompletion").disabled = !latestCompletion();
  document.getElementById("nextGameControls").hidden = !pending;
  updateChampionshipPairingHelp();
  const completed = (currentStoredFormation()?.completions || []).filter(completion => !completion.undone).length;
  document.getElementById("gameCompletionStatus").textContent = approved
    ? pending ? `${completed} shared ${completed === 1 ? "game" : "games"} completed with this formation. Choose the next games below, or reset & remix.`
      : missing ? `Select a winner on ${missing} ${missing === 1 ? "court" : "courts"}, then confirm Game completed — all courts.`
      : `${completed} shared ${completed === 1 ? "game" : "games"} completed with this formation. Ready to record the winners and count all teams on court, including substitutes.`
    : "Approve the formation to record completed games for all courts.";
}

function completeAllGames(confirmed = false) {
  const formation = currentStoredFormation();
  if (!formation || !currentResult.courtGames.length || pendingGameCompletion()) return;
  if (currentResult.courtGames.some(game => ![game.team1.id, game.team2.id].includes(game.winnerTeamId))) return;
  if (!confirmed) {
    document.getElementById("completedWinnerRecap").innerHTML = currentResult.courtGames.map(game =>
      `<li>Court ${game.court} · ${escapeHtml(game.team1.name)} vs ${escapeHtml(game.team2.name)}<strong>Winner: ${escapeHtml(game.winnerTeamId === game.team1.id ? game.team1.name : game.team2.name)}</strong></li>`).join("");
    document.getElementById("completionDialog").showModal();
    return;
  }
  syncScheduledGames();
  syncCurrentMatchups();
  const matchupIndices = currentResult.courtGames.map(game => game.historyIndex);
  if (new Set(matchupIndices).size !== matchupIndices.length ||
      matchupIndices.some(index => !Number.isInteger(index) || !formation.matchups[index])) return;
  matchupIndices.forEach(index => { formation.matchups[index].gamesPlayed = GameCounter.count(formation.matchups[index]) + 1; });
  const results = currentResult.courtGames.map(game => ({
    ...matchupRecord(game), teamSize: game.teamSize,
    winnerTeamId: game.winnerTeamId,
    winnerName: game.winnerTeamId === game.team1.id ? game.team1.name : game.team2.name,
    loserTeamId: game.winnerTeamId === game.team1.id ? game.team2.id : game.team1.id
  }));
  (formation.completions ||= []).push({ completedAt: new Date().toISOString(), matchupIndices,
    results, scheduleBatchNumber: currentResult.scheduleBatchNumber });
  currentResult.pendingCompletionIndex = formation.completions.length - 1;
  championshipPreview = null;
  document.getElementById("championshipPairing").value = currentResult.waitingTeams.length ? "waiting-winners" : "results";
  clearChampionshipPreview();
  saveEveningSession();
  renderResult(currentResult, false);
}

function undoLastCompletion() {
  const latest = latestCompletion();
  if (!latest) return;
  const { formation, completion } = latest;
  const records = completion.matchupIndices.map(index => formation.matchups[index]);
  if (records.some(record => !record || GameCounter.count(record) === 0)) return;
  records.forEach(record => { record.gamesPlayed = GameCounter.count(record) - 1; });
  completion.undone = true;
  completion.undoneAt = new Date().toISOString();
  if (formation === currentStoredFormation() && currentResult.scheduleBatchNumber === completion.scheduleBatchNumber) {
    currentResult.pendingCompletionIndex = null;
    currentResult.courtGames.forEach(game => { delete game.winnerTeamId; });
  }
  clearChampionshipPreview();
  saveEveningSession();
  if (currentResult) renderResult(currentResult, false);
}

document.getElementById("completeAllGames").addEventListener("click", () => completeAllGames());
document.getElementById("confirmGameCompletion").addEventListener("click", () => {
  if (!document.getElementById("completionDialog").open) return;
  document.getElementById("completionDialog").close();
  completeAllGames(true);
});
document.getElementById("cancelGameCompletion").addEventListener("click", () => document.getElementById("completionDialog").close());
document.getElementById("undoLastCompletion").addEventListener("click", undoLastCompletion);

function pendingGameCompletion() {
  const index = currentResult?.pendingCompletionIndex;
  if (!Number.isInteger(index)) return null;
  const completion = currentStoredFormation()?.completions?.[index];
  return completion && !completion.undone ? completion : null;
}

function scheduleLayoutKey(games) {
  return JSON.stringify(games.map(game => ({ court: game.court, teamSize: game.teamSize,
    team1Id: game.team1Id ?? game.team1.id, team2Id: game.team2Id ?? game.team2.id,
    team1: GameCounter.lineupKey(Array.isArray(game.team1) ? game.team1 : game.team1.players.map(player => player.id)),
    team2: GameCounter.lineupKey(Array.isArray(game.team2) ? game.team2 : game.team2.players.map(player => player.id))
  })).sort((a, b) => a.court - b.court));
}

function startScheduledGames(clearWinners = true) {
  const formation = currentStoredFormation();
  if (!formation) return;
  const batches = formation.scheduleBatches ||= [];
  currentResult.scheduleBatchNumber = batches.length + 1;
  currentResult.pendingCompletionIndex = null;
  if (clearWinners) currentResult.courtGames.forEach(game => { delete game.winnerTeamId; });
  batches.push({ number: currentResult.scheduleBatchNumber, scheduledAt: new Date().toISOString(),
    games: currentResult.courtGames.map(game => ({ ...matchupRecord(game), teamSize: game.teamSize })),
    waitingNames: currentResult.waitingTeams.map(team => team.name) });
  clearChampionshipPreview();
}

function syncScheduledGames() {
  const formation = currentStoredFormation();
  if (!formation) return;
  const batch = formation.scheduleBatches?.find(item => item.number === currentResult.scheduleBatchNumber);
  if (!batch) { startScheduledGames(false); return; }
  if (scheduleLayoutKey(batch.games) === scheduleLayoutKey(currentResult.courtGames)) return;
  const completed = formation.completions?.some(completion => !completion.undone && completion.scheduleBatchNumber === batch.number);
  if (completed) { startScheduledGames(); return; }
  currentResult.courtGames.forEach(game => { delete game.winnerTeamId; });
  batch.games = currentResult.courtGames.map(game => ({ ...matchupRecord(game), teamSize: game.teamSize }));
  batch.waitingNames = currentResult.waitingTeams.map(team => team.name);
  clearChampionshipPreview();
}

function renderAutomaticSchedule() {
  const batches = approvedFormations.flatMap(formation => (formation.scheduleBatches || []).map(batch => ({ formation, batch })));
  document.getElementById("automaticSchedule").innerHTML = batches.length ? `<h3>Games &amp; results</h3>${batches.reverse().map(({ formation, batch }) => {
    const completions = (formation.completions || []).filter(item => item.scheduleBatchNumber === batch.number);
    const completed = completions.findLast(item => !item.undone);
    const isCurrent = currentRoundApproved && formation.round === currentRoundNumber && currentResult?.scheduleBatchNumber === batch.number;
    const status = completed ? "Completed" : completions.length ? "Completion undone" : isCurrent ? "Up next" : "Replaced before completion";
    return `<section class="schedule-batch"><h4>Formation ${formation.round} · Game ${batch.number} <span>${status}</span></h4>
      <p class="setting-help">${completed ? "Completed" : "Scheduled"} ${escapeHtml(new Date(completed?.completedAt || batch.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}</p>
      <ul>${batch.games.map(game => {
        const outcome = completed?.results?.find(item => item.court === game.court);
        return `<li><strong>Court ${game.court}</strong> · ${escapeHtml(game.team1Name)} vs ${escapeHtml(game.team2Name)} · ${game.teamSize}v${game.teamSize}${outcome ? `<span class="schedule-winner">Winner: ${escapeHtml(outcome.winnerName)}</span>` : ""}</li>`;
      }).join("")}</ul>${batch.waitingNames?.length ? `<p class="setting-help">Waiting: ${batch.waitingNames.map(escapeHtml).join(", ")}</p>` : ""}</section>`;
  }).join("")}` : '<p class="setting-help">Approve a formation to add its games here automatically.</p>';
}

function clearChampionshipPreview() {
  championshipPreview = null;
  document.getElementById("championshipPreview").hidden = true;
  document.getElementById("startChampionship").hidden = true;
}

function previewChampionshipGames() {
  const completion = pendingGameCompletion();
  if (!completion) return;
  championshipPreview = Championship.plan(currentResult, completion.results,
    document.getElementById("championshipPairing").value, teamGroup);
  const panel = document.getElementById("championshipPreview");
  panel.hidden = false;
  panel.innerHTML = `<h4>Review next games</h4><ul>${championshipPreview.games.map(game =>
    `<li>Court ${game.court} · ${escapeHtml(game.team1.name)} vs ${escapeHtml(game.team2.name)} · ${game.teamSize}v${game.teamSize}</li>`).join("")}</ul>
    <p>Waiting: ${championshipPreview.waitingTeams.length ? championshipPreview.waitingTeams.map(team => escapeHtml(team.name)).join(", ") : "No teams"}</p>
    ${championshipPreview.mixedPairs ? '<p class="history-warning">The selected category rules or an uneven number of winners and losers require a mixed pairing to keep the courts in use.</p>' : ""}
    <p class="setting-help">Team rosters stay together. Unassigned players remain in rotation. You can still move teams manually after starting.</p>`;
  document.getElementById("startChampionship").hidden = false;
}

function startChampionshipGames() {
  if (!pendingGameCompletion() || !championshipPreview) return;
  currentResult.courtGames = championshipPreview.games;
  currentResult.waitingTeams = championshipPreview.waitingTeams;
  currentResult.plan.waitingTeams = currentResult.waitingTeams.length;
  startScheduledGames();
  finishTeamChange("Championship games are ready and added to Schedule. Select the winners when these games finish.");
}

document.getElementById("previewChampionship").addEventListener("click", previewChampionshipGames);
document.getElementById("startChampionship").addEventListener("click", startChampionshipGames);
function updateChampionshipPairingHelp() {
  const mode = document.getElementById("championshipPairing").value;
  document.getElementById("championshipPairingHelp").textContent = mode === "waiting-winners"
    ? "Winners keep their court places. Waiting teams enter in queue order to face them; remaining games pair winners with winners and losers with losers where possible. Category rules still apply."
    : mode === "waiting" ? "Waiting teams enter first to face losers. Winners rest as far as capacity allows. Category rules still apply."
    : "Pair winners with winners and losers with losers. Waiting teams remain on the bench. Category rules still apply.";
}
document.getElementById("championshipPairing").addEventListener("change", () => {
  clearChampionshipPreview();
  updateChampionshipPairingHelp();
});
document.getElementById("nextRemix").addEventListener("click", () => remixForNextRound());

resultsSection.addEventListener("change", event => {
  const select = event.target.closest("select[data-court-winner]");
  if (!select || !currentRoundApproved || pendingGameCompletion()) return;
  const game = currentResult?.courtGames.find(game => String(game.court) === select.dataset.courtWinner);
  if (!game || select.value && ![game.team1.id, game.team2.id].includes(select.value)) return;
  game.winnerTeamId = select.value || null;
  saveEveningSession();
  updateCompletionControls();
});

function renderGameCounter() {
  const panel = document.getElementById("gameCounterPanel");
  if (!panel) return;
  const gamesOpen = panel.querySelector(".games-played-details")?.open ?? true;
  const historyOpen = panel.querySelector(".completed-game-history")?.open || false;
  const totals = GameCounter.totals(approvedFormations);
  const names = new Map(players.map(player => [player.id, player.name]));
  approvedFormations.forEach(formation => (formation.participants || []).forEach(player => {
    if (!names.has(player.id)) names.set(player.id, player.name);
  }));
  const ids = new Set([...presentPlayerIds, ...totals.players.keys()]);
  const entries = [...ids].map(id => ({ id, name: names.get(id) || id, count: totals.players.get(id) || 0 }))
    .sort((a, b) => a.count - b.count || a.name.localeCompare(b.name));
  const highest = Math.max(0, ...entries.filter(entry => presentPlayerIds.has(entry.id)).map(entry => entry.count));
  panel.hidden = approvedFormations.length === 0;
  panel.innerHTML = `<details class="games-played-details" ${gamesOpen ? "open" : ""}>
    <summary><h2>Games played</h2></summary>
    <p>Select each court's winner, then use Game completed in Round controls once when all courts finish. All team members on court, including substitutes, receive a game. Waiting teams do not. Counts follow players when teams are remixed.</p>
    <div class="participation-list">${entries.map(entry => `<span class="participation-player${presentPlayerIds.has(entry.id) && entry.count < highest ? " fewer-games" : ""}">${escapeHtml(entry.name)}: <strong>${entry.count}</strong>${presentPlayerIds.has(entry.id) && entry.count < highest ? " · fewer games" : ""}</span>`).join("")}</div>
    <details class="completed-game-history" ${historyOpen ? "open" : ""}><summary>Completed-game history</summary>
    <p>Team letters refer to that formation only. Previous per-court counts are preserved. Undo last completion reverses the most recent shared completion, including after team moves.</p>
    ${approvedFormations.map((formation, roundIndex) => (formation.matchups || []).map((game, gameIndex) =>
      `<div class="game-history-row"><strong>Round ${escapeHtml(String(formation.round))} · Court ${escapeHtml(String(game.court || gameIndex + 1))} · ${escapeHtml(game.team1Name || "Team 1")} vs ${escapeHtml(game.team2Name || "Team 2")}</strong><p>${GameCounter.count(game)} completed</p></div>`).join("")).join("")}</details></details>`;
}

function renderEveningHistoryStatus() {
  renderGameCounter();

  if (
    !eveningHistoryStatus
  ) {

    return;

  }


  const count =
    approvedFormations.length;


  if (
    count === 0
  ) {

    eveningHistoryStatus.textContent =
      "No approved rounds in the current session.";

  }

  else if (
    count === 1
  ) {

    eveningHistoryStatus.textContent =
      "Current session · 1 approved round remembered.";

  }

  else {

    eveningHistoryStatus.textContent =
      `Current session · ${count} approved rounds remembered.`;

  }


  updateNewSessionButtonState();

}



// ==================================================
// START COMPLETELY NEW SESSION
// ==================================================

function startNewSession() {
  clearChampionshipPreview();

  const hasSessionState =
    approvedFormations.length > 0 ||
    presentPlayerIds.size > 0 || scheduleText.length > 0 ||
    currentResult !== null;


  if (
    !hasSessionState
  ) {

    return;

  }


  const confirmed =
    window.confirm(
      "Start a new session?\n\n" +
      "This will forget all approved rounds from the current session, clear attendance and return to Round 1.\n\n" +
      "The central player roster and locally saved newcomers will stay."
    );


  if (
    !confirmed
  ) {

    return;

  }


  localStorage.removeItem(
    EVENING_SESSION_KEY
  );


  approvedFormations = [];
  scheduleText = "";
  document.getElementById("scheduleNotes").value = "";
  document.getElementById("attendanceStatus").textContent = "";
  document.getElementById("teamsEmpty").hidden = false;
  document.getElementById("appendSchedule").disabled = true;
  showPanel("players");

  selectedMoveTeamId = null;
  sessionDunkers = [];
  dunkerCounter = 0;
  kidsCourtSelection = null;
  players = players.filter(player => !player.isPlaceholder);


  presentPlayerIds =
    new Set();


  currentResult =
    null;


  selectedSwapPlayer =
    null;


  lastSwapMessage =
    "";


  currentRoundNumber =
    1;


  currentRoundApproved =
    false;


  activeCategory =
    "All";


  resetAlternativeHistory();


  resultsSection.hidden =
    true;


  playerSearch.value = "";
  clearPlayerSearch.hidden = true;

  closeQuickAddForm();


  renderEveningHistoryStatus();


  renderPlayerInterface();

  renderAutomaticSchedule();
}



startNewSessionButton
  .addEventListener(
    "click",
    startNewSession
  );



// ==================================================
// MASTER / LOCAL ROSTER MATCHING
// ==================================================

function rosterKey(player) {

  return (
    normalizeName(
      player.name
    ) +
    "|" +
    player.category
  );

}



// ==================================================
// LOCAL PLAYER STORAGE
// ==================================================

function loadLocalPlayers() {

  try {

    const legacy = !localStorage.getItem(LOCAL_PLAYERS_KEY);
    const raw =
      localStorage.getItem(
        legacy ? "bballtools_3x3_local_players_v1" : LOCAL_PLAYERS_KEY
      );


    if (
      !raw
    ) {

      return [];

    }


    const parsed =
      JSON.parse(
        raw
      );


    if (
      !Array.isArray(parsed)
    ) {

      return [];

    }


    if (legacy) {
      migrateLegacySkills(parsed);
      localStorage.setItem(LOCAL_PLAYERS_KEY, JSON.stringify(parsed));
    }
    return parsed
      .filter(
        player =>
          player &&
          player.id &&
          player.name &&
          CATEGORY_ORDER.includes(
            player.category
          ) &&
          Number.isInteger(
            player.skill
          ) &&
          player.skill >= 1 &&
          player.skill <= 10
      )
      .map(
        player => ({

          id:
            player.id,

          name:
            player.name,

          category:
            player.category,

          skill:
            player.skill,

          source:
            "local"

        })
      );

  }

  catch (error) {

    console.error(
      "Could not load local players.",
      error
    );


    return [];

  }

}



function saveLocalPlayers() {

  const cleanPlayers =
    localPlayers.map(
      player => ({

        id:
          player.id,

        name:
          player.name,

        category:
          player.category,

        skill:
          player.skill

      })
    );


  localStorage.setItem(

    LOCAL_PLAYERS_KEY,

    JSON.stringify(
      cleanPlayers
    )

  );

}



// ==================================================
// CENTRAL + LOCAL ROSTER
// ==================================================

function mergePlayerSources() {

  const masterKeys =
    new Set(
      masterPlayers.map(
        rosterKey
      )
    );


  const previousLocalCount =
    localPlayers.length;


  localPlayers =
    localPlayers.filter(
      player =>
        !masterKeys.has(
          rosterKey(
            player
          )
        )
    );


  if (
    localPlayers.length !==
    previousLocalCount
  ) {

    saveLocalPlayers();

  }


  players = [

    ...masterPlayers,

    ...localPlayers,
    ...sessionDunkers

  ];
  players.forEach(player => {
    const saved = skillOverrides[player.id];
    // Official roster revisions supersede earlier device edits. New edits
    // remain valid until that player's next official rating revision.
    const rating = player.skillRevision
      ? saved?.revision === player.skillRevision ? saved.value : null
      : Number.isInteger(saved) ? saved : saved?.value;
    if (!player.isPlaceholder && Number.isInteger(rating) && rating >= 1 && rating <= 10) player.skill = rating;
  });

}



// ==================================================
// LOAD PLAYERS
// ==================================================

async function loadPlayers() {

  try {

    const response =
      await fetch(
        "./data/players.json",
        {
          cache: "no-store"
        }
      );


    if (
      !response.ok
    ) {

      throw new Error(
        "Could not load players."
      );

    }


    const loaded =
      await response.json();


    masterPlayers =
      loaded.map(
        player => ({

          ...player,

          source:
            "master"

        })
      );


    localPlayers =
      loadLocalPlayers();


    mergePlayerSources();

    if (currentResult && currentRoundApproved) {
      const official = new Map(players.filter(player => player.source === "master" && player.skillRevision).map(player => [player.id, player]));
      let ratingsChanged = false;
      [...currentResult.teams.flatMap(team => team.players), ...currentResult.rotationPlayers].forEach(player => {
        const updated = official.get(player.id);
        if (updated && (player.skill !== updated.skill || player.skillRevision !== updated.skillRevision)) {
          player.skill = updated.skill;
          player.skillRevision = updated.skillRevision;
          ratingsChanged = true;
        }
      });
      if (ratingsChanged) {
        currentResult.teams.forEach(recalculateTeam);
        saveEveningSession();
      }
    }

    renderPlayerInterface();

    if (currentResult && currentRoundApproved) renderResult(currentResult, false);

  }

  catch (error) {

    playerSummary.textContent =
      "Player list could not be loaded.";


    console.error(
      error
    );

  }

}



// ==================================================
// ALPHABETICAL PLAYER SORTING
// ==================================================

function sortPlayersByName(
  list
) {

  return [...list]
    .sort(
      (a, b) =>
        a.name.localeCompare(
          b.name,
          undefined,
          {
            sensitivity:
              "base"
          }
        )
    );

}



// ==================================================
// VISIBLE PLAYERS
// ==================================================

function getVisiblePlayers() {
  const searchKey = name => normalizeName(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const query = searchKey(playerSearch.value);
  return sortPlayersByName(players.filter(player =>
    (activeCategory === "All" || player.category === activeCategory) &&
    searchKey(player.name).includes(query)
  ));
}

playerSearch.addEventListener("input", () => {
  clearPlayerSearch.hidden = !playerSearch.value;
  renderPlayers();
  updatePlayerSummary();
});

function resetPlayerSearch() {
  playerSearch.value = "";
  clearPlayerSearch.hidden = true;
  renderPlayers();
  updatePlayerSummary();
  playerSearch.focus();
}

clearPlayerSearch.addEventListener("click", resetPlayerSearch);

playerSearch.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    event.preventDefault();
    resetPlayerSearch();
  }
});



// ==================================================
// CATEGORY TABS
// ==================================================

function renderCategoryTabs() {

  const categories = [
    "All",
    ...CATEGORY_ORDER
  ];


  categoryTabs.innerHTML =
    categories
      .map(
        category => {

          const count =
            category === "All"
              ? players.length
              : players.filter(
                  player =>
                    player.category ===
                    category
                ).length;


          const activeClass =
            category ===
            activeCategory
              ? " active"
              : "";


          return `

            <button
              type="button"
              class="category-tab${activeClass}"
              data-category="${escapeHtml(category)}"
            >

              ${escapeHtml(category)}

              <span>
                ${count}
              </span>

            </button>

          `;

        }
      )
      .join("");

}



categoryTabs
  .addEventListener(
    "click",
    event => {

      const tab =
        event.target.closest(
          ".category-tab"
        );


      if (
        !tab
      ) {

        return;

      }


      activeCategory =
        tab.dataset.category;


      renderPlayerInterface();


      if (
        !quickAddForm.hidden
      ) {

        updateQuickAddContext();

      }

    }
  );



// ==================================================
// PLAYER LIST
// ==================================================

function renderPlayers() {

  const visiblePlayers =
    getVisiblePlayers();


  playerList.innerHTML =
    visiblePlayers
      .map(
        player => {

          const checked =
            presentPlayerIds.has(
              player.id
            )
              ? "checked"
              : "";


          const localBadge =
            player.isPlaceholder ? '<span class="new-player-badge">Temporary guest</span>' : player.source ===
            "local"
              ? `

                <span class="new-player-badge">
                  New
                </span>

              `
              : "";


          const deleteButton =
            player.source ===
            "local"
              ? `

                <button
                  type="button"
                  class="delete-player-button"
                  data-delete-player-id="${escapeHtml(player.id)}"
                  title="Delete player"
                  aria-label="Delete ${escapeHtml(player.name)}"
                >
                  🗑️
                </button>

              `
              : `

                <span class="player-action-placeholder"></span>

              `;


          const checkboxId =
            `attendance_${player.id}`;


          return `

            <div class="player">

              <input
                id="${escapeHtml(checkboxId)}"
                type="checkbox"
                class="playerCheckbox"
                data-id="${escapeHtml(player.id)}"
                ${checked}
              >


              <label
                class="player-details"
                for="${escapeHtml(checkboxId)}"
              >

                <div class="player-name">

                  ${escapeHtml(player.name)}

                  ${localBadge}

                </div>

                <div class="player-info">
                  ${escapeHtml(player.isPlaceholder ? "Guest" : player.category)}
                </div>

              </label>


              <div class="player-rating">
                ${skillBasketballs(player.skill)}
                ${player.isPlaceholder ? "" : `<select data-player-skill="${escapeHtml(player.id)}" aria-label="Skill for ${escapeHtml(player.name)}">${Array.from({length:10}, (_,i) => `<option value="${i+1}" ${player.skill === i+1 ? "selected" : ""}>${i+1}</option>`).join("")}</select>`}
              </div>


              <div class="player-actions">
                ${deleteButton}
              </div>

            </div>

          `;

        }
      )
      .join("");


  if (
    visiblePlayers.length === 0
  ) {

    playerList.innerHTML = `

      <div class="empty-player-list">
        ${playerSearch.value.trim() ? "No players match your search in this category." : "No players in this category yet."}
      </div>

    `;

  }

}



// ==================================================
// PLAYER SUMMARY
// ==================================================

function updatePlayerSummary() {
  renderGameCounter();
  renderCheckedInOverview();

  const visiblePlayers =
    getVisiblePlayers();


  playerSummary.textContent =
    `${presentPlayerIds.size} of ${players.length} players present · ${visiblePlayers.length} ${playerSearch.value.trim() ? (visiblePlayers.length === 1 ? "match" : "matches") : "shown"}`;


  updateSelectAllButton();

  updateNewSessionButtonState();

  updateAdultOnlySettings();

}

function renderCheckedInOverview() {
  const selected = getPresentPlayers();
  const rated = selected.filter(player => Number.isInteger(player.skill));
  const unknown = selected.length - rated.length;
  const average = rated.length
    ? (rated.reduce((total, player) => total + player.skill, 0) / rated.length).toFixed(1)
    : null;
  document.getElementById("checkedInSummary").textContent = selected.length
    ? `${selected.length} checked in · Average skill ${average === null ? "—" : `${average}/10`}${unknown ? ` · ${unknown} unrated` : ""}`
    : "No players checked in yet. Select attending players above to see today's distribution.";

  const groups = CATEGORY_ORDER.map(category => ({
    category,
    members: sortPlayersByName(selected.filter(player => player.category === category))
  }));
  document.getElementById("checkedInDistribution").innerHTML = groups.map(({ category, members }) => {
    const percent = selected.length ? Math.round(members.length / selected.length * 100) : 0;
    return `<div class="age-distribution-item">
      <span>${escapeHtml(category)}</span><strong>${members.length}</strong>
      <span class="age-distribution-bar" aria-hidden="true"><span style="width:${percent}%"></span></span>
      <span class="distribution-percent">${percent}% of today</span>
    </div>`;
  }).join("");

  document.getElementById("checkedInGroups").innerHTML = groups.map(({ category, members }) => {
    const levels = [...new Set(members.map(player => player.skill))].sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return a - b;
    });
    return `<section class="checked-in-age" aria-label="${escapeHtml(category)} checked-in players">
      <h3>${escapeHtml(category)} <span>${members.length} ${members.length === 1 ? "player" : "players"}</span></h3>
      ${members.length ? levels.map(level => {
        const matching = members.filter(player => player.skill === level);
        return `<div class="checked-in-level">
          <div class="checked-in-skill">${skillBasketballs(level)}<span>${matching.length} ${matching.length === 1 ? "player" : "players"}</span></div>
          <ul class="checked-in-names">${matching.map(player => `<li>${escapeHtml(player.name)}${player.isPlaceholder ? '<span class="checked-in-guest">Guest</span>' : ""}</li>`).join("")}</ul>
        </div>`;
      }).join("") : '<p class="checked-in-empty">No players checked in.</p>'}
    </section>`;
  }).join("");
}



// ==================================================
// SELECT ALL
// ==================================================

function updateSelectAllButton() {

  const button =
    document.getElementById(
      "selectAll"
    );


  const visiblePlayers =
    getVisiblePlayers();


  if (
    visiblePlayers.length === 0
  ) {

    button.disabled =
      true;


    button.textContent =
      "Select all";


    return;

  }


  button.disabled =
    false;


  const allVisibleSelected =
    visiblePlayers.every(
      player =>
        presentPlayerIds.has(
          player.id
        )
    );


  button.textContent =
    allVisibleSelected
      ? "Clear visible"
      : "Select all";

}



document
  .getElementById(
    "selectAll"
  )
  .addEventListener(
    "click",
    () => {

      const visiblePlayers =
        getVisiblePlayers();


      const allVisibleSelected =
        visiblePlayers.every(
          player =>
            presentPlayerIds.has(
              player.id
            )
        );


      visiblePlayers.forEach(
        player => {

          if (
            allVisibleSelected
          ) {

            presentPlayerIds.delete(
              player.id
            );

          }

          else {

            presentPlayerIds.add(
              player.id
            );

          }

        }
      );


      updateAttendanceResults();


      renderPlayerInterface();

    }
  );



// ==================================================
// ATTENDANCE
// ==================================================

playerList
  .addEventListener(
    "change",
    event => {

      const checkbox =
        event.target.closest(
          ".playerCheckbox"
        );


      if (
        !checkbox
      ) {

        return;

      }


      const playerId =
        checkbox.dataset.id;


      if (
        checkbox.checked
      ) {

        presentPlayerIds.add(
          playerId
        );

      }

      else {

        presentPlayerIds.delete(
          playerId
        );

      }


      updateAttendanceResults();


      updatePlayerSummary();

    }
  );



// ==================================================
// DELETE LOCAL PLAYER
// ==================================================

playerList
  .addEventListener(
    "click",
    event => {

      const deleteButton =
        event.target.closest(
          ".delete-player-button"
        );


      if (
        !deleteButton
      ) {

        return;

      }


      event.preventDefault();

      event.stopPropagation();


      deleteLocalPlayer(
        deleteButton.dataset
          .deletePlayerId
      );

    }
  );



function deleteLocalPlayer(
  playerId
) {

  const player =
    localPlayers.find(
      item =>
        item.id ===
        playerId
    );


  if (
    !player
  ) {

    return;

  }


  const confirmed =
    window.confirm(
      `Delete ${player.name} from the locally saved player list?`
    );


  if (
    !confirmed
  ) {

    return;

  }


  localPlayers =
    localPlayers.filter(
      item =>
        item.id !==
        playerId
    );


  presentPlayerIds.delete(
    playerId
  );


  saveLocalPlayers();


  mergePlayerSources();


  invalidateResults();


  renderPlayerInterface();

}



// ==================================================
// QUICK ADD
// ==================================================

function updateQuickAddContext() {

  if (
    activeCategory ===
    "All"
  ) {

    addPlayerButton.textContent =
      "+ Add player";


    quickAddTitle.textContent =
      "Add player";


    quickAddDescription.textContent =
      "Choose the category and skill level. The player will be saved on this device.";


    quickAddCategoryRow.hidden =
      false;

  }

  else {

    addPlayerButton.textContent =
      `+ Add ${activeCategory} player`;


    quickAddTitle.textContent =
      `Add ${activeCategory} player`;


    quickAddDescription.textContent =
      `The player will automatically be added to ${activeCategory} and marked present.`;


    quickAddCategoryRow.hidden =
      true;


    newPlayerCategory.value =
      activeCategory;

  }

}



addPlayerButton
  .addEventListener(
    "click",
    () => {

      quickAddForm.hidden =
        !quickAddForm.hidden;


      updateQuickAddContext();


      if (
        !quickAddForm.hidden
      ) {

        setTimeout(
          () => {

            newPlayerName.focus();

          },
          0
        );

      }

    }
  );



document
  .getElementById(
    "cancelAddPlayer"
  )
  .addEventListener(
    "click",
    closeQuickAddForm
  );



function closeQuickAddForm() {

  quickAddForm.hidden =
    true;


  newPlayerName.value =
    "";


  quickAddSkill =
    6;


  renderSkillSelector();

}



// ==================================================
// AUTOMATIC NAME CAPITALIZATION
// ==================================================

newPlayerName
  .addEventListener(
    "blur",
    () => {

      newPlayerName.value =
        capitalizePlayerName(
          newPlayerName.value
        );

    }
  );



// ==================================================
// SKILL SELECTOR
// ==================================================

function renderSkillSelector() {

  document
    .querySelectorAll(
      ".skill-option"
    )
    .forEach(
      button => {

        const value =
          Number(
            button.dataset.skill
          );


        button.classList.toggle(
          "active",
          value ===
            quickAddSkill
        );
        button.setAttribute("aria-pressed", String(value === quickAddSkill));

      }
    );

}



document
  .getElementById(
    "skillSelector"
  )
  .addEventListener(
    "click",
    event => {

      const button =
        event.target.closest(
          ".skill-option"
        );


      if (
        !button
      ) {

        return;

      }


      quickAddSkill =
        Number(
          button.dataset.skill
        );


      renderSkillSelector();

    }
  );



// ==================================================
// ADD LOCAL PLAYER
// ==================================================

document
  .getElementById(
    "saveNewPlayer"
  )
  .addEventListener(
    "click",
    addLocalPlayer
  );



newPlayerName
  .addEventListener(
    "keydown",
    event => {

      if (
        event.key ===
        "Enter"
      ) {

        addLocalPlayer();

      }

    }
  );



function addLocalPlayer() {

  const enteredName =
    capitalizePlayerName(
      newPlayerName.value
    );


  newPlayerName.value =
    enteredName;


  if (
    !enteredName
  ) {

    alert(
      "Enter the player's name."
    );


    newPlayerName.focus();


    return;

  }


  /*
    Check duplicate name across the complete roster,
    regardless of category and letter case.

    If a duplicate exists, ask for differentiation
    instead of marking the existing person present.
  */

  const uniqueName =
    requestUniquePlayerName(
      enteredName
    );


  if (
    uniqueName === null
  ) {

    newPlayerName.focus();


    return;

  }


  newPlayerName.value =
    uniqueName;


  const category =
    activeCategory ===
    "All"
      ? newPlayerCategory.value
      : activeCategory;


  const player = {

    id:
      `L_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 7)}`,

    name:
      uniqueName,

    category,

    skill:
      quickAddSkill,

    source:
      "local"

  };


  localPlayers.push(
    player
  );


  saveLocalPlayers();


  mergePlayerSources();


  presentPlayerIds.add(
    player.id
  );


  updateAttendanceResults();


  closeQuickAddForm();


  renderPlayerInterface();

}



// ==================================================
// NEWCOMER TOOLS
// ==================================================

function renderNewcomerTools() {

  const count =
    localPlayers.length;


  if (
    count === 0
  ) {

    newcomerTools.hidden =
      true;


    return;

  }


  newcomerTools.hidden =
    false;


  newcomerCount.textContent =
    count === 1
      ? "1 new player on this device"
      : `${count} new players on this device`;

}



copyNewcomersButton
  .addEventListener(
    "click",
    async () => {

      if (
        localPlayers.length === 0
      ) {

        return;

      }


      const sorted =
        [...localPlayers]
          .sort(
            (a, b) => {

              const categoryDifference =
                CATEGORY_ORDER.indexOf(
                  a.category
                ) -
                CATEGORY_ORDER.indexOf(
                  b.category
                );


              if (
                categoryDifference !== 0
              ) {

                return categoryDifference;

              }


              return a.name.localeCompare(
                b.name,
                undefined,
                {
                  sensitivity:
                    "base"
                }
              );

            }
          );


      const text = [

        "New players for the 3x3 Team Maker:",

        "",

        ...sorted.map(
          player =>
            `${player.name} — ${player.category} — Skill ${player.skill}`
        )

      ].join(
        "\n"
      );


      try {

        await navigator.clipboard
          .writeText(
            text
          );


        showCopiedState();

      }

      catch (error) {

        const textarea =
          document.createElement(
            "textarea"
          );


        textarea.value =
          text;


        textarea.style.position =
          "fixed";


        textarea.style.opacity =
          "0";


        document.body.appendChild(
          textarea
        );


        textarea.select();


        document.execCommand(
          "copy"
        );


        textarea.remove();


        showCopiedState();

      }

    }
  );



function showCopiedState() {

  copyNewcomersButton.textContent =
    "Copied ✓";


  setTimeout(
    () => {

      copyNewcomersButton.textContent =
        "Copy newcomer list";

    },
    1600
  );

}



// ==================================================
// PLAYER INTERFACE
// ==================================================

function renderPlayerInterface() {

  renderCategoryTabs();

  renderPlayers();

  renderNewcomerTools();

  updateQuickAddContext();

  updatePlayerSummary();

}



// ==================================================
// COURTS / FORMAT
// ==================================================

function selectedKidsGroupPlayers() {
  const helpers = new Set(kidsCourtSelection?.u14Ids || []);
  return getPresentPlayers().filter(player => player.category === "Kids" || player.category === "U14" && helpers.has(player.id));
}

function clearKidsGroup() {
  const ids = new Set(sessionDunkers.map(player => player.id));
  ids.forEach(id => presentPlayerIds.delete(id));
  players = players.filter(player => !ids.has(player.id));
  sessionDunkers = [];
  kidsCourtSelection = null;
}

function finishKidsDialog(proceed) {
  const request = kidsDialogRequest;
  if (!request) return;
  kidsDialogRequest = null;
  kidsCourtDialog.close();
  request.resolve(proceed);
  document.getElementById("generateButton").focus();
}

function renderKidsCourtSlots() {
  if (!kidsDialogRequest) return;
  const slots = kidsDialogRequest.slots;
  const u14Players = getPresentPlayers().filter(player => player.category === "U14");
  document.getElementById("kidsCourtSlots").innerHTML = [0, 1].map(team =>
    `<section><h3>Kids team ${team + 1}</h3>${slots.slice(team * 3, team * 3 + 3).map((player, localIndex) => {
      const index = team * 3 + localIndex;
      if (index < kidsDialogRequest.lockedCount) return `<div class="kids-group-slot"><strong>${escapeHtml(player.name)}</strong><span>Kids</span></div>`;
      const available = u14Players.filter(candidate => !slots.some((slot, slotIndex) => slotIndex !== index && slot?.id === candidate.id));
      return `<div class="kids-group-slot${player ? "" : " empty-kids-slot"}">
        <label for="kidsHelper_${index}">Place ${localIndex + 1}</label>
        <select id="kidsHelper_${index}" data-kids-slot="${index}">
          <option value="">Empty place — choose a U14 player</option>
          ${player?.isPlaceholder ? `<option value="${escapeHtml(player.id)}" selected>${escapeHtml(player.name)} · temporary guest</option>` : ""}
          ${available.map(candidate => `<option value="${escapeHtml(candidate.id)}" ${candidate.id === player?.id ? "selected" : ""}>${escapeHtml(candidate.name)} · U14 · Skill ${candidate.skill}</option>`).join("")}
        </select>
        ${!player ? `<button type="button" class="secondary" data-add-dunker="${index}">Add Dunker</button>` : `<button type="button" class="secondary" data-remove-kids-helper="${index}">Clear place</button>`}
      </div>`;
    }).join("")}</section>`).join("");
  const missing = slots.filter(player => !player).length;
  document.getElementById("confirmKidsGroup").disabled = missing > 0;
  document.getElementById("kidsCourtSetupStatus").textContent = missing
    ? `${missing} ${missing === 1 ? "empty place" : "empty places"} to fill before continuing.`
    : "All six places are filled. Other teams will use the remaining players.";
}

function showKidsCourtSetup() {
  if (!kidsDialogRequest) return;
  document.getElementById("kidsCourtChoice").hidden = true;
  document.getElementById("kidsCourtSetup").hidden = false;
  renderKidsCourtSlots();
}

function prepareKidsCourt(forceEdit = false) {
  if (!kidsOnlyMode.checked) return Promise.resolve(true);
  const kids = getPresentPlayers().filter(player => player.category === "Kids" && !player.isPlaceholder);
  if (!forceEdit && (kids.length >= 6 || kidsCourtSelection?.confirmed && selectedKidsGroupPlayers().length >= 6)) return Promise.resolve(true);
  if (kidsDialogRequest) return kidsDialogRequest.promise;
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  const locked = kids.slice(0, 6);
  const helpers = selectedKidsGroupPlayers().filter(player => player.isPlaceholder || player.category === "U14");
  const slots = [...locked, ...helpers].slice(0, 6);
  while (slots.length < 6) slots.push(null);
  kidsDialogRequest = { promise, resolve, slots, lockedCount: locked.length };
  document.getElementById("kidsCourtChoice").hidden = forceEdit;
  document.getElementById("kidsCourtSetup").hidden = !forceEdit;
  document.getElementById("kidsCourtChoiceMessage").textContent = `${kids.length} Kids selected. Would you like a separate Kids basket with U14 helpers or temporary Dunkers, or mix the Kids into the other teams?`;
  if (forceEdit) renderKidsCourtSlots();
  kidsCourtDialog.showModal();
  return promise;
}

function addDunkerToSlot(index) {
  if (!kidsDialogRequest || index < kidsDialogRequest.lockedCount || index >= 6 || kidsDialogRequest.slots[index]) return;
  const number = ++dunkerCounter;
  kidsDialogRequest.slots[index] = {
    id: `session-dunker-${getTodayKey()}-${number}`, name: `Dunker ${number}`,
    category: "Kids", skill: null, source: "session", isPlaceholder: true
  };
  renderKidsCourtSlots();
}

function confirmKidsGroup() {
  if (!kidsDialogRequest || kidsDialogRequest.slots.some(player => !player)) return;
  const slots = kidsDialogRequest.slots;
  const attending = new Set(getPresentPlayers().map(player => player.id));
  if (new Set(slots.map(player => player.id)).size !== 6 || slots.some(player => !player.isPlaceholder && !attending.has(player.id))) {
    document.getElementById("kidsCourtSetupStatus").textContent = "Attendance changed. Cancel and choose the Kids group again.";
    return;
  }
  const previous = sessionDunkers.map(player => player.id);
  sessionDunkers = slots.filter(player => player.isPlaceholder);
  previous.filter(id => !sessionDunkers.some(player => player.id === id)).forEach(id => presentPlayerIds.delete(id));
  players = players.filter(player => !player.isPlaceholder).concat(sessionDunkers);
  sessionDunkers.forEach(player => presentPlayerIds.add(player.id));
  kidsCourtSelection = { confirmed: true, u14Ids: slots.filter(player => player.category === "U14").map(player => player.id) };
  invalidateResults();
  renderPlayerInterface();
  finishKidsDialog(true);
}

document.getElementById("keepKidsCourt").addEventListener("click", showKidsCourtSetup);
document.getElementById("mixKidsCourt").addEventListener("click", () => {
  kidsOnlyMode.checked = false;
  clearKidsGroup();
  invalidateResults();
  renderPlayerInterface();
  finishKidsDialog(true);
});
document.getElementById("cancelKidsCourt").addEventListener("click", () => finishKidsDialog(false));
kidsCourtDialog.addEventListener("cancel", event => { event.preventDefault(); finishKidsDialog(false); });
document.getElementById("confirmKidsGroup").addEventListener("click", confirmKidsGroup);
document.getElementById("editKidsGroup").addEventListener("click", async () => {
  if (await prepareKidsCourt(true)) await generateTeams(false);
});
document.getElementById("kidsCourtSlots").addEventListener("change", event => {
  const select = event.target.closest("select[data-kids-slot]");
  if (!select || !kidsDialogRequest) return;
  const index = Number(select.dataset.kidsSlot);
  if (index < kidsDialogRequest.lockedCount || index >= 6) return;
  const current = kidsDialogRequest.slots[index];
  kidsDialogRequest.slots[index] = current?.isPlaceholder && current.id === select.value ? current
    : getPresentPlayers().find(player => player.category === "U14" && player.id === select.value) || null;
  renderKidsCourtSlots();
});
document.getElementById("kidsCourtSlots").addEventListener("click", event => {
  const add = event.target.closest("button[data-add-dunker]");
  if (add) addDunkerToSlot(Number(add.dataset.addDunker));
  const remove = event.target.closest("button[data-remove-kids-helper]");
  if (remove && kidsDialogRequest) {
    const index = Number(remove.dataset.removeKidsHelper);
    if (index >= kidsDialogRequest.lockedCount && index < 6) kidsDialogRequest.slots[index] = null;
    renderKidsCourtSlots();
  }
});

function updateAdultOnlySettings() {
  const kidsCount = getPresentPlayers().filter(player => player.category === "Kids" && !player.isPlaceholder).length;
  const groupSize = selectedKidsGroupPlayers().length;
  const kidsBasketReserved = kidsOnlyMode.checked && (kidsCount >= 6 || kidsCourtSelection?.confirmed && groupSize >= 6);
  document.getElementById("editKidsGroup").hidden = !kidsOnlyMode.checked || kidsCount >= 6 && !kidsCourtSelection;
  kidsOnlyStatus.textContent = !kidsOnlyMode.checked
    ? "Off: Kids are mixed into regular teams."
    : !kidsBasketReserved
      ? `${kidsCount} selected Kids. When creating teams, choose a separate Kids basket with U14 helpers or Dunkers, or mix the Kids into the other teams.`
      : `One basket reserved for the selected Kids group as 3v3${kidsCourtSelection ? ", including its U14 helpers and Dunkers" : ""}. Extra group members wait or rotate within the group.${courts === 1 ? " Other teams will wait because no basket remains." : ""}`;
  const previousMaximum = restoredCategoryCourtMaximum || Number(adultCourtMaximum.value) || 1;

  const category1 = matchupCategory1.value || "18+";
  const category2 = matchupCategory2.value || "18+";
  const kidsIds = new Set(kidsBasketReserved ? selectedKidsGroupPlayers().map(player => player.id) : []);
  const available = getPresentPlayers().filter(player => !kidsIds.has(player.id));
  const count1 = available.filter(player => player.category === category1).length;
  const count2 = available.filter(player => player.category === category2).length;
  const eligible = category1 === category2 ? count1 >= 6 : count1 >= 3 && count2 >= 3;

  const formatPreference =
    document.getElementById("gameFormat").value;

  const adultPreference =
    formatPreference === "4" && count1 < 8
      ? "3"
      : formatPreference;

  const usableAdultCourts = eligible
    ? category1 === category2 ? TeamOptimizer.choosePlan(
        count1,
        Math.max(0, courts - (kidsBasketReserved ? 1 : 0)),
        adultPreference
      ).playableCourts : Math.min(Math.floor(count1 / 3), Math.floor(count2 / 3), Math.max(0, courts - (kidsBasketReserved ? 1 : 0)))
    : 1;

  const maximum = Math.max(
    1,
    Math.min(courts, usableAdultCourts)
  );

  adultCourtMaximum.replaceChildren();

  for (let count = 1; count <= maximum; count++) {
    const option = document.createElement("option");
    option.value = String(count);
    option.textContent = String(count);
    adultCourtMaximum.appendChild(option);
  }

  adultCourtMaximum.value =
    String(Math.min(previousMaximum, maximum));
  if (players.length) restoredCategoryCourtMaximum = null;

  const enabled = categoryMatchupEnabled();
  document.getElementById("categoryMatchupSetting").hidden = !enabled;
  adultCourtSetting.hidden = !enabled;
  adultOnlyStatus.hidden = !enabled;
  adultOnlyStatus.textContent = !eligible
    ? `${category1}: ${count1}${category1 !== category2 ? ` · ${category2}: ${count2}` : ""} checked in. ${category1 === category2 ? `At least 6 ${category1} players are needed` : "At least 3 in each category are needed"}; the remaining players are mixed until then.`
    : usableAdultCourts === 0 ? "No basket remains after reserving the Kids basket. Other players must wait."
    : `${category1} vs ${category2} is available. ${category1}: ${count1}${category1 !== category2 ? ` · ${category2}: ${count2}` : ""} checked in. Everyone else is mixed; fewer-game priority applies within each group.`;
  renderAdditionalCategoryRules();
}

function categoryMatchupEnabled() {
  return adultOnlyMode.value === "category";
}

function adultOnlyOptions() {
  const enabled = categoryMatchupEnabled();
  const category1 = matchupCategory1.value || "18+";
  const category2 = matchupCategory2.value || "18+";
  return {
    kidsOnly: kidsOnlyMode.checked,
    kidsGroupPlayerIds: kidsOnlyMode.checked ? selectedKidsGroupPlayers().map(player => player.id) : [],
    categoryMatchup: enabled ? { category1, category2, maxCourts: Number(adultCourtMaximum.value) || 1 } : null,
    categoryMatchups: enabled ? [{category1,category2,maxCourts:Number(adultCourtMaximum.value)||1},...additionalCategoryRules.map(rule=>({...rule}))] : [],
    adultOnly: enabled && category1 === "18+" && category2 === "18+",
    maxAdultCourts: Number(adultCourtMaximum.value) || 1
  };
}

function renderAdditionalCategoryRules() {
  const enabled=categoryMatchupEnabled();
  document.getElementById("extraMatchupSettings").hidden=!enabled;
  const categories=CATEGORY_ORDER.filter(category=>category!=="Kids");
  const options=selected=>categories.map(category=>`<option value="${escapeHtml(category)}" ${category===selected?"selected":""}>${escapeHtml(category)}</option>`).join("");
  const available=getPresentPlayers().filter(player=>!kidsOnlyMode.checked || !selectedKidsGroupPlayers().some(member=>member.id===player.id));
  document.getElementById("additionalCategoryRules").innerHTML=additionalCategoryRules.map((rule,index)=>{
    const first=available.filter(player=>player.category===rule.category1).length,second=available.filter(player=>player.category===rule.category2).length;
    const eligible=rule.category1===rule.category2?first>=6:first>=3&&second>=3;
    return `<section class="category-matchup-setting extra-category-rule"><h3>Matchup ${index+2}</h3>
      <div class="setting-row"><label for="ruleFirst${index}">First category</label><select id="ruleFirst${index}" data-rule-index="${index}" data-rule-field="category1">${options(rule.category1)}</select></div>
      <div class="setting-row"><label for="ruleSecond${index}">Plays against</label><select id="ruleSecond${index}" data-rule-index="${index}" data-rule-field="category2">${options(rule.category2)}</select></div>
      <div class="setting-row"><label for="ruleBaskets${index}">Maximum baskets</label><select id="ruleBaskets${index}" data-rule-index="${index}" data-rule-field="maxCourts">${Array.from({length:Math.max(courts,rule.maxCourts)},(_,i)=>`<option value="${i+1}" ${rule.maxCourts===i+1?"selected":""}>${i+1}</option>`).join("")}</select></div>
      <p class="setting-help">${escapeHtml(rule.category1)}: ${first}${rule.category1===rule.category2?"":` · ${escapeHtml(rule.category2)}: ${second}`} checked in. ${eligible?"Ready.":rule.category1===rule.category2?"Needs at least 6 players; mixed until then.":"Needs at least 3 per category; mixed until then."}</p>
      <button type="button" class="secondary" data-remove-rule="${index}">Remove matchup ${index+2}</button></section>`;
  }).join("");
  const rules=adultOnlyOptions().categoryMatchups, used=new Set(),duplicates=new Set();
  rules.forEach(rule=>new Set([rule.category1,rule.category2]).forEach(category=>{if(used.has(category))duplicates.add(category);used.add(category);}));
  const reserved=kidsOnlyMode.checked?1:0;
  const requested=rules.reduce((sum,rule)=>sum+rule.maxCourts,0);
  document.getElementById("categoryBasketBudget").textContent=duplicates.size
    ? `Each category can appear in one matchup. Already used: ${[...duplicates].join(", ")}.`
    : requested+reserved>courts?`You allocated ${requested+reserved} baskets, including Kids, but only ${courts} are available. Reduce basket allocations or remove a matchup.`
    : `${reserved} Kids basket · ${requested} category ${requested===1?"basket":"baskets"} · ${courts-reserved-requested} baskets left for mixed games. Each category can appear in one matchup.`;
  document.getElementById("addCategoryRule").disabled=used.size>=categories.length;
}

document.getElementById("addCategoryRule").addEventListener("click",()=>{
  const used=new Set(adultOnlyOptions().categoryMatchups.flatMap(rule=>[rule.category1,rule.category2]));
  const category=CATEGORY_ORDER.find(category=>category!=="Kids"&&!used.has(category));
  if(!category)return;
  additionalCategoryRules.push({category1:category,category2:category,maxCourts:1});
  updateAdultOnlySettings();invalidateResults();
});
document.getElementById("additionalCategoryRules").addEventListener("change",event=>{
  const select=event.target.closest("select[data-rule-index]");
  if(!select)return;
  const rule=additionalCategoryRules[Number(select.dataset.ruleIndex)],field=select.dataset.ruleField;
  if(!rule||!["category1","category2","maxCourts"].includes(field))return;
  rule[field]=field==="maxCourts"?Number(select.value):select.value;
  updateAdultOnlySettings();invalidateResults();
});
document.getElementById("additionalCategoryRules").addEventListener("click",event=>{
  const button=event.target.closest("button[data-remove-rule]");
  if(!button)return;
  additionalCategoryRules.splice(Number(button.dataset.removeRule),1);
  updateAdultOnlySettings();invalidateResults();
});

adultOnlyMode.addEventListener("change", () => {
  updateAdultOnlySettings();
  invalidateResults();
});

adultCourtMaximum.addEventListener("change", invalidateResults);
[matchupCategory1, matchupCategory2].forEach(select => select.addEventListener("change", () => {
  updateAdultOnlySettings();
  invalidateResults();
}));

kidsOnlyMode.addEventListener("change", () => {
  if (!kidsOnlyMode.checked) clearKidsGroup();
  updateAdultOnlySettings();
  invalidateResults();
  renderPlayerInterface();
});

updateAdultOnlySettings();

document
  .getElementById(
    "courtPlus"
  )
  .addEventListener(
    "click",
    () => {

      courts++;


      courtCount.textContent =
        courts;

      updateAdultOnlySettings();

      invalidateResults();

    }
  );



document
  .getElementById(
    "courtMinus"
  )
  .addEventListener(
    "click",
    () => {

      if (
        courts > 1
      ) {

        courts--;


        courtCount.textContent =
          courts;

        updateAdultOnlySettings();

        invalidateResults();

      }

    }
  );



document
  .getElementById(
    "gameFormat"
  )
  .addEventListener(
    "change",
    () => {
      updateAdultOnlySettings();
      invalidateResults();
    }
  );



// ==================================================
// ALTERNATIVE HISTORY
// ==================================================

function resetAlternativeHistory() {

  suggestionNumber =
    0;


  seenSuggestionSignatures =
    new Set();


  alternativesExhausted =
    false;


  currentRepeatNotice =
    false;

}



// ==================================================
// INVALIDATE CURRENT RESULT
// ==================================================

function updateAttendanceResults() {
  document.getElementById("attendanceStatus").textContent = "";
  if (!currentResult || !currentRoundApproved) { invalidateResults(); return; }
  // Keep approved rosters fixed until the leader remixes. Unassigned arrivals
  // can be checked in or out without changing any court or completion record.
  let restored = false;
  const rosterIds = new Set(currentResult.teams.flatMap(team => team.players.map(player => player.id)));
  rosterIds.forEach(id => { if (!presentPlayerIds.has(id)) { presentPlayerIds.add(id); restored = true; } });
  currentResult.rotationPlayers = players.filter(player => presentPlayerIds.has(player.id) && !rosterIds.has(player.id));
  finishTeamChange("Attendance updated. Assign late arrivals as substitutes or include them after the game with Reset & remix.");
  document.getElementById("attendanceStatus").textContent = restored
    ? "Players assigned to approved teams stay selected. Record the game, then reset & remix to change team attendance."
    : "Approved teams stay in place. Late arrivals are in unassigned rotation on Teams & games.";
  renderPlayerInterface();
}

document.getElementById("editNextAttendance").addEventListener("click", () => {
  if (!currentResult || !currentRoundApproved) return;
  if (!window.confirm("Record any completed game first. Then close this court layout and change attendance for the next teams? Earlier game counts and approved formations will stay saved.")) return;
  invalidateResults();
  showPanel("players");
  document.getElementById("attendanceStatus").textContent = "Update attendance, then create and review the next teams. Earlier game counts are saved.";
});

playerList.addEventListener("change", event => {
  const select = event.target.closest("select[data-player-skill]");
  if (!select) return;
  const rating = Number(select.value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) return;
  const id = select.dataset.playerSkill;
  const player = players.find(player => player.id === id);
  skillOverrides[id] = player?.skillRevision ? { value: rating, revision: player.skillRevision } : rating;
  localStorage.setItem(SKILL_OVERRIDES_KEY, JSON.stringify(skillOverrides));
  const copies = [...players, ...masterPlayers, ...localPlayers,
    ...(currentResult ? [...currentResult.teams.flatMap(team => team.players), ...currentResult.rotationPlayers] : [])];
  copies.filter(player => player.id === id).forEach(player => { player.skill = rating; });
  if (currentResult && currentRoundApproved) {
    currentResult.teams.forEach(recalculateTeam);
    saveEveningSession();
    renderResult(currentResult, false);
  } else invalidateResults();
  renderPlayers();
  renderCheckedInOverview();
});

function invalidateResults() {
  clearChampionshipPreview();
  document.getElementById("teamsEmpty").hidden = false;
  document.getElementById("appendSchedule").disabled = true;
  selectedMoveTeamId = null;

  currentResult =
    null;


  selectedSwapPlayer =
    null;


  lastSwapMessage =
    "";


  currentRoundApproved =
    false;


  currentRoundNumber =
    approvedFormations.length +
    1;


  resetAlternativeHistory();


  resultsSection.hidden =
    true;


  updateNewSessionButtonState();

  saveEveningSession();

}



// ==================================================
// RESULT DISPLAY HELPERS
// ==================================================

function currentStoredFormation() {
  return currentRoundApproved
    ? approvedFormations.find(formation => formation.round === currentRoundNumber) : null;
}

function teamGroup(team) {
  if (currentResult.plan.specialKidsCourt && (team.group === "Kids" || team.players.every(isKidsGroupPlayer))) return "Kids";
  if (team.categoryRuleId) return `category-matchup:${team.categoryRuleId}`;
  if (team.group === "category-matchup") return "category-matchup";
  if (currentResult.plan.adultOnlyActive && team.players.every(player => player.category === "18+")) return "18+";
  return "regular";
}

function isKidsGroupPlayer(player) {
  return currentResult?.kidsGroupPlayerIds
    ? currentResult.kidsGroupPlayerIds.includes(player.id) : player.category === "Kids";
}

function canAssignSubstitute(player, team) {
  if (team.players.length >= team.teamSize + 1) return false;
  return playerCompatibleWithTeam(player, team);
}

function playerCompatibleWithTeam(player, team) {
  if (currentResult.plan.specialKidsCourt && isKidsGroupPlayer(player) !== (teamGroup(team) === "Kids")) return false;
  if (currentResult.plan.categoryMatchupActive && teamGroup(team) !== "Kids") {
    if (team.requiredCategory) return player.category === team.requiredCategory;
    const rules = currentResult.plan.categoryMatchups?.length ? currentResult.plan.categoryMatchups : [currentResult.plan.categoryMatchup];
    return !rules.some(rule=>player.category===rule.category1||player.category===rule.category2);
  }
  if (currentResult.plan.adultOnlyActive && (player.category === "18+") !== (teamGroup(team) === "18+")) return false;
  return true;
}

function matchupRecord(game) {
  return {
    court: game.court,
    team1Id: game.team1.id, team2Id: game.team2.id,
    team1Name: game.team1.name, team2Name: game.team2.name,
    team1: game.team1.players.map(player => player.id),
    team2: game.team2.players.map(player => player.id),
    participatingPlayerIds: game.team1.players.concat(game.team2.players).map(player => player.id),
    gamesPlayed: 0
  };
}

// Keep every played matchup immutable. A changed assignment, roster or list
// of participants starts a new counter instead of rewriting previous games.
function syncCurrentMatchups() {
  const formation = currentStoredFormation();
  if (!formation) return;
  formation.substitutePlayerIds = currentResult.teams.flatMap(team => team.substituteIds || []);
  formation.rotationRoleIds = [...new Set([
    ...(formation.rotationRoleIds || formation.rotation || []),
    ...formation.substitutePlayerIds,
    ...currentResult.rotationPlayers.map(player => player.id)
  ])];
  currentResult.courtGames.forEach((game, index) => {
    const record = matchupRecord(game);
    const previous = formation.matchups[game.historyIndex ?? index];
    const sameIds = (a, b) => GameCounter.lineupKey(a || []) === GameCounter.lineupKey(b || []);
    const same = previous && previous.court === record.court &&
      sameIds(previous.team1, record.team1) && sameIds(previous.team2, record.team2) &&
      sameIds(previous.participatingPlayerIds || previous.team1.concat(previous.team2), record.participatingPlayerIds);
    if (same) {
      game.historyIndex ??= index;
      previous.team1Id = record.team1Id;
      previous.team2Id = record.team2Id;
    } else {
      game.historyIndex = formation.matchups.length;
      formation.matchups.push(record);
    }
  });
}

function finishTeamChange(message) {
  selectedSwapPlayer = null;
  selectedMoveTeamId = null;
  currentResult.plan.individualRotation = currentResult.rotationPlayers.length;
  currentResult.plan.assignedSubstitutes = currentResult.teams.reduce((sum, team) => sum + (team.substituteIds?.length || 0), 0);
  currentResult.plan.waitingPlayers = currentResult.waitingTeams.reduce((sum, team) => sum + team.players.length, 0) + currentResult.rotationPlayers.length;
  syncCurrentMatchups();
  syncScheduledGames();
  if (currentRoundApproved) saveEveningSession();
  renderResult(currentResult, false);
  teamMoveStatus.textContent = message;
}

function handleTeamMove(teamId) {
  if (!currentResult || !findTeam(teamId)) return;
  if (!selectedMoveTeamId) {
    selectedMoveTeamId = teamId;
    renderResult(currentResult, false);
    return;
  }
  if (selectedMoveTeamId === teamId) {
    selectedMoveTeamId = null;
    renderResult(currentResult, false);
    return;
  }
  const first = findTeam(selectedMoveTeamId);
  const second = findTeam(teamId);
  if (first.teamSize !== second.teamSize || teamGroup(first) !== teamGroup(second)) {
    teamMoveStatus.textContent = "Choose a team from the same group and game format. Kids and category matchups stay separate.";
    return;
  }
  const firstOnCourt = currentResult.courtGames.some(game => game.team1.id === first.id || game.team2.id === first.id);
  const secondOnCourt = currentResult.courtGames.some(game => game.team1.id === second.id || game.team2.id === second.id);
  if (!firstOnCourt && !secondOnCourt) {
    teamMoveStatus.textContent = "Select a team on court to exchange with this waiting team.";
    return;
  }
  const replace = team => team.id === first.id ? second : team.id === second.id ? first : team;
  if (currentResult.courtGames.some(game => game.categoryMatchup && game.category1 !== game.category2 &&
      replace(game.team1).requiredCategory === replace(game.team2).requiredCategory)) {
    teamMoveStatus.textContent = "This move would break the selected category matchup. Exchange teams from the same category, or swap the two teams on one court.";
    return;
  }
  currentResult.courtGames.forEach(game => {
    if ([game.team1.id, game.team2.id].some(id => id === first.id || id === second.id)) {
      game.team1 = replace(game.team1);
      game.team2 = replace(game.team2);
    }
  });
  currentResult.waitingTeams = currentResult.waitingTeams.map(replace);
  finishTeamChange(`Moved ${first.name} and ${second.name}. No game was added. Record the next game when it finishes.`);
}

function assignSubstitute(playerId, teamId) {
  if (!currentResult) return;
  const player = currentResult.rotationPlayers.find(player => player.id === playerId);
  const team = findTeam(teamId);
  if (!player || !team || !canAssignSubstitute(player, team)) return;
  team.players.push(player);
  team.substituteIds = [...(team.substituteIds || []), player.id];
  currentResult.rotationPlayers = currentResult.rotationPlayers.filter(candidate => candidate.id !== player.id);
  recalculateTeam(team);
  finishTeamChange(`${player.name} joins ${team.name} as a substitute. The game stays ${team.teamSize}v${team.teamSize}.`);
}

function returnSubstitute(playerId, teamId) {
  const team = findTeam(teamId);
  if (!team?.substituteIds?.includes(playerId)) return;
  const player = team.players.find(player => player.id === playerId);
  team.players = team.players.filter(player => player.id !== playerId);
  team.substituteIds = team.substituteIds.filter(id => id !== playerId);
  currentResult.rotationPlayers.push(player);
  recalculateTeam(team);
  finishTeamChange(`${player.name} is back in unassigned rotation. Earlier game counts are unchanged.`);
}

cancelTeamMove.addEventListener("click", () => {
  selectedMoveTeamId = null;
  if (currentResult) renderResult(currentResult, false);
});

resultsSection.addEventListener("click", event => {
  const move = event.target.closest("button[data-move-team]");
  if (move) handleTeamMove(move.dataset.moveTeam);
  const assign = event.target.closest("button[data-assign-substitute]");
  if (assign) {
    const select = document.getElementById(assign.dataset.selectId);
    assignSubstitute(assign.dataset.assignSubstitute, select.value);
  }
  const release = event.target.closest("button[data-return-substitute]");
  if (release) returnSubstitute(release.dataset.returnSubstitute, release.dataset.teamId);
});

resultsSection.addEventListener("change", event => {
  const select = event.target.closest("select[data-dunker-skill]");
  if (!select || !currentResult) return;
  const value = select.value === "" ? null : Number(select.value);
  if (value !== null && (!Number.isInteger(value) || value < 1 || value > 10)) return;
  const id = select.dataset.dunkerSkill;
  const copies = [...sessionDunkers, ...players, ...currentResult.teams.flatMap(team => team.players), ...currentResult.rotationPlayers];
  copies.filter(player => player.id === id && player.isPlaceholder).forEach(player => { player.skill = value; });
  currentResult.teams.filter(team => team.players.some(player => player.id === id)).forEach(recalculateTeam);
  if (currentRoundApproved) saveEveningSession();
  renderPlayers();
  renderCheckedInOverview();
  renderResult(currentResult, false);
});

function playerRow(
  player,
  teamId
) {

  const selected =
    selectedSwapPlayer &&
    selectedSwapPlayer.location ===
      "team" &&
    selectedSwapPlayer.teamId ===
      teamId &&
    selectedSwapPlayer.playerId ===
      player.id;


  const disabled =
    currentRoundApproved
      ? "disabled"
      : "";


  return `

    <button
      type="button"
      class="result-player swappable-player${selected ? " selected-swap-player" : ""}${currentRoundApproved ? " locked-player" : ""}"
      data-location="team"
      data-team-id="${escapeHtml(teamId)}"
      data-player-id="${escapeHtml(player.id)}"
      ${disabled}
    >

      <span class="result-player-left">

        <strong>
          ${escapeHtml(player.name)}
        </strong>

        <span class="category">
          ${escapeHtml(player.isPlaceholder ? "Guest · temporary" : player.category)}
        </span>

        <span class="games-badge">${GameCounter.totals(approvedFormations).players.get(player.id) || 0} games played</span>

        ${findTeam(teamId)?.substituteIds?.includes(player.id) ? '<span class="substitute-badge">Substitute</span>' : ""}

      </span>

      <span class="result-skill">

        ${skillBasketballs(
          player.skill
        )}

      </span>

    </button>

  `;

}



function teamCard(team) {
  const counts = GameCounter.totals(approvedFormations);
  const played = team.players.map(player => counts.players.get(player.id) || 0);
  const minimum = Math.min(...played);
  const maximum = Math.max(...played);
  const lineupGames = counts.lineups.get(GameCounter.lineupKey(team.players.map(player => player.id))) || 0;
  const formation = currentStoredFormation();
  const teamGames = (formation?.matchups || []).filter(game => game.team1Id === team.id || game.team2Id === team.id)
    .reduce((sum, game) => sum + GameCounter.count(game), 0);
  const substituteControls = team.players.filter(player => team.substituteIds?.includes(player.id)).map(player =>
    `<button type="button" class="secondary" data-return-substitute="${escapeHtml(player.id)}" data-team-id="${escapeHtml(team.id)}">Return ${escapeHtml(player.name)} to rotation</button>`).join("");
  const dunkerControls = team.players.filter(player => player.isPlaceholder).map(player =>
    `<label class="dunker-rating">${escapeHtml(player.name)} skill
      <select data-dunker-skill="${escapeHtml(player.id)}" aria-label="Skill for ${escapeHtml(player.name)}">
        <option value="" ${player.skill === null ? "selected" : ""}>Unknown</option>
        ${Array.from({ length: 10 }, (_, i) => i + 1).map(skill => `<option value="${skill}" ${skill === player.skill ? "selected" : ""}>${skill}</option>`).join("")}
      </select></label>`).join("");

  const playersHtml =
    team.players
      .map(
        player =>
          playerRow(
            player,
            team.id
          )
      )
      .join("");


  return `

    <div class="team-card${selectedMoveTeamId === team.id ? " selected-move-team" : ""}">

      <div class="team-header">

        <strong>
          ${escapeHtml(team.name)}
        </strong>

        <span>
          ${teamAverageLabel(team)}
        </span>

      </div>

      ${playersHtml}

      <p class="team-games">${team.teamSize} on court${team.substituteIds?.length ? " + 1 substitute" : ""} · Team: ${teamGames} games this formation · This lineup: ${lineupGames} games · Players: ${minimum === maximum ? minimum : `${minimum}–${maximum}`} games each</p>
      <button type="button" class="secondary move-team-button" data-move-team="${escapeHtml(team.id)}" aria-pressed="${selectedMoveTeamId === team.id}">${selectedMoveTeamId === team.id ? "Selected — cancel" : selectedMoveTeamId ? "Exchange with selected team" : "Move team"}</button>
      <div class="substitute-controls">${substituteControls}</div>
      ${dunkerControls}

    </div>

  `;

}



function rotationPlayerRow(
  player
) {

  const selected =
    selectedSwapPlayer &&
    selectedSwapPlayer.location ===
      "rotation" &&
    selectedSwapPlayer.playerId ===
      player.id;


  const disabled =
    currentRoundApproved
      ? "disabled"
      : "";


  const eligible = currentResult.teams.filter(team => canAssignSubstitute(player, team));
  const selectorId = `substituteTeam_${player.id}`;
  return `

    <div class="rotation-assignment">

    <button
      type="button"
      class="result-player swappable-player rotation-player${selected ? " selected-swap-player" : ""}${currentRoundApproved ? " locked-player" : ""}"
      data-location="rotation"
      data-player-id="${escapeHtml(player.id)}"
      ${disabled}
    >

      <span class="result-player-left">

        <strong>
          ${escapeHtml(player.name)}
        </strong>

        <span class="category">
          ${escapeHtml(player.isPlaceholder ? "Guest · temporary" : player.category)}
        </span>

        <span class="games-badge">${GameCounter.totals(approvedFormations).players.get(player.id) || 0} games played</span>

      </span>

      <span class="result-skill">

        ${skillBasketballs(
          player.skill
        )}

      </span>

    </button>

    <div class="substitute-assignment">
      <label for="${escapeHtml(selectorId)}">Assign ${escapeHtml(player.name)} to</label>
      <select id="${escapeHtml(selectorId)}" ${eligible.length ? "" : "disabled"}>
        ${eligible.map(team => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)} · ${teamAverageLabel(team)}</option>`).join("")}
      </select>
      <button type="button" class="secondary" data-assign-substitute="${escapeHtml(player.id)}" data-select-id="${escapeHtml(selectorId)}" ${eligible.length ? "" : "disabled"}>Assign as substitute</button>
      ${eligible.length ? "" : "<span>No compatible team has space for an extra player.</span>"}
    </div>
    </div>

  `;

}



// ==================================================
// RECALCULATE TEAM
// ==================================================

function recalculateTeam(
  team
) {

  team.totalSkill =
    team.players.reduce(
      (sum, player) =>
        sum +
        player.skill,
      0
    );


  const rated = team.players.filter(player => Number.isInteger(player.skill));
  team.knownSkillCount = rated.length;
  team.averageSkill = rated.length ? team.totalSkill / rated.length : null;

}

function teamAverageLabel(team) {
  const unknown = team.players.filter(player => !Number.isInteger(player.skill)).length;
  return `Avg ${team.averageSkill === null ? "—" : team.averageSkill.toFixed(1)}${unknown ? ` · ${unknown} unrated` : ""}`;
}



// ==================================================
// FIND TEAM
// ==================================================

function findTeam(
  teamId
) {

  if (
    !currentResult
  ) {

    return null;

  }


  return (
    currentResult.teams.find(
      team =>
        team.id ===
        teamId
    ) || null
  );

}



// ==================================================
// RESOLVE SWAP SELECTION
// ==================================================

function resolveSwapSelection(
  selection
) {

  if (
    !selection ||
    !currentResult
  ) {

    return null;

  }


  if (
    selection.location ===
    "rotation"
  ) {

    const index =
      currentResult.rotationPlayers
        .findIndex(
          player =>
            player.id ===
            selection.playerId
        );


    if (
      index === -1
    ) {

      return null;

    }


    return {

      location:
        "rotation",

      index,

      player:
        currentResult
          .rotationPlayers[index],

      team:
        null

    };

  }


  const team =
    findTeam(
      selection.teamId
    );


  if (
    !team
  ) {

    return null;

  }


  const index =
    team.players.findIndex(
      player =>
        player.id ===
        selection.playerId
    );


  if (
    index === -1
  ) {

    return null;

  }


  return {

    location:
      "team",

    index,

    player:
      team.players[index],

    team

  };

}



// ==================================================
// FORMATION SIGNATURE
// ==================================================

function resultSignature(
  result
) {

  const teams =
    result.teams
      .map(
        team =>
          team.players
            .map(
              player =>
                player.id
            )
            .sort()
            .join(",")
      )
      .sort();


  const rotation =
    result.rotationPlayers
      .map(
        player =>
          player.id
      )
      .sort();


  return JSON.stringify({

    format:
      result.plan.formatLabel,

    teams,

    rotation

  });

}



// ==================================================
// APPROVED SIGNATURES
// ==================================================

function approvedSignatureSet() {

  return new Set(
    approvedFormations.map(
      formation =>
        formation.signature
    )
  );

}



// ==================================================
// CREATE STORED FORMATION
// ==================================================

function createStoredFormation(
  result
) {

  return {

    substitutePlayerIds: result.teams.flatMap(team => team.substituteIds || []),
    rotationRoleIds: [...new Set(result.rotationPlayers.map(player => player.id)
      .concat(result.teams.flatMap(team => team.substituteIds || [])))],

    participants: result.teams.flatMap(team => team.players).concat(result.rotationPlayers)
      .map(player => ({ id: player.id, name: player.name })),

    round:
      currentRoundNumber,

    approvedAt:
      new Date()
        .toISOString(),

    signature:
      resultSignature(
        result
      ),

    format:
      result.plan.formatLabel,

    teams:
      result.teams.map(
        team =>
          team.players.map(
            player =>
              player.id
          )
      ),

    matchups: result.courtGames.map(matchupRecord),

    rotation:
      result.rotationPlayers.map(
        player =>
          player.id
      )

  };

}



// ==================================================
// SWAP STATUS
// ==================================================

function updateSwapStatus() {

  manualAdjustmentCard.classList.toggle(
    "approved",
    currentRoundApproved
  );


  if (
    currentRoundApproved
  ) {

    swapStatus.textContent =
      `Round ${currentRoundNumber} is approved. The formation is locked until the next remix.`;


    clearSwapButton.disabled =
      true;


    return;

  }


  if (
    lastSwapMessage
  ) {

    swapStatus.textContent =
      lastSwapMessage;


    clearSwapButton.disabled =
      !selectedSwapPlayer;


    return;

  }


  if (
    !selectedSwapPlayer
  ) {

    swapStatus.textContent =
      "Tap any player, then tap another player to swap them.";


    clearSwapButton.disabled =
      true;


    return;

  }


  const resolved =
    resolveSwapSelection(
      selectedSwapPlayer
    );


  if (
    !resolved
  ) {

    selectedSwapPlayer =
      null;


    swapStatus.textContent =
      "Tap any player, then tap another player to swap them.";


    clearSwapButton.disabled =
      true;


    return;

  }


  if (
    resolved.location ===
    "rotation"
  ) {

    swapStatus.textContent =
      `${resolved.player.name} selected from rotation. Now choose a player from a team.`;


    clearSwapButton.disabled =
      false;


    return;

  }


  swapStatus.textContent =
    `${resolved.player.name} selected. Choose a player from another team or from rotation.`;


  clearSwapButton.disabled =
    false;

}



// ==================================================
// CLEAR SWAP
// ==================================================

function clearSwapSelection() {

  selectedSwapPlayer =
    null;


  lastSwapMessage =
    "";


  if (
    currentResult
  ) {

    renderResult(
      currentResult,
      false
    );

  }

}



clearSwapButton
  .addEventListener(
    "click",
    clearSwapSelection
  );



// ==================================================
// MANUAL PLAYER SWAP
// ==================================================

function handlePlayerSwapClick(
  location,
  teamId,
  playerId
) {

  if (
    currentRoundApproved
  ) {

    return;

  }


  const targetSelection = {

    location,

    teamId:
      location === "team"
        ? teamId
        : null,

    playerId

  };


  const target =
    resolveSwapSelection(
      targetSelection
    );


  if (
    !target
  ) {

    return;

  }


  if (
    !selectedSwapPlayer
  ) {

    selectedSwapPlayer =
      targetSelection;


    lastSwapMessage =
      "";


    renderResult(
      currentResult,
      false
    );


    return;

  }


  const first =
    resolveSwapSelection(
      selectedSwapPlayer
    );


  if (
    !first
  ) {

    selectedSwapPlayer =
      targetSelection;


    renderResult(
      currentResult,
      false
    );


    return;

  }


  if (
    selectedSwapPlayer.location ===
      targetSelection.location &&
    selectedSwapPlayer.teamId ===
      targetSelection.teamId &&
    selectedSwapPlayer.playerId ===
      targetSelection.playerId
  ) {

    selectedSwapPlayer =
      null;


    lastSwapMessage =
      "";


    renderResult(
      currentResult,
      false
    );


    return;

  }


  if (
    first.location === "team" &&
    target.location === "team" &&
    first.team.id ===
      target.team.id
  ) {

    selectedSwapPlayer =
      targetSelection;


    lastSwapMessage =
      "";


    renderResult(
      currentResult,
      false
    );


    return;

  }


  if (
    first.location === "rotation" &&
    target.location === "rotation"
  ) {

    selectedSwapPlayer =
      targetSelection;


    lastSwapMessage =
      "";


    renderResult(
      currentResult,
      false
    );


    return;

  }


  const firstPlayer =
    first.player;


  const secondPlayer =
    target.player;

  if (currentResult.plan.categoryMatchupActive && (
      first.location === "team" && !playerCompatibleWithTeam(secondPlayer, first.team) ||
      target.location === "team" && !playerCompatibleWithTeam(firstPlayer, target.team))) {
    selectedSwapPlayer = null;
    lastSwapMessage = "Keep players in their selected category teams. Players in the mixed group can only swap within the mixed group.";
    renderResult(currentResult, false);
    return;
  }

  // Substitute status belongs to a roster slot when players are exchanged.
  const replaceSubstitute = (selection, outgoing, incoming) => {
    if (selection.location === "team") {
      selection.team.substituteIds = (selection.team.substituteIds || []).map(id => id === outgoing.id ? incoming.id : id);
    }
  };

  if (
    currentResult.plan.specialKidsCourt &&
    isKidsGroupPlayer(firstPlayer) !== isKidsGroupPlayer(secondPlayer)
  ) {
    selectedSwapPlayer = null;
    lastSwapMessage = "Kids can only be swapped with other Kids-group members while the separate Kids basket is active.";
    renderResult(currentResult, false);
    return;
  }

  if (
    currentResult.plan.adultOnlyActive &&
    (firstPlayer.category === "18+") !==
      (secondPlayer.category === "18+")
  ) {
    selectedSwapPlayer = null;
    lastSwapMessage =
      "18+ players can only be swapped with other 18+ players while adult-only games are active.";
    renderResult(currentResult, false);
    return;
  }


  if (
    first.location === "team" &&
    target.location === "team"
  ) {

    first.team.players[
      first.index
    ] =
      secondPlayer;


    target.team.players[
      target.index
    ] =
      firstPlayer;


    recalculateTeam(
      first.team
    );


    recalculateTeam(
      target.team
    );

  }


  else if (
    first.location === "team" &&
    target.location === "rotation"
  ) {

    first.team.players[
      first.index
    ] =
      secondPlayer;


    currentResult
      .rotationPlayers[
        target.index
      ] =
        firstPlayer;


    recalculateTeam(
      first.team
    );

  }


  else if (
    first.location === "rotation" &&
    target.location === "team"
  ) {

    currentResult
      .rotationPlayers[
        first.index
      ] =
        secondPlayer;


    target.team.players[
      target.index
    ] =
      firstPlayer;


    recalculateTeam(
      target.team
    );

  }


  replaceSubstitute(first, firstPlayer, secondPlayer);
  replaceSubstitute(target, secondPlayer, firstPlayer);
  lastSwapMessage =
    `Swapped ${firstPlayer.name} and ${secondPlayer.name}.`;


  selectedSwapPlayer =
    null;


  seenSuggestionSignatures.add(
    resultSignature(
      currentResult
    )
  );


  renderResult(
    currentResult,
    false
  );

}



// ==================================================
// RESULT CLICK
// ==================================================

resultsSection
  .addEventListener(
    "click",
    event => {

      const playerButton =
        event.target.closest(
          ".swappable-player"
        );


      if (
        !playerButton
      ) {

        return;

      }


      handlePlayerSwapClick(

        playerButton.dataset.location,

        playerButton.dataset.teamId || null,

        playerButton.dataset.playerId

      );

    }
  );



// ==================================================
// SEARCH DEPTH FOR ALTERNATIVES
// ==================================================

function alternativeSearchAttemptLimit(
  selectedPlayers
) {

  const profileCount =
    new Set(
      selectedPlayers.map(
        player =>
          `${player.category}|${player.skill}`
      )
    ).size;


  const calculated =
    6 +
    Math.floor(
      selectedPlayers.length / 4
    ) +
    Math.floor(
      profileCount / 2
    );


  return Math.max(
    8,
    Math.min(
      14,
      calculated
    )
  );

}



// ==================================================
// PRESENT PLAYERS
// ==================================================

function getPresentPlayers() {

  return players.filter(
    player =>
      presentPlayerIds.has(
        player.id
      )
  );

}



// ==================================================
// BROWSER PAINT
// ==================================================

function allowBrowserToPaint() {

  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        0
      )
  );

}



// ==================================================
// GENERATE INITIAL ROUND SUGGESTION
// ==================================================

async function generateInitialSuggestion(
  selectedPlayers,
  formatPreference
) {

  const previousSignatures =
    approvedSignatureSet();


  const attemptLimit =
    alternativeSearchAttemptLimit(
      selectedPlayers
    );


  let firstCandidate =
    null;


  let selectedCandidate =
    null;


  for (
    let attempt = 0;
    attempt < attemptLimit;
    attempt++
  ) {

    const candidate =
      TeamOptimizer.generate(
        selectedPlayers,
        courts,
        formatPreference,
        approvedFormations,
        adultOnlyOptions()
      );


    if (
      !firstCandidate
    ) {

      firstCandidate =
        candidate;

    }


    const signature =
      resultSignature(
        candidate
      );


    if (
      !previousSignatures.has(
        signature
      )
    ) {

      selectedCandidate =
        candidate;


      break;

    }


    if (
      (attempt + 1) % 4 === 0
    ) {

      await allowBrowserToPaint();

    }

  }


  if (
    selectedCandidate
  ) {

    currentRepeatNotice =
      false;


    return selectedCandidate;

  }


  currentRepeatNotice =
    approvedFormations.length > 0;


  return firstCandidate;

}



// ==================================================
// GENERATE TEAMS
// ==================================================

async function generateTeams(
  alternative = false
) {
  selectedMoveTeamId = null;

  if (!await prepareKidsCourt()) return;

  const selectedPlayers =
    getPresentPlayers();


  if (
    selectedPlayers.length < 6
  ) {

    alert(
      "Select at least 6 players."
    );


    return;

  }


  const formatPreference =
    document
      .getElementById(
        "gameFormat"
      )
      .value;


  try {

    selectedSwapPlayer =
      null;


    lastSwapMessage =
      "";


    if (
      !alternative
    ) {
      if (currentResult && currentRoundApproved && !window.confirm("Create new teams from everyone currently present? Record any completed game first. The current court layout will be replaced.")) return;

      currentRoundNumber =
        approvedFormations.length +
        1;


      currentRoundApproved =
        false;


      resetAlternativeHistory();


      const result =
        await generateInitialSuggestion(
          selectedPlayers,
          formatPreference
        );


      if (
        !result
      ) {

        throw new Error(
          "Could not generate teams."
        );

      }


      suggestionNumber =
        1;


      seenSuggestionSignatures.add(
        resultSignature(
          result
        )
      );


      renderResult(
        result
      );


      if (
        currentRepeatNotice
      ) {

        setTimeout(
          () => {

            alert(
              "A completely unused formation could not be found for this round. Some repetition from earlier rounds may be unavoidable with the current participants."
            );

          },
          100
        );

      }


      return;

    }


    if (
      !currentResult ||
      currentRoundApproved
    ) {

      return;

    }


    if (
      alternativesExhausted
    ) {

      alert(
        "No more meaningful unused alternatives could be found for the current players and settings."
      );


      return;

    }


    alternativeButton.disabled =
      true;


    alternativeButton.textContent =
      "Searching…";


    await allowBrowserToPaint();


    const attemptLimit =
      alternativeSearchAttemptLimit(
        selectedPlayers
      );


    const previousApproved =
      approvedSignatureSet();


    let foundResult =
      null;


    let foundSignature =
      null;


    for (
      let attempt = 0;
      attempt < attemptLimit;
      attempt++
    ) {

      const candidate =
        TeamOptimizer.generate(
          selectedPlayers,
          courts,
          formatPreference,
          approvedFormations,
          adultOnlyOptions()
        );


      const signature =
        resultSignature(
          candidate
        );


      if (
        !seenSuggestionSignatures.has(
          signature
        ) &&
        !previousApproved.has(
          signature
        )
      ) {

        foundResult =
          candidate;


        foundSignature =
          signature;


        break;

      }


      if (
        (attempt + 1) % 4 === 0
      ) {

        await allowBrowserToPaint();

      }

    }


    if (
      foundResult
    ) {

      suggestionNumber++;


      seenSuggestionSignatures.add(
        foundSignature
      );


      currentRepeatNotice =
        false;


      renderResult(
        foundResult
      );


      return;

    }


    alternativesExhausted =
      true;


    updateRoundControls();


    alert(
      "No more meaningful unused alternatives could be found for this round.\n\nThe available balanced variations are limited by the number of participants, their age categories and skill levels."
    );

  }

  catch (error) {

    updateRoundControls();


    alert(
      error.message
    );


    console.error(
      error
    );

  }

}



// ==================================================
// APPROVE FORMATION
// ==================================================

function approveCurrentFormation() {

  if (
    !currentResult ||
    currentRoundApproved
  ) {

    return;

  }


  const confirmed =
    window.confirm(
      `Use this formation for Round ${currentRoundNumber}?`
    );


  if (
    !confirmed
  ) {

    return;

  }


  const stored =
    createStoredFormation(
      currentResult
    );


  approvedFormations.push(
    stored
  );


  currentRoundApproved =
    true;

  currentResult.courtGames.forEach((game, index) => { game.historyIndex = index; });
  startScheduledGames();
  saveEveningSession();


  selectedSwapPlayer =
    null;


  lastSwapMessage =
    "";


  renderResult(
    currentResult,
    false
  );

}



// ==================================================
// RESET / REMIX NEXT ROUND
// ==================================================

async function remixForNextRound() {

  if (
    !currentRoundApproved
  ) {

    return;

  }


  await generateTeams(
    false
  );

}



// ==================================================
// ROUND BUTTONS
// ==================================================

document
  .getElementById(
    "generateButton"
  )
  .addEventListener(
    "click",
    () => {

      generateTeams(
        false
      );

    }
  );



alternativeButton
  .addEventListener(
    "click",
    () => {

      generateTeams(
        true
      );

    }
  );



approveFormationButton
  .addEventListener(
    "click",
    approveCurrentFormation
  );



remixButton
  .addEventListener(
    "click",
    remixForNextRound
  );



// ==================================================
// ROUND CONTROL UI
// ==================================================

function updateRoundControls() {
  updateCompletionControls();
  document.getElementById("editNextAttendance").hidden = !currentRoundApproved;

  if (
    !currentResult
  ) {

    return;

  }


  if (
    currentRoundApproved
  ) {

    alternativeButton.disabled =
      true;


    alternativeButton.textContent =
      "🔀 Alternative teams";


    approveFormationButton.disabled =
      true;


    approveFormationButton.textContent =
      "✓ Formation approved";


    remixButton.hidden =
      false;


    roundActionHelp.textContent =
      `Formation ${currentRoundNumber} is approved. Select each court's winner and confirm completion, then preview championship games or reset & remix.`;


    return;

  }


  remixButton.hidden =
    true;


  approveFormationButton.disabled =
    false;


  approveFormationButton.textContent =
    "✅ Use this formation";


  if (
    alternativesExhausted
  ) {

    alternativeButton.disabled =
      true;


    alternativeButton.textContent =
      "✓ No more alternatives";

  }

  else {

    alternativeButton.disabled =
      false;


    alternativeButton.textContent =
      `🔀 Find alternative #${suggestionNumber + 1}`;

  }


  roundActionHelp.textContent =
    "Review the teams, make any swaps, then approve the formation that will actually be used.";

}



// ==================================================
// RENDER RESULT
// ==================================================



function renderResult(
  result,
  shouldScroll = true
) {

  currentResult =
    result;
  document.getElementById("teamsEmpty").hidden = true;
  document.getElementById("appendSchedule").disabled = false;
  if (shouldScroll) showPanel("teams");
  renderAutomaticSchedule();

  // Retain the old field for saved-session/report compatibility. Moving teams
  // is now standard, including when an older session saved this as false.
  result.championshipMode = true;
  cancelTeamMove.hidden = !selectedMoveTeamId;
  teamMoveStatus.textContent = selectedMoveTeamId
    ? `${findTeam(selectedMoveTeamId)?.name || "Team"} selected. Now select the team to exchange it with, on court or waiting.`
    : "Use Move team on two compatible teams to exchange their positions. Record games before moving teams.";


  const plan =
    result.plan;


  const formatText =
    plan.formatLabel ||
    (
      plan.teamSize
        ? `${plan.teamSize} vs ${plan.teamSize}`
        : "Mixed format"
    );

  const assignedSubstitutes = result.teams.reduce((sum, team) => sum + (team.substituteIds?.length || 0), 0);
  const autoRotationNote = document.getElementById("gameFormat").value === "auto" && assignedSubstitutes
    ? `<div class="recommendation-note">${assignedSubstitutes} ${assignedSubstitutes === 1 ? "player assigned" : "players assigned"} to teams as substitutes for in-game rotation. You can return a substitute to rotation and assign them to another team. Substitute roles are shared across mixes when possible.</div>`
    : "";


  let specialNote =
    "";


  if (
    plan.specialKidsCourt
  ) {

    specialNote = `

      <div class="recommendation-note">

        One basket reserved for the selected Kids group as 3v3.
        U14 helpers and temporary Dunkers stay in this group. Extra group members wait or rotate within the group.

      </div>

    `;

  }


  let historyNote =
    "";

  const adultOnlyNote = plan.categoryMatchupActive
    ? `<div class="recommendation-note">${(plan.categoryMatchups?.length?plan.categoryMatchups:[{...plan.categoryMatchup,courtsUsed:plan.categoryCourtsUsed}]).map(rule=>`${escapeHtml(rule.category1)} vs ${escapeHtml(rule.category2)} · ${rule.courtsUsed} ${rule.courtsUsed===1?"basket":"baskets"}`).join("<br>")}<br>Everyone else is mixed.</div>`
    : plan.adultOnlyActive
    ? `<div class="recommendation-note">18+ only vs 18+ · ${plan.adultCourtsUsed} adult ${plan.adultCourtsUsed === 1 ? "basket" : "baskets"} used.</div>`
    : "";


  if (
    currentRepeatNotice
  ) {

    historyNote = `

      <div class="history-warning">

        Some repetition from earlier approved rounds may be unavoidable.

      </div>

    `;

  }


  const approvedNote =
    currentRoundApproved
      ? `

        <div class="approved-formation-note">

          ✓ This is the formation recorded as used for Round ${currentRoundNumber}.

        </div>

      `
      : "";


  document
    .getElementById(
      "recommendation"
    )
    .innerHTML = `

      <div class="recommendation-heading-row">

        <div class="recommendation-title">

          Recommended:
          <strong>
            ${escapeHtml(formatText)}
          </strong>

        </div>


        <div class="round-suggestion-badge">

          Round ${currentRoundNumber}
          ·
          Suggestion #${suggestionNumber}

        </div>

      </div>


      <div class="recommendation-grid">

        <div>

          <strong>
            ${plan.completeTeams}
          </strong>

          <span>
            teams
          </span>

        </div>


        <div>

          <strong>
            ${plan.playableCourts}
          </strong>

          <span>
            courts used
          </span>

        </div>


        <div>

          <strong>
            ${plan.waitingTeams}
          </strong>

          <span>
            waiting teams
          </span>

        </div>


        <div>

          <strong>
            ${plan.individualRotation}
          </strong>

          <span>
            unassigned rotating players
          </span>

        </div>

      </div>

      ${specialNote}

      ${autoRotationNote}

      ${adultOnlyNote}
      ${plan.categoryNotice ? `<div class="history-warning">${escapeHtml(plan.categoryNotice)}</div>` : ""}
      <div class="recommendation-note">Players with fewer completed games are prioritized for court places within each compatible group. Capacity and selected category rules can still require some players to wait.</div>

      ${historyNote}

      ${approvedNote}

    `;



  // ==================================================
  // COURTS
  // ==================================================

  const courtResults =
    document.getElementById(
      "courtResults"
    );


  courtResults.innerHTML =
    "";


  result.courtGames.forEach(
    game => {

      const court =
        document.createElement(
          "section"
        );


      court.className =
        "card court-card";


      const format =
        `${game.teamSize}v${game.teamSize}`;


      const kidsLabel =
        game.specialKidsCourt
          ? " · Kids"
          : game.categoryMatchup ? ` · ${escapeHtml(game.category1)} vs ${escapeHtml(game.category2)}`
          : game.adultOnly
            ? " · 18+"
            : "";


      court.innerHTML = `

        <h2>
          Court ${game.court}
          · ${format}${kidsLabel}
        </h2>

        ${currentRoundApproved ? `<div class="court-winner">
          <label for="winnerCourt${game.court}">Winner — Court ${game.court}</label>
          <select id="winnerCourt${game.court}" data-court-winner="${game.court}" ${pendingGameCompletion() ? "disabled" : ""}>
            <option value="">Select winner when the game ends</option>
            ${[game.team1, game.team2].map(team => `<option value="${escapeHtml(team.id)}" ${game.winnerTeamId === team.id ? "selected" : ""}>${escapeHtml(team.name)}</option>`).join("")}
          </select>
          ${pendingGameCompletion() ? '<span class="setting-help">Winner recorded in Schedule. Undo last completion to correct it.</span>' : ""}
        </div>` : '<p class="setting-help">Approve this formation to select the winner.</p>'}

        <div class="matchup">

          ${teamCard(
            game.team1
          )}

          <div class="versus">
            VS
          </div>

          ${teamCard(
            game.team2
          )}

        </div>

      `;


      courtResults.appendChild(
        court
      );

    }
  );



  // ==================================================
  // WAITING TEAMS
  // ==================================================

  const waitingSection =
    document.getElementById(
      "waitingSection"
    );


  const waitingTitle =
    document.getElementById(
      "waitingTitle"
    );


  const waitingTeams =
    document.getElementById(
      "waitingTeams"
    );


  if (
    result.waitingTeams.length > 0
  ) {

    waitingSection.hidden =
      false;


    waitingTitle.textContent =
      "Waiting teams — choose manually";


    waitingTeams.innerHTML =
      result.waitingTeams
        .map(
          teamCard
        )
        .join("");

  }

  else {

    waitingSection.hidden =
      true;

  }



  // ==================================================
  // ROTATION PLAYERS
  // ==================================================

  const rotationSection =
    document.getElementById(
      "rotationSection"
    );


  const rotationPlayers =
    document.getElementById(
      "rotationPlayers"
    );


  if (
    result.rotationPlayers.length > 0
  ) {

    rotationSection.hidden =
      false;


    rotationPlayers.innerHTML =
      result.rotationPlayers
        .map(
          rotationPlayerRow
        )
        .join("");

  }

  else {

    rotationSection.hidden =
      true;

  }


  resultsSection.hidden =
    false;


  updateSwapStatus();

  updateRoundControls();

  renderEveningHistoryStatus();

  updateNewSessionButtonState();


  if (
    shouldScroll
  ) {

    resultsSection.scrollIntoView({

      behavior:
        "smooth",

      block:
        "start"

    });

  }

}



// ==================================================
// START APPLICATION
// ==================================================

loadEveningSession();
renderAutomaticSchedule();

loadPlayers();
