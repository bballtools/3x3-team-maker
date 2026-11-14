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
  "bballtools_3x3_local_players_v1";


const EVENING_SESSION_KEY =
  "bballtools_3x3_evening_session_v1";



// ==================================================
// GLOBAL STATE
// ==================================================

let masterPlayers = [];

let localPlayers = [];

let players = [];


let courts = 2;

const adultOnlyMode =
  document.getElementById("adultOnlyMode");

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


let quickAddSkill = 3;


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

function skillBasketballs(
  skill
) {

  const balls = [];


  for (
    let level = 1;
    level <= 5;
    level++
  ) {

    balls.push(`

      <span
        class="skill-ball ${level <= skill ? "active" : "inactive"}"
        aria-hidden="true"
      >
        🏀
      </span>

    `);

  }


  return `

    <span
      class="skill-rating"
      aria-label="Skill ${skill} out of 5"
      title="Skill ${skill} out of 5"
    >
      ${balls.join("")}
    </span>

  `;

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
    presentPlayerIds.size > 0 ||
    currentResult !== null;


  startNewSessionButton.disabled =
    !hasSessionState;

}



// ==================================================
// EVENING SESSION HISTORY
// ==================================================

function loadEveningSession() {

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


    const stored =
      JSON.parse(
        raw
      );


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


    currentRoundNumber =
      approvedFormations.length +
      1;

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
      currentRoundApproved = true;
      currentResult.championshipMode = true;
      presentPlayerIds = new Set(currentResult.teams.flatMap(team => team.players)
        .concat(currentResult.rotationPlayers).map(player => player.id));
      courts = active.settings.availableBaskets;
      courtCount.textContent = courts;
      document.getElementById("gameFormat").value = active.settings.requestedFormat;
      kidsOnlyMode.checked = active.settings.kidsOnly;
      adultOnlyMode.checked = active.settings.adultOnly;
      adultCourtMaximum.value = String(active.settings.maxAdultCourts);
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

    currentRoundNumber =
      1;


    renderEveningHistoryStatus();

  }

}



