(function () {

  // --------------------------------------------------
  // Utility
  // --------------------------------------------------

  function shuffle(array) {
    const copy = [...array];

    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
  }


  // --------------------------------------------------
  // Analyse one possible game format
  // --------------------------------------------------

  function analyseFormat(playerCount, courts, teamSize) {

    const completeTeams = Math.floor(playerCount / teamSize);

    if (completeTeams < 2) {
      return {
        valid: false,
        score: Infinity,
        teamSize
      };
    }

    const individualRotation =
      playerCount % teamSize;

    const playableCourts =
      Math.min(
        courts,
        Math.floor(completeTeams / 2)
      );

    const teamsPlaying =
      playableCourts * 2;

    const waitingTeams =
      completeTeams - teamsPlaying;

    const unusedCourts =
      courts - playableCourts;


    /*
      Lower score = better.

      Important philosophy:

      - individual loose players are undesirable
      - complete waiting teams are acceptable
      - unused courts are undesirable
      - 3v3 gets a strong preference over 4v4
    */

    let score = 0;

    score += individualRotation * 10;
    score += waitingTeams * 5;
    score += unusedCourts * 20;

    // Preference for 3x3
    if (teamSize === 4) {
      score += 8;
    }

    return {
      valid: true,
      score,
      teamSize,
      completeTeams,
      individualRotation,
      playableCourts,
      teamsPlaying,
      waitingTeams,
      unusedCourts
    };
  }


  // --------------------------------------------------
  // Choose 3v3 or 4v4
  // --------------------------------------------------

  function choosePlan(playerCount, courts, preference) {

    const plan3 =
      analyseFormat(playerCount, courts, 3);

    const plan4 =
      analyseFormat(playerCount, courts, 4);


    if (preference === "3") {

      if (!plan3.valid) {
        throw new Error(
          "Not enough players for 3v3."
        );
      }

      return plan3;
    }


    if (preference === "4") {

      if (!plan4.valid) {
        throw new Error(
          "At least 8 players are required for 4v4."
        );
      }

      return plan4;
    }


    // AUTO MODE

    if (!plan3.valid && !plan4.valid) {
      throw new Error(
        "Not enough players to create two teams."
      );
    }

    if (!plan4.valid) {
      return plan3;
    }

    if (!plan3.valid) {
      return plan4;
    }


    // Tie automatically goes to 3v3.
    return plan3.score <= plan4.score
      ? plan3
      : plan4;
  }


  // --------------------------------------------------
  // Evaluate team balance
  // --------------------------------------------------

  function calculateBalanceScore(teams, allPlayers) {

    const totals = teams.map(team =>
      team.reduce(
        (sum, player) => sum + player.skill,
        0
      )
    );


    const average =
      totals.reduce((a, b) => a + b, 0) /
      totals.length;


    let variance = 0;

    totals.forEach(total => {
      variance += Math.pow(total - average, 2);
    });

    variance /= totals.length;


    const range =
      Math.max(...totals) -
      Math.min(...totals);


    let score = 0;

    // Main skill-balance factors
    score += variance * 12;
    score += range * 15;


    const totalElitePlayers =
      allPlayers.filter(
        player => player.skill === 5
      ).length;


    const totalStrongPlayers =
      allPlayers.filter(
        player => player.skill >= 4
      ).length;


    teams.forEach(team => {

      const elitePlayers =
        team.filter(
          player => player.skill === 5
        ).length;


      const strongPlayers =
        team.filter(
          player => player.skill >= 4
        ).length;


      /*
        If there are enough teams to distribute
        5-star players individually, heavily punish
        putting two of them together.
      */

      if (
        totalElitePlayers <= teams.length &&
        elitePlayers > 1
      ) {
        score +=
          (elitePlayers - 1) * 200;
      }

      else if (elitePlayers > 1) {
        score +=
          (elitePlayers - 1) * 60;
      }


      /*
        Also discourage too many strong
        players in one team.
      */

      if (
        totalStrongPlayers <= teams.length &&
        strongPlayers > 1
      ) {
        score +=
          (strongPlayers - 1) * 40;
      }

      else if (strongPlayers > 2) {
        score +=
          (strongPlayers - 2) * 20;
      }

    });


    return score;
  }


  // --------------------------------------------------
  // Create balanced teams
  // --------------------------------------------------

  function createBalancedTeams(
    players,
    teamCount,
    teamSize
  ) {

    let bestTeams = null;
    let bestScore = Infinity;


    /*
      A few thousand attempts are tiny work
      for a modern phone with our number of players.
    */

    const attempts = 4000;


    for (
      let attempt = 0;
      attempt < attempts;
      attempt++
    ) {

      const shuffled =
        shuffle(players);


      const teams =
        Array.from(
          { length: teamCount },
          () => []
        );


      shuffled.forEach(
        (player, index) => {

          teams[
            index % teamCount
          ].push(player);

        }
      );


      const valid =
        teams.every(
          team =>
            team.length === teamSize
        );


      if (!valid) {
        continue;
      }


      const score =
        calculateBalanceScore(
          teams,
          players
        );


      if (score < bestScore) {

        bestScore = score;

        bestTeams =
          teams.map(team => [...team]);

      }

    }


    if (!bestTeams) {
      throw new Error(
        "Could not create balanced teams."
      );
    }


    return bestTeams.map(
      (members, index) => {

        const totalSkill =
          members.reduce(
            (sum, player) =>
              sum + player.skill,
            0
          );


        return {

          id: `T${index + 1}`,

          name:
            `Team ${String.fromCharCode(
              65 + index
            )}`,

          players: members,

          totalSkill,

          averageSkill:
            totalSkill / members.length

        };

      }
    );
  }


  // --------------------------------------------------
  // Decide which teams play first
  // --------------------------------------------------

  function createCourtSchedule(
    teams,
    courts
  ) {

    const maximumActiveTeams =
      courts * 2;


    const activeTeamCount =
      Math.min(
        maximumActiveTeams,
        teams.length -
          (teams.length % 2)
      );


    /*
      Randomising this part prevents the same
      strength group from always being the
      waiting team.
    */

    const randomTeams =
      shuffle(teams);


    const activeTeams =
      randomTeams.slice(
        0,
        activeTeamCount
      );


    const waitingTeams =
      randomTeams.slice(
        activeTeamCount
      );


    /*
      Now sort active teams by skill.
      Teams with similar strength are paired
      against each other.
    */

    activeTeams.sort(
      (a, b) =>
        a.totalSkill -
        b.totalSkill
    );


    const courtGames = [];


    for (
      let i = 0;
      i < activeTeams.length;
      i += 2
    ) {

      courtGames.push({

        court:
          courtGames.length + 1,

        team1:
          activeTeams[i],

        team2:
          activeTeams[i + 1]

      });

    }


    return {
      courtGames,
      waitingTeams
    };
  }


  // --------------------------------------------------
  // Main public function
  // --------------------------------------------------

  function generate(
    selectedPlayers,
    courts,
    formatPreference
  ) {

    const plan =
      choosePlan(
        selectedPlayers.length,
        courts,
        formatPreference
      );


    const shuffledPlayers =
      shuffle(selectedPlayers);


    /*
      These are not "benched" players.
      They are simply the players starting
      in the individual rotation.
    */

    const rotationPlayers =
      shuffledPlayers.slice(
        0,
        plan.individualRotation
      );


    const teamPlayers =
      shuffledPlayers.slice(
        plan.individualRotation
      );


    const teams =
      createBalancedTeams(
        teamPlayers,
        plan.completeTeams,
        plan.teamSize
      );


    const schedule =
      createCourtSchedule(
        teams,
        courts
      );


    return {

      plan,

      teams,

      courtGames:
        schedule.courtGames,

      waitingTeams:
        schedule.waitingTeams,

      rotationPlayers

    };
  }


  // Make optimizer available to app.js

  window.TeamOptimizer = {
    generate,
    choosePlan
  };

})();
