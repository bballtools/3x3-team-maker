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

let activeCategory =
  "All";


let presentPlayerIds =
  new Set();


let quickAddSkill = 3;


let currentResult = null;

let selectedSwapPlayer = null;

let lastSwapMessage = "";


/*
  Approved formations are the ONLY formations
  considered to have actually been used.
*/

let approvedFormations = [];


/*
  Round numbering is separate from suggestion
  numbering.

  Round 1:
    Suggestion #1
    Suggestion #2
    ...

  Approve

  Round 2:
    Suggestion #1
    ...
*/

let currentRoundNumber = 1;

let suggestionNumber = 0;

let currentRoundApproved = false;

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


    /*
      History automatically starts fresh
      on a new calendar day.
    */

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


    renderEveningHistoryStatus();

  }

  catch (error) {

    console.error(
      "Could not load evening history.",
      error
    );


    approvedFormations = [];

    currentRoundNumber =
      1;


    renderEveningHistoryStatus();

  }

}



function saveEveningSession() {

  const data = {

    date:
      getTodayKey(),

    approvedFormations

  };


  localStorage.setItem(

    EVENING_SESSION_KEY,

    JSON.stringify(
      data
    )

  );


  renderEveningHistoryStatus();

}



function renderEveningHistoryStatus() {

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
      "No approved rounds yet today.";


    return;

  }


  if (
    count === 1
  ) {

    eveningHistoryStatus.textContent =
      "1 approved round remembered today.";


    return;

  }


  eveningHistoryStatus.textContent =
    `${count} approved rounds remembered today.`;

}



// ==================================================
// PLAYER NORMALIZATION
// ==================================================

function normalizeName(name) {

  return String(name)
    .trim()
    .toLocaleLowerCase()
    .replace(
      /\s+/g,
      " "
    );

}



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

  if (
    activeCategory ===
    "All"
  ) {

    return sortPlayersByName(
      players
    );

  }


  return sortPlayersByName(
    players.filter(
      player =>
        player.category ===
        activeCategory
    )
  );

}



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

                ${
                  "★".repeat(
                    player.skill
                  ) +
                  "☆".repeat(
                    5 -
                    player.skill
                  )
                }

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
        No players in this category yet.
      </div>

    `;

  }

}



// ==================================================
// PLAYER SUMMARY
// ==================================================

function updatePlayerSummary() {

  const visiblePlayers =
    getVisiblePlayers();


  playerSummary.textContent =
    `${presentPlayerIds.size} of ${players.length} players present · ${visiblePlayers.length} shown`;


  updateSelectAllButton();

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

  const name =
    newPlayerName.value
      .trim()
      .replace(
        /\s+/g,
        " "
      );


  if (
    !name
  ) {

    alert(
      "Enter the player's name."
    );


    newPlayerName.focus();


    return;

  }


  const category =
    activeCategory ===
    "All"
      ? newPlayerCategory.value
      : activeCategory;


  const existing =
    players.find(
      player =>
        rosterKey(
          player
        ) ===
        rosterKey({

          name,

          category

        })
    );


  if (
    existing
  ) {

    presentPlayerIds.add(
      existing.id
    );


    alert(
      `${existing.name} already exists in ${existing.category} and has been marked present.`
    );


    closeQuickAddForm();


    renderPlayerInterface();


    return;

  }


  const player = {

    id:
      `L_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 7)}`,

    name,

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
    invalidateResults
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

}



// ==================================================
// DISPLAY HELPERS
// ==================================================

function stars(skill) {

  return (
    "★".repeat(skill) +
    "☆".repeat(
      5 -
      skill
    )
  );

}



function playerRow(
  player,
  teamId
) {

  const selected =
    selectedSwapPlayer &&
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
      class="result-player swap-player${selected ? " selected-swap-player" : ""}${currentRoundApproved ? " locked-player" : ""}"
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

      </span>

      <span class="result-skill">
        ${stars(
          player.skill
        )}
      </span>

    </button>

  `;

}



