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



  function createCombinations(
    items,
    size
  ) {

    const results = [];


    function build(
      start,
      current
    ) {

      if (
        current.length === size
      ) {

        results.push(
          [...current]
        );

        return;

      }


      for (
        let i = start;
        i < items.length;
        i++
      ) {

        current.push(
          items[i]
        );


        build(
          i + 1,
          current
        );


        current.pop();

      }

    }


    build(
      0,
      []
    );


    return results;

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


    let score = 0;


    /*
      Loose individual players are
      less desirable than a complete
      waiting team.
    */

    score +=
      individualRotation * 10;


    /*
      Complete waiting teams are fine.
    */

    score +=
      waitingTeams * 5;


    /*
      Prefer using available courts.
    */

    score +=
      unusedCourts * 20;


    /*
      3v3 remains the primary format.
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
      Equal result means 3v3 wins.
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
      rotation whenever possible.
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


    CATEGORY_ORDER.forEach(
      category => {

        const before =
          originalCounts[category];


        const after =
          remainingCounts[category];


        /*
          Avoid completely removing an
          age category unnecessarily.
        */

        if (
          before > 0 &&
          after === 0
        ) {

          score += 40;

        }


        /*
          Avoid leaving one isolated
          player in a category.
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


    let score =
      Math.pow(
        distance,
        2
      ) * 20;



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


      if (
        olderPlayer.category ===
        "U14"
      ) {

        score += 10;

      }


      else if (
        olderPlayer.category ===
        "U16"
      ) {

        score += 300;

      }


      else if (
        olderPlayer.category ===
        "U18"
      ) {

        score += 1500;

      }


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
  // TEAM SPLITTING
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


    CATEGORY_ORDER.forEach(
      category => {

        let weight = 40;


        if (
          category === "Kids"
        ) {

          weight = 220;

        }


        else if (
          category === "U14"
        ) {

          weight = 90;

        }


        score +=
          Math.abs(
            counts1[category] -
            counts2[category]
          ) * weight;

      }
    );


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


    score +=
      Math.abs(
        elite1 -
        elite2
      ) * 120;


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


    score +=
      Math.abs(
        strong1 -
        strong2
      ) * 50;


    return score;

  }



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


    const totalMasks =
      1 << playerCount;


    for (
      let mask = 1;
      mask < totalMasks;
      mask++
    ) {

      /*
        Player zero always stays in
        Team 1 to avoid mirrored
        duplicate combinations.
      */

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


      let score =
        Math.abs(
          skill1 - skill2
        ) * 160;


      score +=
        teamCompositionScore(
          team1,
          team2
        );


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
  // SPECIAL KIDS 3V3 COURT
  // ==================================================

  function findSpecialKidsCourt(
    players
  ) {

    const kids =
      players.filter(
        player =>
          player.category ===
          "Kids"
      );


    /*
      Special Kids court is used when
      there are 2–5 Kids.

      Six Kids already make a complete
      standalone 3v3 game.
    */

    if (
      kids.length < 2 ||
      kids.length >= 6
    ) {

      return null;

    }


    const fillersNeeded =
      6 - kids.length;


    /*
      U14 is the preferred source.

      U16 is allowed only as a fallback.
    */

    const eligibleFillers =
      players.filter(
        player =>
          player.category === "U14" ||
          player.category === "U16"
      );


    if (
      eligibleFillers.length <
      fillersNeeded
    ) {

      return null;

    }


    const combinations =
      createCombinations(
        eligibleFillers,
        fillersNeeded
      );


    let bestResult = null;

    let bestScore =
      Infinity;


    combinations.forEach(
      fillers => {

        let score = 0;


        /*
          Strongly prefer U14 players
          over U16 players.
        */

        fillers.forEach(
          player => {

            if (
              player.category ===
              "U16"
            ) {

              score += 1200;

            }


            /*
              When playing down,
              lower-skilled players
              are preferred.
            */

            score +=
              player.skill * 20;


            if (
              player.skill === 5
            ) {

              score += 250;

            }


            else if (
              player.skill === 4
            ) {

              score += 80;

            }

          }
        );


        const pool = [
          ...kids,
          ...fillers
        ];


        const split =
          splitGamePool(
            pool,
            3
          );


        score +=
          split.score;


        if (
          score < bestScore
        ) {

          bestScore =
            score;


          bestResult = {

            players:
              pool,

            fillers,

            split,

            score

          };

        }

      }
    );


    return bestResult;

  }



  // ==================================================
  // AGE ORDERING
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
  // WAITING TEAM QUALITY
  // ==================================================

  function waitingTeamScore(
    players
  ) {

    let score =
      gamePoolAgeScore(
        players
      );


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

        const ageScore =
          gamePoolAgeScore(
            group
          );


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
            ),

          teamSize:
            plan.teamSize

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
            ),

          teamSize:
            plan.teamSize

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
        ),

      teamSize:
        players.length

    };

  }



  function teamLetter(index) {

    return String.fromCharCode(
      65 + index
    );

  }



  // ==================================================
  // BUILD STANDARD PART OF SESSION
  // ==================================================

  function buildStandardSession(
    players,
    plan,
    teamIndexStart,
    courtOffset
  ) {

    const rotationPlayers =
      selectRotationPlayers(
        players,
        plan.individualRotation
      );


    const rotationIds =
      new Set(
        rotationPlayers.map(
          player =>
            player.id
        )
      );


    const teamPlayers =
      players.filter(
        player =>
          !rotationIds.has(
            player.id
          )
      );


    const structure =
      createSessionStructure(
        teamPlayers,
        plan
      );


    const courtGames = [];

    const teams = [];

    const waitingTeams = [];


    let teamIndex =
      teamIndexStart;


    structure.gameGroups.forEach(
      (
        group,
        courtIndex
      ) => {

        const team1 =
          createTeamObject(

            group.split.team1,

            `Team ${teamLetter(
              teamIndex
            )}`,

            `T${teamIndex + 1}`

          );


        teamIndex++;


        const team2 =
          createTeamObject(

            group.split.team2,

            `Team ${teamLetter(
              teamIndex
            )}`,

            `T${teamIndex + 1}`

          );


        teamIndex++;


        courtGames.push({

          court:
            courtOffset +
            courtIndex +
            1,

          teamSize:
            plan.teamSize,

          team1,

          team2

        });


        teams.push(
          team1,
          team2
        );

      }
    );


    structure.waitingGroups.forEach(
      group => {

        const team =
          createTeamObject(

            group.players,

            `Team ${teamLetter(
              teamIndex
            )}`,

            `T${teamIndex + 1}`

          );


        teamIndex++;


        waitingTeams.push(
          team
        );


        teams.push(
          team
        );

      }
    );


    return {

      teams,

      courtGames,

      waitingTeams,

      rotationPlayers,

      nextTeamIndex:
        teamIndex

    };

  }



  // ==================================================
  // STANDARD SESSION
  // ==================================================

  function generateStandardSession(
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


    const result =
      buildStandardSession(
        selectedPlayers,
        plan,
        0,
        0
      );


    return {

      plan: {

        ...plan,

        formatLabel:
          `${plan.teamSize} vs ${plan.teamSize}`,

        mixedFormats:
          false,

        specialKidsCourt:
          false

      },

      teams:
        result.teams,

      courtGames:
        result.courtGames,

      waitingTeams:
        result.waitingTeams,

      rotationPlayers:
        result.rotationPlayers

    };

  }



  // ==================================================
  // SPECIAL KIDS + REMAINING SESSION
  // ==================================================

  function generateSpecialKidsSession(
    selectedPlayers,
    courts
  ) {

    const kidsCourt =
      findSpecialKidsCourt(
        selectedPlayers
      );


    if (
      !kidsCourt
    ) {

      return null;

    }


    const specialIds =
      new Set(
        kidsCourt.players.map(
          player =>
            player.id
        )
      );


    const remainingPlayers =
      selectedPlayers.filter(
        player =>
          !specialIds.has(
            player.id
          )
      );


    // ------------------------------------------------
    // KIDS COURT TEAMS
    // ------------------------------------------------

    const teamA =
      createTeamObject(

        kidsCourt.split.team1,

        "Team A",

        "T1"

      );


    const teamB =
      createTeamObject(

        kidsCourt.split.team2,

        "Team B",

        "T2"

      );


    const courtGames = [

      {

        court: 1,

        teamSize: 3,

        specialKidsCourt: true,

        team1: teamA,

        team2: teamB

      }

    ];


    const allTeams = [
      teamA,
      teamB
    ];


    let waitingTeams = [];

    let rotationPlayers = [];


    let remainingPlan = null;


    // ------------------------------------------------
    // REMAINING COURTS
    // ------------------------------------------------

    const remainingCourts =
      Math.max(
        0,
        courts - 1
      );


    /*
      If another complete game can be
      created and another court exists,
      optimize the remainder independently.
    */

    if (
      remainingCourts > 0 &&
      remainingPlayers.length >= 6
    ) {

      remainingPlan =
        choosePlan(
          remainingPlayers.length,
          remainingCourts,
          "auto"
        );


      const remainingResult =
        buildStandardSession(
          remainingPlayers,
          remainingPlan,
          2,
          1
        );


      courtGames.push(
        ...remainingResult.courtGames
      );


      allTeams.push(
        ...remainingResult.teams
      );


      waitingTeams =
        remainingResult.waitingTeams;


      rotationPlayers =
        remainingResult.rotationPlayers;

    }


    else {

      /*
        Not enough players / courts for
        another complete game.

        Those players start in rotation.
      */

      rotationPlayers =
        [...remainingPlayers];

    }


    // ------------------------------------------------
    // SESSION SUMMARY
    // ------------------------------------------------

    const remainingTeamCount =
      remainingPlan
        ? remainingPlan.completeTeams
        : 0;


    const completeTeams =
      2 +
      remainingTeamCount;


    const playableCourts =
      1 +
      (
        remainingPlan
          ? remainingPlan.playableCourts
          : 0
      );


    const waitingTeamCount =
      remainingPlan
        ? remainingPlan.waitingTeams
        : 0;


    let formatLabel =
      "3 vs 3";


    let mixedFormats =
      false;


    if (
      remainingPlan &&
      remainingPlan.teamSize === 4
    ) {

      formatLabel =
        "3 vs 3 + 4 vs 4";


      mixedFormats =
        true;

    }


    return {

      plan: {

        valid: true,

        formatLabel,

        mixedFormats,

        specialKidsCourt:
          true,

        teamSize:
          mixedFormats
            ? null
            : 3,

        completeTeams,

        playableCourts,

        waitingTeams:
          waitingTeamCount,

        individualRotation:
          rotationPlayers.length,

        unusedCourts:
          courts -
          playableCourts

      },

      teams:
        allTeams,

      courtGames,

      waitingTeams,

      rotationPlayers

    };

  }



  // ==================================================
  // MAIN GENERATION
  // ==================================================

  function generate(
    selectedPlayers,
    courts,
    formatPreference
  ) {

    /*
      The dedicated Kids 3v3 court is
      an AUTO-mode feature.

      Manual Force 3v3 / Force 4v4
      remains literal.
    */

    if (
      formatPreference === "auto"
    ) {

      const kids =
        selectedPlayers.filter(
          player =>
            player.category ===
            "Kids"
        );


      if (
        kids.length >= 2 &&
        kids.length < 6
      ) {

        const specialResult =
          generateSpecialKidsSession(
            selectedPlayers,
            courts
          );


        if (
          specialResult
        ) {

          return specialResult;

        }

      }

    }


    /*
      If the special rule cannot be used,
      fall back to the normal optimizer.
    */

    return generateStandardSession(
      selectedPlayers,
      courts,
      formatPreference
    );

  }



  // ==================================================
  // PUBLIC API
  // ==================================================

  window.TeamOptimizer = {

    generate,

    choosePlan

  };


})();
