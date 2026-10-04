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


  const CATEGORY_ORDER = [
    "Kids",
    "U14",
    "U16",
    "U18",
    "18+"
  ];



  function categoryRank(category) {

    return CATEGORY_RANK[category] ?? 99;

  }



  // ==================================================
  // GENERAL UTILITIES
  // ==================================================

  function shuffle(array) {

    const copy = [...array];


    for (
      let i = copy.length - 1;
      i > 0;
      i--
    ) {

      const j =
        Math.floor(
          Math.random() * (i + 1)
        );


      [
        copy[i],
        copy[j]
      ] = [
        copy[j],
        copy[i]
      ];

    }


    return copy;

  }



  function sumSkill(players) {

    return players.reduce(
      (sum, player) =>
        sum + player.skill,
      0
    );

  }



  function averageAgeRank(players) {

    if (
      players.length === 0
    ) {

      return 0;

    }


    return (
      players.reduce(
        (sum, player) =>
          sum +
          categoryRank(
            player.category
          ),
        0
      ) /
      players.length
    );

  }



  function categoryCounts(players) {

    const counts = {};


    CATEGORY_ORDER.forEach(
      category => {

        counts[category] = 0;

      }
    );


    players.forEach(player => {

      if (
        counts[player.category] ===
        undefined
      ) {

        counts[player.category] = 0;

      }


      counts[player.category]++;

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


    if (
      completeTeams < 2
    ) {

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

      Main philosophy:

      - Prefer 3v3
      - Avoid loose rotating players
      - Complete waiting teams are acceptable
      - Use available courts when possible
    */

    let score = 0;


    score +=
      individualRotation * 10;


    score +=
      waitingTeams * 5;


    score +=
      unusedCourts * 20;


    /*
      4v4 receives a penalty because
      3x3 remains the preferred format.
    */

    if (
      teamSize === 4
    ) {

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


    // ==================================================
    // FORCE 3V3
    // ==================================================

    if (
      preference === "3"
    ) {

      if (
        !plan3.valid
      ) {

        throw new Error(
          "Not enough players for 3v3."
        );

      }


      return plan3;

    }


    // ==================================================
    // FORCE 4V4
    // ==================================================

    if (
      preference === "4"
    ) {

      if (
        !plan4.valid
      ) {

        throw new Error(
          "At least 8 players are required for 4v4."
        );

      }


      return plan4;

    }


    // ==================================================
    // AUTO
    // ==================================================

    if (
      !plan3.valid &&
      !plan4.valid
    ) {

      throw new Error(
        "Not enough players to create two teams."
      );

    }


    if (
      !plan4.valid
    ) {

      return plan3;

    }


    if (
      !plan3.valid
    ) {

      return plan4;

    }


    /*
      Tie goes to 3v3.
    */

    return (
      plan3.score <=
      plan4.score
    )
      ? plan3
      : plan4;

  }



  // ==================================================
  // ROTATION PLAYER SELECTION
  // ==================================================

  function rotationCandidateScore(
    allPlayers,
    rotationPlayers
  ) {

    let score = 0;


    const rotationIds =
      new Set(
        rotationPlayers.map(
          player =>
            player.id
        )
      );


    const remaining =
      allPlayers.filter(
        player =>
          !rotationIds.has(
            player.id
          )
      );


    const originalCounts =
      categoryCounts(
        allPlayers
      );


    const remainingCounts =
      categoryCounts(
        remaining
      );


    /*
      Avoid putting Kids into individual
      rotation if another sensible option
      exists.
    */

    rotationPlayers.forEach(
      player => {

        if (
          player.category ===
          "Kids"
        ) {

          score += 150;

        }

      }
    );


    /*
      Avoid unnecessarily destroying
      useful age-group numbers.
    */

    CATEGORY_ORDER.forEach(
      category => {

        const before =
          originalCounts[category];


        const after =
          remainingCounts[category];


        /*
          Losing the last player of a
          category is slightly undesirable.
        */

        if (
          before > 0 &&
          after === 0
        ) {

          score += 40;

        }


        /*
          Prefer keeping pairs / groups
          instead of isolating one person.
        */

        if (
          after === 1
        ) {

          score += 25;

        }

      }
    );


    return score;

  }



  function selectRotationPlayers(
    players,
    rotationCount
  ) {

    if (
      rotationCount === 0
    ) {

      return [];

    }


    let best = null;

    let bestScore =
      Infinity;


    const attempts =
      1500;


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
        rotationCandidateScore(
          players,
          candidate
        );


      if (
        score < bestScore
      ) {

        bestScore =
          score;


        best =
          candidate;

      }

    }


    return best;

  }



  // ==================================================
  // AGE DISTANCE
  // ==================================================

  function playerAgeDistancePenalty(
    player1,
    player2
  ) {

    const rank1 =
      categoryRank(
        player1.category
      );


    const rank2 =
      categoryRank(
        player2.category
      );


    const distance =
      Math.abs(
        rank1 - rank2
      );


    /*
      General age-distance penalty.
    */

    let score =
      Math.pow(
        distance,
        2
      ) * 20;



    // ==================================================
    // SPECIAL KIDS LOGIC
    // ==================================================

    const player1Kids =
      player1.category ===
      "Kids";


    const player2Kids =
      player2.category ===
      "Kids";


    if (
      player1Kids !==
      player2Kids
    ) {

      const olderPlayer =
        player1Kids
          ? player2
          : player1;


      /*
        Kids + U14 is the desired
        fallback combination.
      */

      if (
        olderPlayer.category ===
        "U14"
      ) {

        score += 10;

      }


      /*
        Kids + U16 is possible only
        if necessary.
      */

      else if (
        olderPlayer.category ===
        "U16"
      ) {

        score += 300;

      }


      /*
        Kids + U18 should almost
        never occur.
      */

      else if (
        olderPlayer.category ===
        "U18"
      ) {

        score += 1500;

      }


      /*
        Kids + adult is considered
        extremely undesirable.
      */

      else if (
        olderPlayer.category ===
        "18+"
      ) {

        score += 3000;

      }

    }


    return score;

  }



  // ==================================================
  // GAME-POOL AGE QUALITY
  // ==================================================

  function gamePoolAgeScore(
    players
  ) {

    let score = 0;


    /*
      Compare every player with every
      other player in the same game pool.

      This means we first decide:
      "Who belongs on the same court?"
    */

    for (
      let i = 0;
      i < players.length;
      i++
    ) {

      for (
        let j = i + 1;
        j < players.length;
        j++
      ) {

        score +=
          playerAgeDistancePenalty(
            players[i],
            players[j]
          );

      }

    }


    const categories =
      [
        ...new Set(
          players.map(
            player =>
              player.category
          )
        )
      ];


    /*
      Prefer simple age pools containing
      one or two nearby categories.
    */

    if (
      categories.length > 2
    ) {

      score +=
        (
          categories.length - 2
        ) * 120;

    }


    const ranks =
      players.map(
        player =>
          categoryRank(
            player.category
          )
      );


    const spread =
      Math.max(...ranks) -
      Math.min(...ranks);


    score +=
      Math.pow(
        spread,
        2
      ) * 50;


    return score;

  }



  // ==================================================
  // TEAM-SPLIT HELPERS
  // ==================================================

  function bitCount(number) {

    let count = 0;


    while (
      number !== 0
    ) {

      count +=
        number & 1;


      number >>=
        1;

    }


    return count;

  }



  function teamCompositionScore(
    team1,
    team2
  ) {

    let score = 0;


    const counts1 =
      categoryCounts(
        team1
      );


    const counts2 =
      categoryCounts(
        team2
      );


    /*
      Prefer comparable age composition
      on both sides of the same court.

      Example:

      2 Kids + 2 U14
           vs
      2 Kids + 2 U14

      is preferred over:

      4 Kids
           vs
      4 U14
    */

    CATEGORY_ORDER.forEach(
      category => {

        let weight = 40;


        if (
          category === "Kids"
        ) {

          weight = 180;

        }


        else if (
          category === "U14"
        ) {

          weight = 80;

        }


        score +=
          Math.abs(
            counts1[category] -
            counts2[category]
          ) * weight;

      }
    );


    /*
      Also compare average age.
    */

    score +=
      Math.abs(
        averageAgeRank(team1) -
        averageAgeRank(team2)
      ) * 80;


    return score;

  }



  function eliteDistributionScore(
    team1,
    team2
  ) {

    let score = 0;


    const elite1 =
      team1.filter(
        player =>
          player.skill === 5
      ).length;


    const elite2 =
      team2.filter(
        player =>
          player.skill === 5
      ).length;


    const strong1 =
      team1.filter(
        player =>
          player.skill >= 4
      ).length;


    const strong2 =
      team2.filter(
        player =>
          player.skill >= 4
      ).length;


    /*
      Distribute 5-star players.
    */

    score +=
      Math.abs(
        elite1 -
        elite2
      ) * 120;


    /*
      Two 5-star players in one team
      is undesirable whenever avoidable.
    */

    if (
      elite1 > 1
    ) {

      score +=
        (
          elite1 - 1
        ) * 250;

    }


    if (
      elite2 > 1
    ) {

      score +=
        (
          elite2 - 1
        ) * 250;

    }


    /*
      Also distribute 4- and 5-star
      players reasonably.
    */

    score +=
      Math.abs(
        strong1 -
        strong2
      ) * 50;


    return score;

  }



  // ==================================================
  // SPLIT ONE COURT POOL INTO TWO TEAMS
  // ==================================================

  function splitGamePool(
    pool,
    teamSize
  ) {

    const playerCount =
      pool.length;


    const expected =
      teamSize * 2;


    if (
      playerCount !== expected
    ) {

      throw new Error(
        "Invalid game pool size."
      );

    }


    let best = null;

    let bestScore =
      Infinity;


    /*
      Maximum pool size is currently 8,
      so checking all combinations is tiny.

      We force player 0 into Team 1 to
      avoid testing mirrored duplicates.
    */

    const totalMasks =
      1 << playerCount;


    for (
      let mask = 1;
      mask < totalMasks;
      mask++
    ) {

      if (
        (mask & 1) === 0
      ) {

        continue;

      }


      if (
        bitCount(mask) !==
        teamSize
      ) {

        continue;

      }


      const team1 = [];

      const team2 = [];


      for (
        let i = 0;
        i < playerCount;
        i++
      ) {

        if (
          mask & (1 << i)
        ) {

          team1.push(
            pool[i]
          );

        }

        else {

          team2.push(
            pool[i]
          );

        }

      }


      const skill1 =
        sumSkill(
          team1
        );


      const skill2 =
        sumSkill(
          team2
        );


      /*
        Skill difference is very important
        inside the same game.
      */

      let score =
        Math.abs(
          skill1 - skill2
        ) * 160;


      /*
        Make the age composition of the two
        teams as similar as possible.
      */

      score +=
        teamCompositionScore(
          team1,
          team2
        );


      /*
        Avoid stacking top-skilled players.
      */

      score +=
        eliteDistributionScore(
          team1,
          team2
        );


      if (
        score < bestScore
      ) {

        bestScore =
          score;


        best = {

          team1,

          team2,

          score

        };

      }

    }


    return best;

  }



  // ==================================================
  // AGE-ORDERED PLAYER LIST
  // ==================================================

  function createAgeOrderedPlayers(
    players,
    softRandomness = true
  ) {

    return [...players]
      .map(
        player => {

          let noise = 0;


          if (
            softRandomness
          ) {

            /*
              Small random variation allows
              neighboring categories to move
              naturally across pool boundaries
              without throwing distant ages
              together.
            */

            noise =
              (
                Math.random() -
                0.5
              ) * 1.15;

          }


          return {

            player,

            key:
              categoryRank(
                player.category
              ) + noise

          };

        }
      )
      .sort(
        (a, b) =>
          a.key - b.key
      )
      .map(
        item =>
          item.player
      );

  }



  // ==================================================
  // GROUP DESCRIPTORS
  // ==================================================

  function createGroupDescriptors(
    plan
  ) {

    const descriptors = [];


    /*
      Every active court needs two teams.
    */

    for (
      let court = 0;
      court < plan.playableCourts;
      court++
    ) {

      descriptors.push({

        type:
          "game",

        size:
          plan.teamSize * 2

      });

    }


    /*
      Each waiting team is one complete team.
    */

    for (
      let waiting = 0;
      waiting < plan.waitingTeams;
      waiting++
    ) {

      descriptors.push({

        type:
          "waiting",

        size:
          plan.teamSize

      });

    }


    return descriptors;

  }



  // ==================================================
  // WAITING TEAM SCORE
  // ==================================================

  function waitingTeamScore(
    players
  ) {

    let score =
      gamePoolAgeScore(
        players
      );


    /*
      Slightly discourage having Kids
      as a complete waiting team when
      alternatives exist.

      Not forbidden, merely discouraged.
    */

    const kids =
      players.filter(
        player =>
          player.category ===
          "Kids"
      ).length;


    score +=
      kids * 20;


    return score;

  }



  // ==================================================
  // CREATE CANDIDATE SESSION STRUCTURE
  // ==================================================

  function createCandidateStructure(
    players,
    plan
  ) {

    let orderedPlayers;


    /*
      Most attempts use age ordering.
      Occasionally use broader randomisation
      so the optimiser does not get trapped
      in one fixed structure.
    */

    if (
      Math.random() < 0.10
    ) {

      orderedPlayers =
        shuffle(
          players
        );

    }

    else {

      orderedPlayers =
        createAgeOrderedPlayers(
          players,
          true
        );

    }


    /*
      Shuffle the position of waiting-team
      blocks so the youngest or oldest group
      is not automatically always waiting.
    */

    const descriptors =
      shuffle(
        createGroupDescriptors(
          plan
        )
      );


    const gameGroups = [];

    const waitingGroups = [];


    let cursor = 0;

    let score = 0;


    for (
      const descriptor of descriptors
    ) {

      const group =
        orderedPlayers.slice(
          cursor,
          cursor +
          descriptor.size
        );


      cursor +=
        descriptor.size;


      if (
        group.length !==
        descriptor.size
      ) {

        return null;

      }


      if (
        descriptor.type ===
        "game"
      ) {

        /*
          First evaluate whether these
          players belong on the same court.
        */

        const ageScore =
          gamePoolAgeScore(
            group
          );


        /*
          Then calculate the best possible
          two-team split inside that court.
        */

        const split =
          splitGamePool(
            group,
            plan.teamSize
          );


        score +=
          ageScore;


        score +=
          split.score;


        gameGroups.push({

          players:
            group,

          split,

          averageAge:
            averageAgeRank(
              group
            )

        });

      }


      else {

        score +=
          waitingTeamScore(
            group
          );


        waitingGroups.push({

          players:
            group,

          averageAge:
            averageAgeRank(
              group
            )

        });

      }

    }


    return {

      score,

      gameGroups,

      waitingGroups

    };

  }



  // ==================================================
  // FIND BEST SESSION STRUCTURE
  // ==================================================

  function createSessionStructure(
    players,
    plan
  ) {

    let best = null;

    let bestScore =
      Infinity;


    /*
      Still lightweight for the small
      player numbers in these sessions.
    */

    const attempts =
      5000;


    for (
      let attempt = 0;
      attempt < attempts;
      attempt++
    ) {

      const candidate =
        createCandidateStructure(
          players,
          plan
        );


      if (
        !candidate
      ) {

        continue;

      }


      if (
        candidate.score <
        bestScore
      ) {

        bestScore =
          candidate.score;


        best =
          candidate;

      }

    }


    if (
      !best
    ) {

      throw new Error(
        "Could not create balanced teams."
      );

    }


    /*
      For presentation, show younger
      courts first and older courts later.
    */

    best.gameGroups.sort(
      (a, b) =>
        a.averageAge -
        b.averageAge
    );


    best.waitingGroups.sort(
      (a, b) =>
        a.averageAge -
        b.averageAge
    );


    return best;

  }



  // ==================================================
  // TEAM OBJECT
  // ==================================================

  function createTeamObject(
    players,
    name,
    id
  ) {

    const totalSkill =
      sumSkill(
        players
      );


    return {

      id,

      name,

      players:

        [...players],

      totalSkill,

      averageSkill:

        totalSkill /
        players.length,

      averageAgeRank:

        averageAgeRank(
          players
        )

    };

  }



  // ==================================================
  // TEAM LABEL
  // ==================================================

  function teamLetter(
    index
  ) {

    return String.fromCharCode(
      65 + index
    );

  }



  // ==================================================
  // MAIN GENERATION
  // ==================================================

  function generate(
    selectedPlayers,
    courts,
    formatPreference
  ) {

    // ------------------------------------------------
    // CHOOSE 3V3 / 4V4
    // ------------------------------------------------

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
        plan.individualRotation
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
    // BUILD AGE-COMPATIBLE GAME POOLS
    // ------------------------------------------------

    const structure =
      createSessionStructure(
        teamPlayers,
        plan
      );


    // ------------------------------------------------
    // CREATE COURT TEAMS
    // ------------------------------------------------

    const courtGames = [];

    const allTeams = [];


    let teamIndex = 0;


    structure.gameGroups.forEach(
      (
        group,
        courtIndex
      ) => {

        const team1Name =
          `Team ${teamLetter(
            teamIndex
          )}`;


        const team1 =
          createTeamObject(
            group.split.team1,
            team1Name,
            `T${teamIndex + 1}`
          );


        teamIndex++;


        const team2Name =
          `Team ${teamLetter(
            teamIndex
          )}`;


        const team2 =
          createTeamObject(
            group.split.team2,
            team2Name,
            `T${teamIndex + 1}`
          );


        teamIndex++;


        courtGames.push({

          court:
            courtIndex + 1,

          team1,

          team2

        });


        allTeams.push(
          team1,
          team2
        );

      }
    );


    // ------------------------------------------------
    // CREATE WAITING TEAMS
    // ------------------------------------------------

    const waitingTeams = [];


    structure.waitingGroups.forEach(
      group => {

        const teamName =
          `Team ${teamLetter(
            teamIndex
          )}`;


        const team =
          createTeamObject(
            group.players,
            teamName,
            `T${teamIndex + 1}`
          );


        teamIndex++;


        waitingTeams.push(
          team
        );


        allTeams.push(
          team
        );

      }
    );


    // ------------------------------------------------
    // RESULT
    // ------------------------------------------------

    return {

      plan,

      teams:
        allTeams,

      courtGames,

      waitingTeams,

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