function teamCard(team) {

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

    <div class="team-card">

      <div class="team-header">

        <strong>
          ${escapeHtml(team.name)}
        </strong>

        <span>
          Avg ${team.averageSkill.toFixed(1)}
        </span>

      </div>

      ${playersHtml}

    </div>

  `;

}



function rotationPlayerRow(
  player
) {

  return `

    <div class="result-player rotation-player">

      <span class="result-player-left">

        <strong>
          ${escapeHtml(player.name)}
        </strong>

        <span class="category">
          ${escapeHtml(player.category)}
        </span>

      </span>

      <span class="result-skill">
        ${stars(
          player.skill
        )}
      </span>

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
// FORMATION SIGNATURE
// ==================================================

function resultSignature(
  result
) {

  /*
    "Formation" means team composition.

    Changing:
    - court number
    - Team A / Team B order
    - which side of VS

    does NOT create a new formation.
  */

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

    matchups:
      result.courtGames.map(
        game => ({

          team1:
            game.team1.players.map(
              player =>
                player.id
            ),

          team2:
            game.team2.players.map(
              player =>
                player.id
            )

        })
      ),

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
      "Tap a player, then tap a player from another team to swap them.";


    clearSwapButton.disabled =
      true;


    return;

  }


  const team =
    findTeam(
      selectedSwapPlayer.teamId
    );


  const player =
    team
      ? team.players.find(
          item =>
            item.id ===
            selectedSwapPlayer.playerId
        )
      : null;


  if (
    player
  ) {

    swapStatus.textContent =
      `${player.name} selected. Now choose a player from another team.`;


    clearSwapButton.disabled =
      false;

  }

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
  teamId,
  playerId
) {

  if (
    currentRoundApproved
  ) {

    return;

  }


  const team =
    findTeam(
      teamId
    );


  if (
    !team
  ) {

    return;

  }


  const player =
    team.players.find(
      item =>
        item.id ===
        playerId
    );


  if (
    !player
  ) {

    return;

  }


  if (
    !selectedSwapPlayer
  ) {

    selectedSwapPlayer = {

      teamId,

      playerId

    };


    lastSwapMessage =
      "";


    renderResult(
      currentResult,
      false
    );


    return;

  }


  if (
    selectedSwapPlayer.teamId ===
      teamId &&
    selectedSwapPlayer.playerId ===
      playerId
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
    selectedSwapPlayer.teamId ===
      teamId
  ) {

    selectedSwapPlayer = {

      teamId,

      playerId

    };


    lastSwapMessage =
      "";


    renderResult(
      currentResult,
      false
    );


    return;

  }


  const firstTeam =
    findTeam(
      selectedSwapPlayer.teamId
    );


  const secondTeam =
    team;


  if (
    !firstTeam ||
    !secondTeam
  ) {

    return;

  }


  const firstIndex =
    firstTeam.players.findIndex(
      item =>
        item.id ===
        selectedSwapPlayer.playerId
    );


  const secondIndex =
    secondTeam.players.findIndex(
      item =>
        item.id ===
        playerId
    );


  if (
    firstIndex === -1 ||
    secondIndex === -1
  ) {

    return;

  }


  const firstPlayer =
    firstTeam.players[
      firstIndex
    ];


  const secondPlayer =
    secondTeam.players[
      secondIndex
    ];


  firstTeam.players[
    firstIndex
  ] =
    secondPlayer;


  secondTeam.players[
    secondIndex
  ] =
    firstPlayer;


  recalculateTeam(
    firstTeam
  );


  recalculateTeam(
    secondTeam
  );


  lastSwapMessage =
    `Swapped ${firstPlayer.name} and ${secondPlayer.name}.`;


  selectedSwapPlayer =
    null;


  /*
    Remember the manually adjusted result as one
    of the suggestions already seen this round.
  */

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
          ".swap-player"
        );


      if (
        !playerButton
      ) {

        return;

      }


      handlePlayerSwapClick(

        playerButton.dataset.teamId,

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


  /*
    Try to start the new round with a formation
    that has not previously been approved today.
  */

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
        approvedFormations
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


  /*
    If every high-quality result we found has
    already been used, repetition is probably
    unavoidable for this participant mix.
  */

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


    // ==================================================
    // FIRST SUGGESTION OF ROUND
    // ==================================================

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



    // ==================================================
    // ALTERNATIVE INSIDE CURRENT ROUND
    // ==================================================

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
          approvedFormations
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


  saveEveningSession();


  currentRoundApproved =
    true;


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
      `Round ${currentRoundNumber} is recorded as used. After the games, reset and remix for the next round.`;


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


  const plan =
    result.plan;


  const formatText =
    plan.formatLabel ||
    (
      plan.teamSize
        ? `${plan.teamSize} vs ${plan.teamSize}`
        : "Mixed format"
    );


  let specialNote =
    "";


  if (
    plan.specialKidsCourt
  ) {

    specialNote = `

      <div class="recommendation-note">

        Kids court reserved as 3v3.
        Younger players are added where needed.

      </div>

    `;

  }


  let historyNote =
    "";


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
            rotating players
          </span>

        </div>

      </div>

      ${specialNote}

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
      result.waitingTeams.length === 1
        ? "Next team"
        : "Next teams";


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
