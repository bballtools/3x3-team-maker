(function () {

  // ==================================================
  // AGE CONFIGURATION
  // ==================================================

  const CATEGORY_RANK = {
    "Kids": 0,
    "U14": 1,
    "U16": 2,
    "U18": 3,
    "18+": 4
  };


  function categoryRank(category) {

    return CATEGORY_RANK[category] ?? 99;

  }



  // ==================================================
  // UTILITY
  // ==================================================

  function shuffle(array) {

    const copy = [...array];

    for (let i = copy.length - 1; i > 0; i--) {

      const j =
        Math.floor(
          Math.random() * (i + 1)
        );

      [copy[i], copy[j]] =
        [copy[j], copy[i]];

    }

    return copy;

  }



  function countByCategory(players) {

    const counts = {};

    players.forEach(player => {

      counts[player.category] =
        (counts[player.category] || 0) + 1;

    });

    return counts;

  }



  // ==================================================
  // GAME FORMAT
  // ==================================================

  function analyseFormat(
    playerCount,
    courts,
    teamSize
  ) {

    const completeTeams =
      Math.floor(
        playerCount / teamSize
      );


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
        Math.floor(
          completeTeams / 2
        )
      );


    const teamsPlaying =
      playableCourts * 2;


    const waitingTeams =
      completeTeams -
      teamsPlaying;


    const unusedCourts =
      courts -
      playableCourts;


    let score = 0;


    // Loose individual players are undesirable.
    score +=
      individualRotation * 10;


    // A complete waiting team is acceptable.
    score +=
      waitingTeams * 5;


    // Avoid leaving courts unused when possible.
    score +=
      unusedCourts * 20;


    // Strong preference for 3x3.
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



  function choosePlan(
    playerCount,
    courts,
    preference
  ) {

    const plan3 =
      analyseFormat(
        playerCount,
        courts,
        3
      );


    const plan4 =
      analyseFormat(
        playerCount,
        courts,
        4
      );


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


    if (
      !plan3.valid &&
      !plan4.valid
    ) {

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


    return plan3.score <= plan4.score
      ? plan3
      : plan4;

  }



  // ==================================================
  // ROTATION PLAYER SELECTION
  // ==================================================

  function rotationSelectionScore(
    allPlayers,
    rotationPlayers,
    teamSize
  ) {

    const originalCounts =
      countByCategory(
        allPlayers
      );


    const rotationIds =
      new Set(
        rotationPlayers.map(
          player => player.id
        )
      );


    const remainingPlayers =
      allPlayers.filter(
        player =>
          !rotationIds.has(
            player.id
          )
      );


    const remainingCounts =
      countByCategory(
        remainingPlayers
      );


    let score = 0;


    Object.keys(
      originalCounts
    ).forEach(category => {

      const original =
        originalCounts[category] || 0;


      const remaining =
        remainingCounts[category] || 0;


      const standaloneThreshold =
        teamSize * 2;


      /*
        If an age category originally had enough
        players for a complete standalone game,
        avoid breaking that possibility.
      */

      if (
        original >= standaloneThreshold &&
        remaining < standaloneThreshold
      ) {

        score += 250;

      }


      /*
        Prefer remaining category counts that
        divide cleanly into teams.
      */

      if (
        remaining >= standaloneThreshold
      ) {

        score +=
          (remaining % teamSize) * 8;

      }

    });


    /*
      Avoid putting Kids into individual rotation
      unless necessary.
    */

    rotationPlayers.forEach(
      player => {

        if (
          player.category === "Kids"
        ) {

          score += 25;

        }

      }
    );


    return score;

  }



  function selectRotationPlayers(
    players,
    rotationCount,
    teamSize
  ) {

    if (rotationCount === 0) {

      return [];

    }


    let bestRotation = null;
    let bestScore = Infinity;


    const attempts = 1000;


    for (
      let attempt = 0;
      attempt < attempts;
      attempt++
    ) {

      const candidate =
        shuffle(players)
          .slice(
            0,
            rotationCount
          );


      const score =
        rotationSelectionScore(
          players,
          candidate,
          teamSize
        );


      if (score < bestScore) {

        bestScore = score;

        bestRotation = candidate;

      }

    }


    return bestRotation;

  }



  // ==================================================
  // SKILL BALANCE
  // ==================================================

  function calculateSkillScore(
    teams,
    allPlayers
  ) {

    const totals =
      teams.map(
        team =>
          team.reduce(
            (sum, player) =>
              sum + player.skill,
            0
          )
      );


    const average =
      totals.reduce(
        (a, b) => a + b,
        0
      ) /
      totals.length;


    let variance = 0;


    totals.forEach(total => {

      variance +=
        Math.pow(
          total - average,
          2
        );

    });


    variance /=
      totals.length;


    const range =
      Math.max(...totals) -
      Math.min(...totals);


    let score = 0;


    score +=
      variance * 12;


    score +=
      range * 15;



    const totalElitePlayers =
      allPlayers.filter(
        player =>
          player.skill === 5
      ).length;


    const totalStrongPlayers =
      allPlayers.filter(
        player =>
          player.skill >= 4
      ).length;



    teams.forEach(team => {

      const elitePlayers =
        team.filter(
          player =>
            player.skill === 5
        ).length;


      const strongPlayers =
        team.filter(
          player =>
            player.skill >= 4
        ).length;



      if (
        totalElitePlayers <=
          teams.length &&
        elitePlayers > 1
      ) {

        score +=
          (elitePlayers - 1) *
          200;

      }

      else if (
        elitePlayers > 1
      ) {

        score +=
          (elitePlayers - 1) *
          60;

      }



      if (
        totalStrongPlayers <=
          teams.length &&
        strongPlayers > 1
      ) {

        score +=
          (strongPlayers - 1) *
          40;

      }

      else if (
        strongPlayers > 2
      ) {

        score +=
          (strongPlayers - 2) *
          20;

      }

    });


    return score;

  }



  // ==================================================
  // AGE BALANCE
  // ==================================================

  function calculateAgeScore(
    teams,
    allPlayers,
    teamSize
  ) {

    const categoryCounts =
      countByCategory(
        allPlayers
      );


    const standaloneThreshold =
      teamSize * 2;


    let score = 0;



    teams.forEach(team => {

      const categories =
        [
          ...new Set(
            team.map(
              player =>
                player.category
            )
          )
        ];


      const ranks =
        team.map(
          player =>
            categoryRank(
              player.category
            )
        );


      const hasKids =
        categories.includes(
          "Kids"
        );


      // ----------------------------------------------
      // KIDS
      // ----------------------------------------------

      if (hasKids) {

        const nonKids =
          team.filter(
            player =>
              player.category !==
              "Kids"
          );


        /*
          A pure Kids team is ideal.
        */

        if (
          nonKids.length === 0
        ) {

          score += 0;

        }

        else {

          nonKids.forEach(player => {

            /*
              U14 may play down with Kids
              when necessary.
            */

            if (
              player.category ===
              "U14"
            ) {

              score += 30;

            }

            /*
              U16 or older with Kids is
              strongly discouraged.
            */

            else {

              score += 700;

            }

          });

        }

      }


      // ----------------------------------------------
      // NON-KIDS AGE MIXING
      // ----------------------------------------------

      else {

        const minRank =
          Math.min(...ranks);


        const maxRank =
          Math.max(...ranks);


        const spread =
          maxRank - minRank;


        /*
          Same age category.
        */

        if (spread === 0) {

          score += 0;

        }


        /*
          Adjacent categories are acceptable.
          Example: U14 + U16.
        */

        else if (
          spread === 1
        ) {

          score += 12;

        }


        /*
          Two-category jump.
          Example: U14 + U18.
        */

        else if (
          spread === 2
        ) {

          score += 70;

        }


        /*
          Very large age gap.
        */

        else {

          score += 220;

        }


        /*
          Prefer at most two age categories
          inside one team.
        */

        if (
          categories.length > 2
        ) {

          score +=
            (categories.length - 2) *
            35;

        }

      }

    });



    // ----------------------------------------------
    // PRESERVE STANDALONE AGE GROUPS
    // ----------------------------------------------

    Object.keys(
      categoryCounts
    ).forEach(category => {

      const count =
        categoryCounts[category];


      if (
        count <
        standaloneThreshold
      ) {

        return;

      }


      teams.forEach(team => {

        const categoryPlayers =
          team.filter(
            player =>
              player.category ===
              category
          );


        if (
          categoryPlayers.length === 0
        ) {

          return;

        }


        const mixed =
          team.some(
            player =>
              player.category !==
              category
          );


        if (mixed) {

          /*
            If there are enough players from
            one category for their own game,
            strongly prefer keeping them
            together.
          */

          score +=
            categoryPlayers.length *
            90;

        }

      });

    });



    /*
      Kids get an even stronger separation
      rule when enough Kids exist for a
      standalone game.
    */

    const kidsCount =
      categoryCounts["Kids"] || 0;


    if (
      kidsCount >=
      standaloneThreshold
    ) {

      teams.forEach(team => {

        const kids =
          team.filter(
            player =>
              player.category ===
              "Kids"
          ).length;


        const others =
          team.length - kids;


        if (
          kids > 0 &&
          others > 0
        ) {

          score +=
            kids * 250;

        }

      });

    }


    return score;

  }



  // ==================================================
  // BUILD CANDIDATE TEAMS
  // ==================================================

  function chunkIntoTeams(
    orderedPlayers,
    teamCount,
    teamSize
  ) {

    const teams = [];


    for (
      let i = 0;
      i < teamCount;
      i++
    ) {

      teams.push(
        orderedPlayers.slice(
          i * teamSize,
          (i + 1) * teamSize
        )
      );

    }


    return teams;

  }



  function createAgeOrderedPlayers(
    players
  ) {

    const categories =
      [
        "Kids",
        "U14",
        "U16",
        "U18",
        "18+"
      ];


    const ordered = [];


    categories.forEach(
      category => {

        const categoryPlayers =
          shuffle(
            players.filter(
              player =>
                player.category ===
                category
            )
          );


        ordered.push(
          ...categoryPlayers
        );

      }
    );


    return ordered;

  }



  // ==================================================
  // CREATE BALANCED TEAMS
  // ==================================================

  function createBalancedTeams(
    players,
    teamCount,
    teamSize
  ) {

    let bestTeams = null;
    let bestScore = Infinity;


    /*
      Several thousand combinations are still
      very small work for a modern phone.
    */

    const attempts = 8000;


    for (
      let attempt = 0;
      attempt < attempts;
      attempt++
    ) {

      let orderedPlayers;


      /*
        Some attempts are completely random.

        Others deliberately place neighboring
        age groups together first.

        This gives the optimiser much better
        chances of finding strong age-based
        solutions.
      */

      if (
        attempt % 3 === 0
      ) {

        orderedPlayers =
          shuffle(players);

      }

      else {

        orderedPlayers =
          createAgeOrderedPlayers(
            players
          );

      }


      const teams =
        chunkIntoTeams(
          orderedPlayers,
          teamCount,
          teamSize
        );


      const valid =
        teams.every(
          team =>
            team.length ===
            teamSize
        );


      if (!valid) {

        continue;

      }


      const skillScore =
        calculateSkillScore(
          teams,
          players
        );


      const ageScore =
        calculateAgeScore(
          teams,
          players,
          teamSize
        );


      const totalScore =
        skillScore +
        ageScore;


      if (
        totalScore <
        bestScore
      ) {

        bestScore =
          totalScore;


        bestTeams =
          teams.map(
            team => [...team]
          );

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


        const averageAgeRank =
          members.reduce(
            (sum, player) =>
              sum +
              categoryRank(
                player.category
              ),
            0
          ) /
          members.length;


        return {

          id:
            `T${index + 1}`,

          name:
            `Team ${String.fromCharCode(
              65 + index
            )}`,

          players:
            members,

          totalSkill,

          averageSkill:
            totalSkill /
            members.length,

          averageAgeRank

        };

      }
    );

  }



  // ==================================================
  // MATCHUP QUALITY
  // ==================================================

  function matchupScore(
    team1,
    team2
  ) {

    let score = 0;


    /*
      Similar skill teams should play
      against each other.
    */

    score +=
      Math.abs(
        team1.totalSkill -
        team2.totalSkill
      ) * 10;



    /*
      Similar age teams should play
      against each other.
    */

    score +=
      Math.abs(
        team1.averageAgeRank -
        team2.averageAgeRank
      ) * 35;



    const team1Kids =
      team1.players.some(
        player =>
          player.category ===
          "Kids"
      );


    const team2Kids =
      team2.players.some(
        player =>
          player.category ===
          "Kids"
      );


    /*
      Never intentionally pair a Kids team
      against an older team when another
      reasonable matchup exists.
    */

    if (
      team1Kids !==
      team2Kids
    ) {

      score += 300;

    }


    return score;

  }



  function pairTeams(
    teams
  ) {

    const remaining =
      shuffle(teams);


    const games = [];

    let totalScore = 0;


    while (
      remaining.length >= 2
    ) {

      const team1 =
        remaining.shift();


      let bestIndex = 0;
      let bestOpponentScore =
        Infinity;


      remaining.forEach(
        (candidate, index) => {

          const score =
            matchupScore(
              team1,
              candidate
            );


          if (
            score <
            bestOpponentScore
          ) {

            bestOpponentScore =
              score;

            bestIndex =
              index;

          }

        }
      );


      const team2 =
        remaining.splice(
          bestIndex,
          1
        )[0];


      games.push({
        team1,
        team2
      });


      totalScore +=
        bestOpponentScore;

    }


    return {
      games,
      totalScore
    };

  }



  // ==================================================
  // COURT SCHEDULE
  // ==================================================

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


    const waitingCount =
      teams.length -
      activeTeamCount;


    let bestResult = null;
    let bestScore = Infinity;


    /*
      Try different choices for which teams
      start and which teams wait.
    */

    const attempts = 500;


    for (
      let attempt = 0;
      attempt < attempts;
      attempt++
    ) {

      const shuffled =
        shuffle(teams);


      const waitingTeams =
        shuffled.slice(
          0,
          waitingCount
        );


      const activeTeams =
        shuffled.slice(
          waitingCount
        );


      const paired =
        pairTeams(
          activeTeams
        );


      if (
        paired.totalScore <
        bestScore
      ) {

        bestScore =
          paired.totalScore;


        bestResult = {
          games:
            paired.games,

          waitingTeams
        };

      }

    }



    const courtGames =
      bestResult.games.map(
        (game, index) => ({

          court:
            index + 1,

          team1:
            game.team1,

          team2:
            game.team2

        })
      );


    return {

      courtGames,

      waitingTeams:
        bestResult.waitingTeams

    };

  }



  // ==================================================
  // MAIN GENERATE FUNCTION
  // ==================================================

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


    const rotationPlayers =
      selectRotationPlayers(
        selectedPlayers,
        plan.individualRotation,
        plan.teamSize
      );


    const rotationIds =
      new Set(
        rotationPlayers.map(
          player =>
            player.id
        )
      );


    const teamPlayers =
      selectedPlayers.filter(
        player =>
          !rotationIds.has(
            player.id
          )
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



  // ==================================================
  // PUBLIC API
  // ==================================================

  window.TeamOptimizer = {
    generate,
    choosePlan
  };


})();