function saveEveningSession() {

  const data = {

    date:
      getTodayKey(),

    approvedFormations,
    activeFormation: currentResult && currentRoundApproved ? {
      round: currentRoundNumber,
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
  document.getElementById("completeAllGames").disabled = !approved;
  document.getElementById("undoLastCompletion").disabled = !latestCompletion();
  const completed = (currentStoredFormation()?.completions || []).filter(completion => !completion.undone).length;
  document.getElementById("gameCompletionStatus").textContent = approved
    ? `${completed} shared ${completed === 1 ? "game" : "games"} completed with this formation. Each click counts all teams on court, including substitutes. Waiting teams do not receive a game.`
    : "Approve the formation to record completed games for all courts.";
}

function completeAllGames() {
  const formation = currentStoredFormation();
  if (!formation || !currentResult.courtGames.length) return;
  syncCurrentMatchups();
  const matchupIndices = currentResult.courtGames.map(game => game.historyIndex);
  if (new Set(matchupIndices).size !== matchupIndices.length ||
      matchupIndices.some(index => !Number.isInteger(index) || !formation.matchups[index])) return;
  matchupIndices.forEach(index => { formation.matchups[index].gamesPlayed = GameCounter.count(formation.matchups[index]) + 1; });
  (formation.completions ||= []).push({ completedAt: new Date().toISOString(), matchupIndices });
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
  saveEveningSession();
  if (currentResult) renderResult(currentResult, false);
}

document.getElementById("completeAllGames").addEventListener("click", completeAllGames);
document.getElementById("undoLastCompletion").addEventListener("click", undoLastCompletion);

function renderGameCounter() {
  const panel = document.getElementById("gameCounterPanel");
  if (!panel) return;
  const historyOpen = panel.querySelector("details")?.open || false;
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
  panel.innerHTML = `<h2>Games played</h2>
    <p>Use Game completed in Round controls once when all courts finish. All team members on court, including substitutes, receive a game. Waiting teams do not. Counts follow players when teams are remixed.</p>
    <div class="participation-list">${entries.map(entry => `<span class="participation-player${presentPlayerIds.has(entry.id) && entry.count < highest ? " fewer-games" : ""}">${escapeHtml(entry.name)}: <strong>${entry.count}</strong>${presentPlayerIds.has(entry.id) && entry.count < highest ? " · fewer games" : ""}</span>`).join("")}</div>
    <details ${historyOpen ? "open" : ""}><summary>Completed-game history</summary>
    <p>Team letters refer to that formation only. Previous per-court counts are preserved. Undo last completion reverses the most recent shared completion, including after team moves.</p>
    ${approvedFormations.map((formation, roundIndex) => (formation.matchups || []).map((game, gameIndex) =>
      `<div class="game-history-row"><strong>Round ${escapeHtml(String(formation.round))} · Court ${escapeHtml(String(game.court || gameIndex + 1))} · ${escapeHtml(game.team1Name || "Team 1")} vs ${escapeHtml(game.team2Name || "Team 2")}</strong><p>${GameCounter.count(game)} completed</p></div>`).join("")).join("")}</details>`;
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

  const hasSessionState =
    approvedFormations.length > 0 ||
    presentPlayerIds.size > 0 ||
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


  approvedFormations =
    [];

  selectedMoveTeamId = null;


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

    const raw =
      localStorage.getItem(
        LOCAL_PLAYERS_KEY
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
          player.skill <= 5
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

    ...localPlayers

  ];

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
            player.source ===
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
                  ${escapeHtml(player.category)}
                </div>

              </label>


              <label
                class="skill"
                for="${escapeHtml(checkboxId)}"
              >

                ${skillBasketballs(
                  player.skill
                )}

              </label>


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

  const visiblePlayers =
    getVisiblePlayers();


  playerSummary.textContent =
    `${presentPlayerIds.size} of ${players.length} players present · ${visiblePlayers.length} ${playerSearch.value.trim() ? (visiblePlayers.length === 1 ? "match" : "matches") : "shown"}`;


  updateSelectAllButton();

  updateNewSessionButtonState();

  updateAdultOnlySettings();

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


      invalidateResults();


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


      invalidateResults();


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
    3;


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


  invalidateResults();


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

function updateAdultOnlySettings() {
  const kidsCount = getPresentPlayers().filter(player => player.category === "Kids").length;
  const kidsBasketReserved = kidsOnlyMode.checked && kidsCount >= 6;
  kidsOnlyStatus.textContent = !kidsOnlyMode.checked
    ? "Off: Kids are mixed into regular teams. Requires at least 6 selected Kids for a separate 3v3 basket."
    : kidsCount < 6
      ? `${kidsCount} selected Kids. At least 6 are needed for Kids-only 3v3; Kids will be mixed until then.`
      : `One basket reserved for Kids-only 3v3. Extra Kids wait or rotate within the Kids group.${courts === 1 ? " Other teams will wait because no basket remains." : ""}`;
  const previousMaximum =
    Number(adultCourtMaximum.value) || 1;

  const adultCount = getPresentPlayers().filter(
    player => player.category === "18+"
  ).length;

  const formatPreference =
    document.getElementById("gameFormat").value;

  const adultPreference =
    formatPreference === "4" && adultCount < 8
      ? "3"
      : formatPreference;

  const usableAdultCourts = adultCount >= 6
    ? TeamOptimizer.choosePlan(
        adultCount,
        Math.max(0, courts - (kidsBasketReserved ? 1 : 0)),
        adultPreference
      ).playableCourts
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

  adultCourtSetting.hidden = !adultOnlyMode.checked;

  adultOnlyStatus.hidden =
    !adultOnlyMode.checked || adultCount >= 6;

  adultOnlyStatus.textContent =
    `${adultCount} selected 18+ players. At least 6 are needed; normal mixing applies until then.`;
}

function adultOnlyOptions() {
  return {
    kidsOnly: kidsOnlyMode.checked,
    adultOnly: adultOnlyMode.checked,
    maxAdultCourts: Number(adultCourtMaximum.value) || 1
  };
}

adultOnlyMode.addEventListener("change", () => {
  updateAdultOnlySettings();
  invalidateResults();
});

adultCourtMaximum.addEventListener("change", invalidateResults);

kidsOnlyMode.addEventListener("change", () => {
  updateAdultOnlySettings();
  invalidateResults();
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

function invalidateResults() {
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
  if (currentResult.plan.specialKidsCourt && team.players.every(player => player.category === "Kids")) return "Kids";
  if (currentResult.plan.adultOnlyActive && team.players.every(player => player.category === "18+")) return "18+";
  return "regular";
}

function canAssignSubstitute(player, team) {
  if (team.players.length >= team.teamSize + 1) return false;
  if (currentResult.plan.specialKidsCourt && (player.category === "Kids") !== (teamGroup(team) === "Kids")) return false;
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
    teamMoveStatus.textContent = "Choose a team from the same group and game format. Kids-only and adult-only groups stay separate.";
    return;
  }
  const firstOnCourt = currentResult.courtGames.some(game => game.team1.id === first.id || game.team2.id === first.id);
  const secondOnCourt = currentResult.courtGames.some(game => game.team1.id === second.id || game.team2.id === second.id);
  if (!firstOnCourt && !secondOnCourt) {
    teamMoveStatus.textContent = "Select a team on court to exchange with this waiting team.";
    return;
  }
  const replace = team => team.id === first.id ? second : team.id === second.id ? first : team;
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
          ${escapeHtml(player.category)}
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
          Avg ${team.averageSkill.toFixed(1)}
        </span>

      </div>

      ${playersHtml}

      <p class="team-games">${team.teamSize} on court${team.substituteIds?.length ? " + 1 substitute" : ""} · Team: ${teamGames} games this formation · This lineup: ${lineupGames} games · Players: ${minimum === maximum ? minimum : `${minimum}–${maximum}`} games each</p>
      <button type="button" class="secondary move-team-button" data-move-team="${escapeHtml(team.id)}" aria-pressed="${selectedMoveTeamId === team.id}">${selectedMoveTeamId === team.id ? "Selected — cancel" : selectedMoveTeamId ? "Exchange with selected team" : "Move team"}</button>
      <div class="substitute-controls">${substituteControls}</div>

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
          ${escapeHtml(player.category)}
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
        ${eligible.map(team => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)} · Avg ${team.averageSkill.toFixed(1)}</option>`).join("")}
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


  team.averageSkill =
    team.totalSkill /
    team.players.length;

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

  // Substitute status belongs to a roster slot when players are exchanged.
  const replaceSubstitute = (selection, outgoing, incoming) => {
    if (selection.location === "team") {
      selection.team.substituteIds = (selection.team.substituteIds || []).map(id => id === outgoing.id ? incoming.id : id);
    }
  };

  if (
    currentResult.plan.specialKidsCourt &&
    (firstPlayer.category === "Kids") !== (secondPlayer.category === "Kids")
  ) {
    selectedSwapPlayer = null;
    lastSwapMessage = "Kids can only be swapped with other Kids while the Kids-only basket is active.";
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


  currentRoundNumber =
    approvedFormations.length +
    1;


  currentRoundApproved =
    false;


  resetAlternativeHistory();


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
      `Formation ${currentRoundNumber} is approved. Record each game, then move teams manually. Reset & remix creates entirely new teams.`;


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

        One basket reserved for Kids-only 3v3.
        Extra Kids wait or rotate within the Kids group.

      </div>

    `;

  }


  let historyNote =
    "";

  const adultOnlyNote = plan.adultOnlyActive
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
          : game.adultOnly
            ? " · 18+"
            : "";


      court.innerHTML = `

        <h2>
          Court ${game.court}
          · ${format}${kidsLabel}
        </h2>

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

loadPlayers();
