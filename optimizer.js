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
  // GENERAL UTILITIES
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


    /*
      Lower score = better.

      Philosophy:

      - individual loose players are undesirable
      - complete waiting teams are acceptable
      - unused courts are undesirable
      - 3v3 receives a strong preference
    */

    let score = 0;


    // Individual rotating players
    score +=
      individualRotation * 10;


    // Complete waiting teams
    score +=
      waitingTeams * 5;


    // Available courts that cannot be used
    score +=
      unusedCourts * 20;


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


    // ------------------------------------------------
    // FORCE 3V3
    // ------------------------------------------------

    if (preference === "3") {

      if (!plan3.valid) {

        throw new Error(
          "Not enough players for 3v3."
        );

      }

      return plan3;

    }


    // ------------------------------------------------
    // FORCE 4V4
    // ------------------------------------------------

    if (preference === "4") {

      if (!plan4.valid) {

        throw new Error(
          "At least 8 players are required for 4v4."
        );

      }

      return plan4;

    }


    // ------------------------------------------------
    // AUTO
    // ------------------------------------------------

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


    /*
      If scores are equal,
      3v3 automatically wins.
    */

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
        players for its own complete game,
        avoid destroying that possibility.
      */

      if (
        original >= standaloneThreshold &&
        remaining < standaloneThreshold
      ) {

        score += 250;

      }


      /*
        Prefer remaining category numbers
        that divide cleanly into teams.
      */

      if (
        remaining >= standaloneThreshold
      ) {

        score +=
          (remaining % teamSize) * 8;

      }

    });



    /*
      Avoid selecting Kids as individual
      rotating players when alternatives exist.
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

        bestRotation =
          candidate;

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


    // General skill balance
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



      /*
        If there are enough teams to place
        5-star players separately, strongly
        discourage putting two together.
      */

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



      /*
        Also discourage stacking too many
        4- and 5-star players together.
      */

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


      // ==============================================
      // KIDS
      // ==============================================

      if (hasKids) {

        const nonKids =
          team.filter(
            player =>
              player.category !==
              "Kids"
          );


        /*
          Pure Kids team = ideal.
        */

        if (
          nonKids.length === 0
        ) {

          score += 0;

        }

        else {

          nonKids.forEach(player => {

            /*
              U14 is the preferred fallback
              when Kids need older players.
            */

            if (
              player.category ===
              "U14"
            ) {

              score += 25;

            }


            /*
              U16 may occasionally play down,
              but should only happen when there
              is no substantially better option.
            */

            else if (
              player.category ===
              "U16"
            ) {

              score += 1000;

            }


            /*
              U18 with Kids is strongly avoided.
            */

            else if (
              player.category ===
              "U18"
            ) {

              score += 3000;

            }


            /*
              Adults with Kids should effectively
              happen only if no reasonable
              alternative exists at all.
            */

            else if (
              player.category ===
              "18+"
            ) {

              score += 5000;

            }

          });

        }

      }


      // ==============================================
      // NON-KIDS AGE MIXING
      // ==============================================

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

        if (
          spread === 0
        ) {

          score += 0;

        }


        /*
          Adjacent categories.

          Examples:
          U14 + U16
          U16 + U18
          U18 + 18+
        */

        else if (
          spread === 1
        ) {

          score += 12;

        }


        /*
          Two-category jump.

          Examples:
          U14 + U18
          U16 + 18+
        */

        else if (
          spread === 2
        ) {

          score += 70;

        }


        /*
          Very large age difference.
        */

        else {

          score += 220;

        }



        /*
          Prefer no more than two different
          age categories in one team.
        */

        if (
          categories.length > 2
        ) {

          score +=
            (
              categories.length - 2
            ) * 35;

        }

      }

    });



    // ==================================================
    // PRESERVE STANDALONE AGE GROUPS
    // ==================================================

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


        /*
          If there are enough players from one
          age group for a complete standalone game,
          strongly prefer keeping them together.
        */

        if (mixed) {

          score +=
            categoryPlayers.length *
            90;

        }

      });

    });



    // ==================================================
    // EXTRA KIDS SEPARATION
    // ==================================================

    const kidsCount =
      categoryCounts["Kids"] || 0;


    /*
      If there are enough Kids for their own
      complete game, mixed Kids teams become
      extremely undesirable.
    */

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
            kids * 1000;

        }

      });

    }


    return score;

  }



  // ==================================================
  // CREATE CANDIDATE TEAM ORDERS
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

    const categories = [
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
      The number of players is small enough that
      thousands of attempts are still extremely
      lightweight for a modern mobile browser.
    */

    const attempts = 10000;


    for (
      let attempt = 0;
      attempt < attempts;
      attempt++
    ) {

      let orderedPlayers;


      /*
        Some attempts are completely random.

        Others start from age-ordering so the
        optimizer has a good chance of discovering
        natural age groups.
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
  // TEAM AGE PROFILE
  // ==================================================

  function teamAgeProfile(team) {

    const allRanks =
      team.players.map(
        player =>
          categoryRank(
            player.category
          )
      );


    const nonKidsRanks =
      team.players
        .filter(
          player =>
            player.category !==
            "Kids"
        )
        .map(
          player =>
            categoryRank(
              player.category
            )
        );


    const average =
      allRanks.reduce(
        (sum, value) =>
          sum + value,
        0
      ) /
      allRanks.length;


    const nonKidsAverage =
      nonKidsRanks.length > 0
        ? nonKidsRanks.reduce(
            (sum, value) =>
              sum + value,
            0
          ) /
          nonKidsRanks.length
        : 0;


    return {

      average,

      nonKidsAverage,

      youngest:
        Math.min(
          ...allRanks
        ),

      oldest:
        Math.max(
          ...allRanks
        ),

      kids:
        team.players.filter(
          player =>
            player.category ===
            "Kids"
        ).length,

      u14:
        team.players.filter(
          player =>
            player.category ===
            "U14"
        ).length,

      u16:
        team.players.filter(
          player =>
            player.category ===
            "U16"
        ).length,

      u18:
        team.players.filter(
          player =>
            player.category ===
            "U18"
        ).length,

      adults:
        team.players.filter(
          player =>
            player.category ===
            "18+"
        ).length,

      young:
        team.players.filter(
          player =>
            player.category ===
              "Kids" ||
            player.category ===
              "U14"
        ).length,

      older:
        team.players.filter(
          player =>
            player.category ===
              "U18" ||
            player.category ===
              "18+"
        ).length

    };

  }



  // ==================================================
  // MATCHUP QUALITY
  // ==================================================

  function matchupScore(
    team1,
    team2
  ) {

    let score = 0;


    const age1 =
      teamAgeProfile(
        team1
      );


    const age2 =
      teamAgeProfile(
        team2
      );


    // ==================================================
    // SKILL DIFFERENCE BETWEEN OPPONENTS
    // ==================================================

    score +=
      Math.abs(
        team1.totalSkill -
        team2.totalSkill
      ) * 10;



    // ==================================================
    // GENERAL AGE DIFFERENCE
    // ==================================================

    score +=
      Math.abs(
        age1.average -
        age2.average
      ) * 60;



    /*
      Especially useful when both teams
      contain Kids.

      We compare the ages of the players
      surrounding the Kids.
    */

    score +=
      Math.abs(
        age1.nonKidsAverage -
        age2.nonKidsAverage
      ) * 140;



    /*
      Avoid matching teams whose oldest
      players differ significantly.
    */

    score +=
      Math.abs(
        age1.oldest -
        age2.oldest
      ) * 90;



    /*
      Compare actual age composition,
      rather than relying only on averages.
    */

    score +=
      Math.abs(
        age1.older -
        age2.older
      ) * 120;


    score +=
      Math.abs(
        age1.young -
        age2.young
      ) * 80;



    /*
      Compare individual category counts.
      This prevents averages from hiding
      very different compositions.
    */

    score +=
      Math.abs(
        age1.u14 -
        age2.u14
      ) * 30;


    score +=
      Math.abs(
        age1.u16 -
        age2.u16
      ) * 30;


    score +=
      Math.abs(
        age1.u18 -
        age2.u18
      ) * 45;


    score +=
      Math.abs(
        age1.adults -
        age2.adults
      ) * 60;



    // ==================================================
    // KIDS MATCHUP RULES
    // ==================================================

    const team1HasKids =
      age1.kids > 0;


    const team2HasKids =
      age2.kids > 0;


    /*
      Prefer a team containing Kids to face
      another team containing Kids.
    */

    if (
      team1HasKids !==
      team2HasKids
    ) {

      score += 600;

    }


    /*
      If both teams contain Kids, compare
      the players accompanying those Kids.

      Example to avoid:

      Kids + U18 + 18+ + 18+

      against

      Kids + U14 + U14 + U16
    */

    if (
      team1HasKids &&
      team2HasKids
    ) {

      const companionDifference =
        Math.abs(
          age1.nonKidsAverage -
          age2.nonKidsAverage
        );


      if (
        companionDifference > 1
      ) {

        score +=
          companionDifference *
          400;

      }

    }


    return score;

  }



  // ==================================================
  // GLOBAL TEAM PAIRING
  // ==================================================

  function pairTeams(teams) {

    /*
      Test every possible combination of
      opponent pairings.

      Our sessions contain only a small number
      of teams, so this is extremely fast.

      Example with 6 teams:
      the optimizer evaluates all possible
      ways to create 3 games and keeps the
      globally best set of matchups.
    */


    function findBestPairing(
      remaining
    ) {

      if (
        remaining.length === 0
      ) {

        return {

          games: [],

          totalScore: 0

        };

      }


      const team1 =
        remaining[0];


      let bestResult = null;


      for (
        let i = 1;
        i < remaining.length;
        i++
      ) {

        const team2 =
          remaining[i];


        const rest =
          remaining.filter(
            (_, index) =>
              index !== 0 &&
              index !== i
          );


        const restResult =
          findBestPairing(
            rest
          );


        const thisScore =
          matchupScore(
            team1,
            team2
          );


        const totalScore =
          thisScore +
          restResult.totalScore;


        if (
          bestResult === null ||
          totalScore <
            bestResult.totalScore
        ) {

          bestResult = {

            games: [

              {
                team1,
                team2
              },

              ...restResult.games

            ],

            totalScore

          };

        }

      }


      return bestResult;

    }


    return findBestPairing(
      teams
    );

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
          (
            teams.length % 2
          )
      );


    const waitingCount =
      teams.length -
      activeTeamCount;


    let bestResult = null;
    let bestScore = Infinity;


    /*
      Try different choices for which teams
      play immediately and which complete
      teams wait for the next round.
    */

    const attempts = 500;


    for (
      let attempt = 0;
      attempt < attempts;
      attempt++
    ) {

      const shuffled =
        shuffle(
          teams
        );


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


    // ------------------------------------------------
    // SELECT INDIVIDUAL ROTATION PLAYERS
    // ------------------------------------------------

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


    // ------------------------------------------------
    // PLAYERS USED FOR COMPLETE TEAMS
    // ------------------------------------------------

    const teamPlayers =
      selectedPlayers.filter(
        player =>
          !rotationIds.has(
            player.id
          )
      );


    // ------------------------------------------------
    // CREATE TEAMS
    // ------------------------------------------------

    const teams =
      createBalancedTeams(
        teamPlayers,
        plan.completeTeams,
        plan.teamSize
      );


    // ------------------------------------------------
    // ASSIGN TEAMS TO COURTS
    // ------------------------------------------------

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
