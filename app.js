let players = [];
let courts = 2;


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



function playerRow(player) {

  return `

    <div class="result-player">

      <div>

        <strong>
          ${player.name}
        </strong>

        <span class="category">
          ${player.category}
        </span>

      </div>

      <span class="result-skill">
        ${stars(
          player.skill
        )}
      </span>

    </div>

  `;

}



function teamCard(team) {

  const playersHtml =
    team.players
      .map(
        playerRow
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



// ==================================================
// RESULT RENDERING
// ==================================================

function renderResult(result) {

  const plan =
    result.plan;


  const formatText =
    plan.formatLabel ||
    (
      plan.teamSize
        ? `${plan.teamSize} vs ${plan.teamSize}`
        : "Mixed format"
    );


  let specialNote = "";


  if (
    plan.specialKidsCourt
  ) {

    specialNote = `

      <div
        style="
          margin-top: 14px;
          font-size: 14px;
          color: #6b7280;
        "
      >
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


  const waitingTeams =
    document.getElementById(
      "waitingTeams"
    );


  if (
    result.waitingTeams.length > 0
  ) {

    waitingSection.hidden =
      false;


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
          playerRow
        )
        .join("");

  }

  else {

    rotationSection.hidden =
      true;

  }



  resultsSection.hidden =
    false;


  resultsSection.scrollIntoView({

    behavior:
      "smooth",

    block:
      "start"

  });

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
