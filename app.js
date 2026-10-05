// ==================================================
// GLOBAL STATE
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
// CENTRAL + LOCAL ROSTER MERGE
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


  /*
    If Igor has meanwhile added a local
    newcomer to players.json, remove the
    temporary local copy automatically.
  */

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
// LOAD MASTER PLAYERS
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
// SORTING
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
// FILTERED PLAYERS
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
// SELECT ALL / CLEAR VISIBLE
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
// ATTENDANCE CHANGES + DELETE
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


      const playerId =
        deleteButton.dataset
          .deletePlayerId;


      deleteLocalPlayer(
        playerId
      );

    }
  );



// ==================================================
// DELETE LOCAL PLAYER
// ==================================================

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
// QUICK ADD FORM
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



// ==================================================
// OPEN / CLOSE QUICK ADD
// ==================================================

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
    () => {

      closeQuickAddForm();

    }
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
// CREATE LOCAL PLAYER
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

    /*
      Useful courtside behavior:
      if someone tries to add an existing
      player, simply mark them present.
    */

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


  /*
    A player added courtside is almost
    certainly present today.
  */

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



// ==================================================
// COPY NEWCOMER LIST
// ==================================================

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
                b.name
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

        /*
          Fallback for browsers where
          Clipboard API is unavailable.
        */

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

  const original =
    "Copy newcomer list";


  copyNewcomersButton.textContent =
    "Copied ✓";


  setTimeout(
    () => {

      copyNewcomersButton.textContent =
        original;

    },
    1600
  );

}



// ==================================================
// RENDER COMPLETE PLAYER INTERFACE
// ==================================================

function renderPlayerInterface() {

  renderCategoryTabs();

  renderPlayers();

  renderNewcomerTools();

  updateQuickAddContext();

  updatePlayerSummary();

}



// ==================================================
// COURTS
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
// INVALIDATE OLD RESULT
// ==================================================

function invalidateResults() {

  currentResult =
    null;


  selectedSwapPlayer =
    null;


  lastSwapMessage =
    "";


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


  return `

    <button
      type="button"
      class="result-player swap-player${selected ? " selected-swap-player" : ""}"
      data-team-id="${escapeHtml(teamId)}"
      data-player-id="${escapeHtml(player.id)}"
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
// RECALCULATE TEAM AFTER SWAP
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
// SWAP STATUS
// ==================================================

function updateSwapStatus() {

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


  // ------------------------------------------------
  // FIRST PLAYER
  // ------------------------------------------------

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


  // ------------------------------------------------
  // SAME PLAYER = CANCEL
  // ------------------------------------------------

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


  // ------------------------------------------------
  // ANOTHER PLAYER IN SAME TEAM
  // = CHANGE SELECTION
  // ------------------------------------------------

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


  // ------------------------------------------------
  // SECOND PLAYER FROM ANOTHER TEAM
  // ------------------------------------------------

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


  renderResult(
    currentResult,
    false
  );

}



// ==================================================
// RESULT PLAYER CLICK HANDLER
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
// RESULT SIGNATURE
// Used to find a genuinely different alternative.
// ==================================================

function resultSignature(
  result
) {

  const courtsSignature =
    result.courtGames
      .map(
        game => {

          const team1 =
            game.team1.players
              .map(
                player =>
                  player.id
              )
              .sort()
              .join(",");


          const team2 =
            game.team2.players
              .map(
                player =>
                  player.id
              )
              .sort()
              .join(",");


          return [
            team1,
            team2
          ]
            .sort()
            .join(" VS ");

        }
      )
      .sort();


  const waitingSignature =
    result.waitingTeams
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


  const rotationSignature =
    result.rotationPlayers
      .map(
        player =>
          player.id
      )
      .sort();


  return JSON.stringify({

    courts:
      courtsSignature,

    waiting:
      waitingSignature,

    rotation:
      rotationSignature

  });

}



// ==================================================
// CURRENT PRESENT PLAYERS
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
// GENERATE RESULT
// ==================================================

function generateTeams(
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


    let result =
      TeamOptimizer.generate(
        selectedPlayers,
        courts,
        formatPreference
      );


    /*
      When Alternative is requested,
      try several times to find a genuinely
      different arrangement.
    */

    if (
      alternative &&
      currentResult
    ) {

      const previousSignature =
        resultSignature(
          currentResult
        );


      for (
        let attempt = 0;
        attempt < 10;
        attempt++
      ) {

        const candidate =
          TeamOptimizer.generate(
            selectedPlayers,
            courts,
            formatPreference
          );


        if (
          resultSignature(
            candidate
          ) !==
          previousSignature
        ) {

          result =
            candidate;


          break;

        }


        result =
          candidate;

      }

    }


    renderResult(
      result
    );

  }

  catch (error) {

    alert(
      error.message
    );


    console.error(
      error
    );

  }

}



// ==================================================
// CREATE BALANCED TEAMS BUTTON
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



// ==================================================
// ALTERNATIVE BUTTON
// ==================================================

document
  .getElementById(
    "alternativeButton"
  )
  .addEventListener(
    "click",
    () => {

      generateTeams(
        true
      );

    }
  );



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


  document
    .getElementById(
      "recommendation"
    )
    .innerHTML = `

      <div class="recommendation-title">

        Recommended:
        <strong>
          ${escapeHtml(formatText)}
        </strong>

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

loadPlayers();
