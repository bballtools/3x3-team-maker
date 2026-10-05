let players = [];

let courts = 2;

let currentResult = null;

let selectedSwapPlayer = null;

let lastSwapMessage = "";



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


const swapStatus =
  document.getElementById(
    "swapStatus"
  );


const clearSwapButton =
  document.getElementById(
    "clearSwapButton"
  );



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


    players =
      await response.json();


    renderPlayers();

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
// RENDER PLAYER LIST
// ==================================================

function renderPlayers() {

  playerList.innerHTML =
    "";


  players.forEach(
    player => {

      const row =
        document.createElement(
          "label"
        );


      row.className =
        "player";


      const stars =
        "★".repeat(
          player.skill
        ) +
        "☆".repeat(
          5 -
          player.skill
        );


      row.innerHTML = `

        <input
          type="checkbox"
          class="playerCheckbox"
          data-id="${player.id}"
        >

        <div>

          <div class="player-name">
            ${player.name}
          </div>

          <div class="player-info">
            ${player.category}
          </div>

        </div>

        <div class="skill">
          ${stars}
        </div>

      `;


      playerList.appendChild(
        row
      );

    }
  );


  updatePlayerSummary();

}



// ==================================================
// ATTENDANCE
// ==================================================

function updatePlayerSummary() {

  const selected =
    document.querySelectorAll(
      ".playerCheckbox:checked"
    ).length;


  playerSummary.textContent =
    `${selected} of ${players.length} players present`;

}



playerList.addEventListener(
  "change",
  updatePlayerSummary
);



// ==================================================
// SELECT ALL
// ==================================================

document
  .getElementById(
    "selectAll"
  )
  .addEventListener(
    "click",
    () => {

      const checkboxes =
        document.querySelectorAll(
          ".playerCheckbox"
        );


      const allSelected =
        [...checkboxes]
          .every(
            checkbox =>
              checkbox.checked
          );


      checkboxes.forEach(
        checkbox => {

          checkbox.checked =
            !allSelected;

        }
      );


      updatePlayerSummary();

    }
  );



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

      }

    }
  );



// ==================================================
// DISPLAY HELPERS
// ==================================================

function stars(skill) {

  return (
    "★".repeat(skill) +
    "☆".repeat(
      5 - skill
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
      data-team-id="${teamId}"
      data-player-id="${player.id}"
    >

      <span class="result-player-left">

        <strong>
          ${player.name}
        </strong>

        <span class="category">
          ${player.category}
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
          ${team.name}
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
          ${player.name}
        </strong>

        <span class="category">
          ${player.category}
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
// RECALCULATE TEAM AFTER MANUAL SWAP
// ==================================================

function recalculateTeam(
  team
) {

  team.totalSkill =
    team.players.reduce(
      (sum, player) =>
        sum + player.skill,
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
        team.id === teamId
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
        item.id === playerId
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
  // TAP SAME PLAYER AGAIN = CANCEL
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
  // TAP ANOTHER PLAYER IN SAME TEAM
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
// RESULT CLICK HANDLER
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
// RESULT RENDERING
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


  const recommendationText = `

    <div class="recommendation-title">

      Recommended:
      <strong>
        ${formatText}
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


  document
    .getElementById(
      "recommendation"
    )
    .innerHTML =
      recommendationText;



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
  // ROTATING PLAYERS
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
// GENERATE
// ==================================================

document
  .getElementById(
    "generateButton"
  )
  .addEventListener(
    "click",
    () => {

      const selectedIds =
        [
          ...document.querySelectorAll(
            ".playerCheckbox:checked"
          )
        ]
        .map(
          checkbox =>
            checkbox.dataset.id
        );


      const selectedPlayers =
        players.filter(
          player =>
            selectedIds.includes(
              player.id
            )
        );


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


        const result =
          TeamOptimizer.generate(
            selectedPlayers,
            courts,
            formatPreference
          );


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
  );



// ==================================================
// START APPLICATION
// ==================================================

loadPlayers();
