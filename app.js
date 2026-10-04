let players = [];
let courts = 2;

const playerList = document.getElementById("playerList");
const playerSummary = document.getElementById("playerSummary");
const courtCount = document.getElementById("courtCount");


// -----------------------------
// Load players from GitHub
// -----------------------------

async function loadPlayers() {

  try {

    const response = await fetch("./data/players.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Could not load players.");
    }

    players = await response.json();

    renderPlayers();

  } catch (error) {

    playerSummary.textContent =
      "Player list could not be loaded.";

    console.error(error);

  }

}


// -----------------------------
// Render player list
// -----------------------------

function renderPlayers() {

  playerList.innerHTML = "";

  players.forEach(player => {

    const row = document.createElement("label");

    row.className = "player";

    const stars =
      "★".repeat(player.skill) +
      "☆".repeat(5 - player.skill);

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

    playerList.appendChild(row);

  });

  updatePlayerSummary();

}


// -----------------------------
// Present players
// -----------------------------

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


// -----------------------------
// Select all
// -----------------------------

document.getElementById("selectAll")
  .addEventListener("click", () => {

    const checkboxes =
      document.querySelectorAll(
        ".playerCheckbox"
      );

    const allSelected =
      [...checkboxes]
        .every(cb => cb.checked);

    checkboxes.forEach(
      cb => cb.checked = !allSelected
    );

    updatePlayerSummary();

  });


// -----------------------------
// Courts
// -----------------------------

document.getElementById("courtPlus")
  .addEventListener("click", () => {

    courts++;

    courtCount.textContent = courts;

  });


document.getElementById("courtMinus")
  .addEventListener("click", () => {

    if (courts > 1) {

      courts--;

      courtCount.textContent = courts;

    }

  });


// -----------------------------
// Generate teams
// -----------------------------

document.getElementById("generateButton")
  .addEventListener("click", () => {

    const selectedPlayers =
      [...document.querySelectorAll(
        ".playerCheckbox:checked"
      )];

    if (selectedPlayers.length < 6) {

      alert(
        "Select at least 6 players."
      );

      return;

    }

    alert(
      `${selectedPlayers.length} players selected. ` +
      `Team generation comes next! 🏀`
    );

  });


// Start application

loadPlayers();
