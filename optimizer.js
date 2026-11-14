(function () {
  "use strict";

  // ==================================================
  // CONFIGURATION
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

  // History should influence a round, but age and skill remain more important.
  const TEAMMATE_REPEAT_WEIGHT = 60;
  const EXACT_TEAM_REPEAT_WEIGHT = 140;
  const OPPONENT_REPEAT_WEIGHT = 6;
  const EXACT_MATCHUP_REPEAT_WEIGHT = 80;

  // Performance controls. These replace the previous fixed 5,000 full searches.
  const TOP_CANDIDATES_TO_REFINE = 4;
  const MAX_WAITING_REBALANCE_PASSES = 6;
  const MIN_BROAD_SEARCH_ATTEMPTS = 80;

  // ==================================================
  // GENERAL UTILITIES
  // ==================================================

  function categoryRank(category) {
    return CATEGORY_RANK[category] ?? 99;
  }

  function shuffle(array) {
    const copy = [...array];

    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
  }

  function sumSkill(players) {
    return players.reduce((sum, player) => sum + player.skill, 0);
  }

  function averageSkill(players) {
    if (players.length === 0) {
      return 0;
    }

    return sumSkill(players) / players.length;
  }

  function averageAgeRank(players) {
    if (players.length === 0) {
      return 0;
    }

    return (
      players.reduce(
        (sum, player) => sum + categoryRank(player.category),
        0
      ) / players.length
    );
  }

  function categoryCounts(players) {
    const counts = {};

    CATEGORY_ORDER.forEach(category => {
      counts[category] = 0;
    });

    players.forEach(player => {
      if (counts[player.category] === undefined) {
        counts[player.category] = 0;
      }

      counts[player.category]++;
    });

    return counts;
  }

  function cloneGroups(groups) {
    return groups.map(group => ({
      ...group,
      players: [...group.players]
    }));
  }

  function combinations(items, size, limit = Infinity) {
    const results = [];

    function build(start, current) {
      if (results.length >= limit) {
        return;
      }

      if (current.length === size) {
        results.push([...current]);
        return;
      }

      const stillNeeded = size - current.length;

      for (
        let i = start;
        i <= items.length - stillNeeded && results.length < limit;
        i++
      ) {
        current.push(items[i]);
        build(i + 1, current);
        current.pop();
      }
    }

    build(0, []);
    return results;
  }

  // ==================================================
  // EVENING HISTORY
  // ==================================================

  function incrementMap(map, key) {
    map.set(key, (map.get(key) || 0) + 1);
  }

  function pairKey(id1, id2) {
    return [id1, id2].sort().join("|");
  }

  function idsFromStoredTeam(team) {
    if (Array.isArray(team)) {
      return [...team];
    }

    if (team && Array.isArray(team.players)) {
      return team.players.map(player =>
        typeof player === "string" ? player : player.id
      );
    }

    return [];
  }

  function teamKeyFromIds(ids) {
    return [...ids].sort().join(",");
  }

  function teamKey(players) {
    return teamKeyFromIds(players.map(player => player.id));
  }

  function matchupKeyFromIds(team1Ids, team2Ids) {
    return [
      teamKeyFromIds(team1Ids),
      teamKeyFromIds(team2Ids)
    ]
      .sort()
      .join(" VS ");
  }

  function buildHistoryStats(approvedHistory) {
    const stats = {
      teammateCounts: new Map(),
      opponentCounts: new Map(),
      exactTeamCounts: new Map(),
      exactMatchupCounts: new Map(),
      rotationCounts: new Map(),
      lastRotationIds: new Set()
    };

    if (!Array.isArray(approvedHistory)) {
      return stats;
    }

    approvedHistory.forEach(formation => {
      const rotationIds = new Set([
        ...(Array.isArray(formation?.rotation) ? formation.rotation : []),
        ...(Array.isArray(formation?.rotationRoleIds) ? formation.rotationRoleIds : []),
        ...(Array.isArray(formation?.substitutePlayerIds) ? formation.substitutePlayerIds : [])
      ]);
      rotationIds.forEach(id => incrementMap(stats.rotationCounts, id));
      stats.lastRotationIds = rotationIds;
      const storedTeams = Array.isArray(formation?.teams)
        ? formation.teams
        : [];

      storedTeams.forEach(storedTeam => {
        const ids = idsFromStoredTeam(storedTeam);

        if (ids.length < 2) {
          return;
        }

        incrementMap(stats.exactTeamCounts, teamKeyFromIds(ids));

        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            incrementMap(stats.teammateCounts, pairKey(ids[i], ids[j]));
          }
        }
      });

      const matchups = Array.isArray(formation?.matchups)
        ? formation.matchups
        : [];

      matchups.forEach(matchup => {
        const team1Ids = idsFromStoredTeam(matchup.team1);
        const team2Ids = idsFromStoredTeam(matchup.team2);

        if (team1Ids.length === 0 || team2Ids.length === 0) {
          return;
        }

        incrementMap(
          stats.exactMatchupCounts,
          matchupKeyFromIds(team1Ids, team2Ids)
        );

        team1Ids.forEach(id1 => {
          team2Ids.forEach(id2 => {
            incrementMap(stats.opponentCounts, pairKey(id1, id2));
          });
        });
      });
    });

    return stats;
  }

  function teamHistoryScore(players, historyStats) {
    if (!historyStats) {
      return 0;
    }

    let score = 0;

    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const repeats =
          historyStats.teammateCounts.get(
            pairKey(players[i].id, players[j].id)
          ) || 0;

        score += repeats * TEAMMATE_REPEAT_WEIGHT;
      }
    }

    const exactRepeats =
      historyStats.exactTeamCounts.get(teamKey(players)) || 0;

    score += exactRepeats * EXACT_TEAM_REPEAT_WEIGHT;

    return score;
  }

  function matchupHistoryScore(team1, team2, historyStats) {
    if (!historyStats) {
      return 0;
    }

    let score = 0;

    team1.forEach(player1 => {
      team2.forEach(player2 => {
        const repeats =
          historyStats.opponentCounts.get(
            pairKey(player1.id, player2.id)
          ) || 0;

        score += repeats * OPPONENT_REPEAT_WEIGHT;
      });
    });

    const exactRepeats =
      historyStats.exactMatchupCounts.get(
        matchupKeyFromIds(
          team1.map(player => player.id),
          team2.map(player => player.id)
        )
      ) || 0;

    score += exactRepeats * EXACT_MATCHUP_REPEAT_WEIGHT;

    return score;
  }

  // ==================================================
  // GAME FORMAT
  // ==================================================

  function analyseFormat(playerCount, courts, teamSize) {
    const completeTeams = Math.floor(playerCount / teamSize);

    if (completeTeams < 2) {
      return {
        valid: false,
        score: Infinity,
        teamSize
      };
    }

    const individualRotation = playerCount % teamSize;
    const playableCourts = Math.min(
      Math.max(0, courts),
      Math.floor(completeTeams / 2)
    );
    const teamsPlaying = playableCourts * 2;
    const waitingTeams = completeTeams - teamsPlaying;
    const unusedCourts = Math.max(0, courts - playableCourts);

    const waitingPlayers = playerCount - teamsPlaying * teamSize - Math.min(individualRotation, teamsPlaying);
    const score = waitingPlayers * 10000 + unusedCourts * 1000 + waitingTeams * 10 + teamSize;

    return {
      valid: true,
      score,
      waitingPlayers,
      playersOnCourt: teamsPlaying * teamSize,
      teamSize,
      completeTeams,
      individualRotation,
      playableCourts,
      teamsPlaying,
      waitingTeams,
      unusedCourts
    };
  }

  function choosePlan(playerCount, courts, preference) {
    const plan3 = analyseFormat(playerCount, courts, 3);
    const plan4 = analyseFormat(playerCount, courts, 4);

    if (preference === "3") {
      if (!plan3.valid) {
        throw new Error("Not enough players for 3v3.");
      }

      return plan3;
    }

    if (preference === "4") {
      if (!plan4.valid) {
        throw new Error("At least 8 players are required for 4v4.");
      }

      return plan4;
    }

    if (!plan3.valid && !plan4.valid) {
      throw new Error("Not enough players to create two teams.");
    }

    if (!plan4.valid) {
      return { ...plan3, autoAssignRotation: true };
    }

    if (!plan3.valid) {
      return { ...plan4, autoAssignRotation: true };
    }

    // Auto treats attached substitutes as in-game rotation, rather than
    // penalizing them like people who must wait for another match.
    const plans = [plan3, plan4].sort((a, b) =>
      a.waitingPlayers - b.waitingPlayers ||
      a.unusedCourts - b.unusedCourts ||
      a.waitingTeams - b.waitingTeams ||
      b.playersOnCourt - a.playersOnCourt ||
      a.teamSize - b.teamSize);
    return { ...plans[0], autoAssignRotation: true };
  }

  // ==================================================
  // ROTATION PLAYER SELECTION
  // ==================================================

  function rotationCandidateScore(allPlayers, rotationPlayers) {
    const rotationIds =
      new Set(
        rotationPlayers.map(player => player.id)
      );

    const remaining =
      allPlayers.filter(
        player => !rotationIds.has(player.id)
      );

    const originalCounts =
      categoryCounts(allPlayers);

    const remainingCounts =
      categoryCounts(remaining);

    let score = 0;

    rotationPlayers.forEach(player => {
      if (player.category === "Kids") {
        score += 1000;
      } else if (player.category === "U14") {
        score += 120;
      }
    });

    CATEGORY_ORDER.forEach(category => {
      const before = originalCounts[category];
      const after = remainingCounts[category];

      if (before > 0 && after === 0) {
        score += 100;
      } else if (after === 1) {
        score += 35;
      }
    });

    // Do not make the active teams much stronger or weaker by removing outliers.
    score +=
      Math.abs(
        averageSkill(allPlayers) -
        averageSkill(remaining)
      ) * 30;

    return score;
  }

  function selectRotationPlayers(players, rotationCount, historyStats) {
    if (rotationCount === 0) {
      return [];
    }

    // First minimize consecutive rotation roles, then total past roles.
    // Restrict to the optimal history tiers before sampling so sampling can
    // never reselect a previous substitute when enough fresh players exist.
    const allPlayers = players;
    const rank = player => [historyStats?.lastRotationIds.has(player.id) ? 1 : 0,
      historyStats?.rotationCounts.get(player.id) || 0];
    const compare = (a, b) => a[0] - b[0] || a[1] - b[1];
    const ranked = [...players].sort((a, b) => compare(rank(a), rank(b)));
    const cutoff = rank(ranked[rotationCount - 1]);
    const mandatory = players.filter(player => compare(rank(player), cutoff) < 0);
    players = players.filter(player => compare(rank(player), cutoff) === 0);
    rotationCount -= mandatory.length;

    let candidates;

    // Rotation count is at most 3.
    // Enumerate combinations when practical, sample otherwise.
    const approximateCombinationCount =
      rotationCount === 1
        ? players.length
        : rotationCount === 2
          ? (
              players.length *
              (players.length - 1)
            ) / 2
          : (
              players.length *
              (players.length - 1) *
              (players.length - 2)
            ) / 6;

    if (approximateCombinationCount <= 3500) {
      candidates =
        combinations(
          players,
          rotationCount
        );
    } else {
      candidates = [];

      const seen =
        new Set();

      const sampleLimit =
        1200;

      for (
        let i = 0;
        i < sampleLimit;
        i++
      ) {
        const candidate =
          shuffle(players)
            .slice(
              0,
              rotationCount
            );

        const key =
          candidate
            .map(player => player.id)
            .sort()
            .join("|");

        if (!seen.has(key)) {
          seen.add(key);
          candidates.push(candidate);
        }
      }
    }

    let best = null;
    let bestScore = Infinity;

    candidates.forEach(candidate => {
      candidate = [...mandatory, ...candidate];
      const score =
        rotationCandidateScore(
          allPlayers,
          candidate
        );

      if (
        score < bestScore ||
        (
          score === bestScore &&
          Math.random() < 0.25
        )
      ) {
        best = candidate;
        bestScore = score;
      }
    });

    return (
      best ||
      mandatory.concat(shuffle(players)
        .slice(
          0,
          rotationCount
        ))
    );
  }

  // ==================================================
  // AGE QUALITY
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
      player1.category === "Kids";

    const player2Kids =
      player2.category === "Kids";

    if (
      player1Kids !==
      player2Kids
    ) {
      const olderPlayer =
        player1Kids
          ? player2
          : player1;

      if (
        olderPlayer.category === "U14"
      ) {
        score += 10;
      } else if (
        olderPlayer.category === "U16"
      ) {
        score += 300;
      } else if (
        olderPlayer.category === "U18"
      ) {
        score += 1500;
      } else if (
        olderPlayer.category === "18+"
      ) {
        score += 3000;
      }
    }

    return score;
  }

  function gamePoolAgeScore(players) {
    if (players.length <= 1) {
      return 0;
    }

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
      new Set(
        players.map(
          player => player.category
        )
      );

    if (categories.size > 2) {
      score +=
        (categories.size - 2) *
        120;
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
  // GAME POOL SPLITTING
  // ==================================================

  function teamCompositionScore(
    team1,
    team2
  ) {
    const counts1 =
      categoryCounts(team1);

    const counts2 =
      categoryCounts(team2);

    let score = 0;

    CATEGORY_ORDER.forEach(
      category => {
        let weight = 40;

        if (
          category === "Kids"
        ) {
          weight = 220;
        } else if (
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

    let score = 0;

    score +=
      Math.abs(
        elite1 - elite2
      ) * 120;

    if (elite1 > 1) {
      score +=
        (elite1 - 1) *
        250;
    }

    if (elite2 > 1) {
      score +=
        (elite2 - 1) *
        250;
    }

    score +=
      Math.abs(
        strong1 - strong2
      ) * 50;

    return score;
  }

  function splitGamePool(
    pool,
    teamSize,
    historyStats
  ) {
    if (
      pool.length !==
      teamSize * 2
    ) {
      throw new Error(
        "Invalid game pool size."
      );
    }

    // Only choose combinations containing pool[0].
    // This removes mirrored duplicates.
    const rest =
      pool.slice(1);

    const team1Remainders =
      combinations(
        rest,
        teamSize - 1
      );

    let best = null;
    let bestScore = Infinity;

    team1Remainders.forEach(
      remainder => {
        const team1 = [
          pool[0],
          ...remainder
        ];

        const team1Ids =
          new Set(
            team1.map(
              player => player.id
            )
          );

        const team2 =
          pool.filter(
            player =>
              !team1Ids.has(
                player.id
              )
          );

        let score =
          Math.abs(
            sumSkill(team1) -
            sumSkill(team2)
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

        score +=
          teamHistoryScore(
            team1,
            historyStats
          );

        score +=
          teamHistoryScore(
            team2,
            historyStats
          );

        score +=
          matchupHistoryScore(
            team1,
            team2,
            historyStats
          );

        if (
          score < bestScore ||
          (
            score === bestScore &&
            Math.random() < 0.25
          )
        ) {
          bestScore = score;

          best = {
            team1,
            team2,
            score
          };
        }
      }
    );

    return best;
  }

  // ==================================================
  // SPECIAL KIDS COURT
  // ==================================================

  function findSpecialKidsCourt(
    players,
    historyStats
  ) {
    const kids =
      players.filter(
        player =>
          player.category === "Kids"
      );

    if (
      kids.length < 2 ||
      kids.length >= 6
    ) {
      return null;
    }

    const fillersNeeded =
      6 - kids.length;

    // U14 is preferred.
    // Lower-skilled U16 players are the fallback.
    const eligibleFillers =
      players
        .filter(
          player =>
            player.category === "U14" ||
            player.category === "U16"
        )
        .sort(
          (a, b) => {
            const categoryDifference =
              categoryRank(a.category) -
              categoryRank(b.category);

            if (
              categoryDifference !== 0
            ) {
              return categoryDifference;
            }

            return (
              a.skill -
              b.skill
            );
          }
        );

    if (
      eligibleFillers.length <
      fillersNeeded
    ) {
      return null;
    }

    // Bound combinatorial growth for very large rosters
    // while keeping the best filler pool.
    const candidateFillers =
      eligibleFillers.slice(
        0,
        14
      );

    const fillerCombinations =
      combinations(
        candidateFillers,
        fillersNeeded,
        3000
      );

    let bestResult = null;
    let bestScore = Infinity;

    fillerCombinations.forEach(
      fillers => {
        let score = 0;

        fillers.forEach(
          player => {
            if (
              player.category === "U16"
            ) {
              score += 1200;
            }

            score +=
              player.skill * 20;

            if (
              player.skill === 5
            ) {
              score += 250;
            } else if (
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
            3,
            historyStats
          );

        score += split.score;

        if (
          score < bestScore ||
          (
            score === bestScore &&
            Math.random() < 0.25
          )
        ) {
          bestScore = score;

          bestResult = {
            players: pool,
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
  // AGE-ORDERED CANDIDATE CREATION
  // ==================================================

  function createAgeOrderedPlayers(
    players
  ) {
    return [...players]
      .map(
        player => ({
          player,

          // Enough noise to explore neighboring categories,
          // but not enough to freely mix ages.
          key:
            categoryRank(
              player.category
            ) +
            (
              Math.random() -
              0.5
            ) * 1.10 +
            (
              Math.random() -
              0.5
            ) *
            0.04 *
            player.skill
        })
      )
      .sort(
        (a, b) =>
          a.key - b.key
      )
      .map(
        item => item.player
      );
  }

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
        type: "game",
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
        type: "waiting",
        size:
          plan.teamSize
      });
    }

    return descriptors;
  }

  // ==================================================
  // WAITING TEAM QUALITY
  // ==================================================

  function waitingTeamInternalScore(
    players
  ) {
    if (
      players.length === 0
    ) {
      return 0;
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

    const categories =
      new Set(
        players.map(
          player =>
            player.category
        )
      );

    const elite =
      players.filter(
        player =>
          player.skill === 5
      ).length;

    let score =
      spread * 35;

    if (
      categories.size > 2
    ) {
      score +=
        (categories.size - 2) *
        30;
    }

    if (
      elite > 1
    ) {
      score +=
        (elite - 1) *
        120;
    }

    return score;
  }

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
          player.category === "Kids"
      ).length;

    score += kids * 20;

    return score;
  }

  function waitingTeamsBalanceScore(
    groups,
    historyStats
  ) {
    if (
      groups.length === 0
    ) {
      return 0;
    }

    let score = 0;

    groups.forEach(
      group => {
        score +=
          waitingTeamInternalScore(
            group.players
          );

        score +=
          teamHistoryScore(
            group.players,
            historyStats
          );
      }
    );

    // Keep waiting teams comparable in strength and age.
    // With a long waiting queue, age matching is softened
    // so teams remain age-coherent themselves.
    for (
      let i = 0;
      i < groups.length;
      i++
    ) {
      for (
        let j = i + 1;
        j < groups.length;
        j++
      ) {
        const team1 =
          groups[i].players;

        const team2 =
          groups[j].players;

        score +=
          Math.abs(
            sumSkill(team1) -
            sumSkill(team2)
          ) * 35;

        const agePairWeight =
          groups.length <= 3
            ? 110
            : 45;

        score +=
          Math.abs(
            averageAgeRank(team1) -
            averageAgeRank(team2)
          ) *
          agePairWeight;

        const counts1 =
          categoryCounts(team1);

        const counts2 =
          categoryCounts(team2);

        CATEGORY_ORDER.forEach(
          category => {
            let weight = 30;

            if (
              category === "Kids"
            ) {
              weight = 150;
            } else if (
              category === "U14"
            ) {
              weight = 60;
            } else if (
              category === "U18" ||
              category === "18+"
            ) {
              weight = 70;
            }

            score +=
              Math.abs(
                counts1[category] -
                counts2[category]
              ) * weight;
          }
        );
      }
    }

    return score;
  }

  function rebalanceWaitingGroups(
    waitingGroups,
    historyStats
  ) {
    if (
      waitingGroups.length < 2
    ) {
      return cloneGroups(
        waitingGroups
      );
    }

    const groups =
      cloneGroups(
        waitingGroups
      );

    let currentScore =
      waitingTeamsBalanceScore(
        groups,
        historyStats
      );

    const maxPasses =
      groups.length >= 9
        ? 3
        : groups.length >= 6
          ? 5
          : MAX_WAITING_REBALANCE_PASSES;

    for (
      let pass = 0;
      pass < maxPasses;
      pass++
    ) {
      let bestSwap = null;
      let bestScore =
        currentScore;

      for (
        let i = 0;
        i < groups.length;
        i++
      ) {
        for (
          let j = i + 1;
          j < groups.length;
          j++
        ) {
          for (
            let a = 0;
            a < groups[i].players.length;
            a++
          ) {
            for (
              let b = 0;
              b < groups[j].players.length;
              b++
            ) {
              const first =
                groups[i].players[a];

              const second =
                groups[j].players[b];

              // Never make age spread obviously worse
              // just to chase skill balance.
              const beforeAge =
                gamePoolAgeScore(
                  groups[i].players
                ) +
                gamePoolAgeScore(
                  groups[j].players
                );

              groups[i].players[a] =
                second;

              groups[j].players[b] =
                first;

              const afterAge =
                gamePoolAgeScore(
                  groups[i].players
                ) +
                gamePoolAgeScore(
                  groups[j].players
                );

              if (
                afterAge <=
                beforeAge + 80
              ) {
                const score =
                  waitingTeamsBalanceScore(
                    groups,
                    historyStats
                  );

                if (
                  score <
                  bestScore
                ) {
                  bestScore =
                    score;

                  bestSwap = {
                    i,
                    j,
                    a,
                    b
                  };
                }
              }

              groups[i].players[a] =
                first;

              groups[j].players[b] =
                second;
            }
          }
        }
      }

      if (!bestSwap) {
        break;
      }

      const first =
        groups[
          bestSwap.i
        ].players[
          bestSwap.a
        ];

      groups[
        bestSwap.i
      ].players[
        bestSwap.a
      ] =
        groups[
          bestSwap.j
        ].players[
          bestSwap.b
        ];

      groups[
        bestSwap.j
      ].players[
        bestSwap.b
      ] =
        first;

      currentScore =
        bestScore;
    }

    groups.forEach(
      group => {
        group.averageAge =
          averageAgeRank(
            group.players
          );
      }
    );

    return groups;
  }

  // ==================================================
  // ADAPTIVE SEARCH
  // ==================================================

  function searchAttemptCount(
    playerCount,
    plan
  ) {
    // The previous optimizer always ran
    // 5,000 expensive full candidates.
    //
    // This adaptive budget keeps quality high
    // while scaling safely on phones.

    let attempts;

    if (
      playerCount <= 12
    ) {
      attempts = 700;
    } else if (
      playerCount <= 18
    ) {
      attempts = 550;
    } else if (
      playerCount <= 24
    ) {
      attempts = 420;
    } else if (
      playerCount <= 30
    ) {
      attempts = 320;
    } else if (
      playerCount <= 40
    ) {
      attempts = 240;
    } else if (
      playerCount <= 54
    ) {
      attempts = 180;
    } else {
      attempts = 140;
    }

    // 4v4 split evaluation is more expensive than 3v3.
    if (
      plan.teamSize === 4
    ) {
      attempts =
        Math.round(
          attempts * 0.75
        );
    }

    return Math.max(
      100,
      attempts
    );
  }

  function insertTopCandidate(
    topCandidates,
    candidate
  ) {
    topCandidates.push(
      candidate
    );

    topCandidates.sort(
      (a, b) =>
        a.score - b.score
    );

    if (
      topCandidates.length >
      TOP_CANDIDATES_TO_REFINE
    ) {
      topCandidates.length =
        TOP_CANDIDATES_TO_REFINE;
    }
  }

  function createCandidateStructure(
    players,
    plan,
    historyStats
  ) {
    let orderedPlayers;

    // A small amount of fully random exploration
    // helps alternatives without making it the normal path.
    if (
      Math.random() < 0.06
    ) {
      orderedPlayers =
        shuffle(players);
    } else {
      orderedPlayers =
        createAgeOrderedPlayers(
          players
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
        descriptor.type === "game"
      ) {
        const split =
          splitGamePool(
            group,
            plan.teamSize,
            historyStats
          );

        score +=
          gamePoolAgeScore(
            group
          );

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
      } else {
        const waitingGroup = {
          players:
            group,

          averageAge:
            averageAgeRank(
              group
            ),

          teamSize:
            plan.teamSize
        };

        // Cheap per-team scoring during broad search.
        score +=
          waitingTeamScore(
            group
          );

        waitingGroups.push(
          waitingGroup
        );
      }
    }

    // One global waiting score is cheap.
    // Expensive swap rebalancing is deliberately
    // postponed until only the best candidates remain.
    score +=
      waitingTeamsBalanceScore(
        waitingGroups,
        historyStats
      );

    return {
      score,
      gameGroups,
      waitingGroups
    };
  }

  function refineCandidate(
    candidate,
    historyStats
  ) {
    const refined = {
      score: 0,

      gameGroups:
        candidate.gameGroups.map(
          group => ({
            ...group,

            players: [
              ...group.players
            ],

            split: {
              ...group.split,

              team1: [
                ...group.split.team1
              ],

              team2: [
                ...group.split.team2
              ]
            }
          })
        ),

      waitingGroups:
        rebalanceWaitingGroups(
          candidate.waitingGroups,
          historyStats
        )
    };

    refined.gameGroups.forEach(
      group => {
        refined.score +=
          gamePoolAgeScore(
            group.players
          );

        refined.score +=
          group.split.score;
      }
    );

    refined.score +=
      waitingTeamsBalanceScore(
        refined.waitingGroups,
        historyStats
      );

    return refined;
  }

  function createSessionStructure(
    players,
    plan,
    historyStats
  ) {
    const attempts =
      searchAttemptCount(
        players.length,
        plan
      );

    const topCandidates = [];

    const startedAt =
      Date.now();

    // A time budget prevents slow phones
    // from locking the browser main thread.
    //
    // Fast devices may use the full attempt budget.
    // Slower devices stop safely after a useful
    // minimum amount of exploration.
    const broadSearchTimeBudgetMs =
      players.length <= 24
        ? 180
        : players.length <= 40
          ? 150
          : 130;

    for (
      let attempt = 0;
      attempt < attempts;
      attempt++
    ) {
      if (
        attempt >=
          MIN_BROAD_SEARCH_ATTEMPTS &&
        Date.now() -
          startedAt >=
          broadSearchTimeBudgetMs
      ) {
        break;
      }

      const candidate =
        createCandidateStructure(
          players,
          plan,
          historyStats
        );

      if (candidate) {
        insertTopCandidate(
          topCandidates,
          candidate
        );
      }
    }

    if (
      topCandidates.length === 0
    ) {
      throw new Error(
        "Could not create balanced teams."
      );
    }

    let best = null;
    let bestScore = Infinity;

    const refineCount =
      plan.waitingTeams >= 9
        ? 2
        : plan.waitingTeams >= 6
          ? 3
          : TOP_CANDIDATES_TO_REFINE;

    topCandidates
      .slice(
        0,
        refineCount
      )
      .forEach(
        candidate => {
          const refined =
            refineCandidate(
              candidate,
              historyStats
            );

          if (
            refined.score <
              bestScore ||
            (
              refined.score ===
                bestScore &&
              Math.random() < 0.25
            )
          ) {
            best =
              refined;

            bestScore =
              refined.score;
          }
        }
      );

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
  // TEAM OBJECTS
  // ==================================================

  // Optimize all regular teams together. Skill range and variance take
  // precedence over composition, which takes precedence over repeat history.
  function createGloballyBalancedStructure(players, plan, historyStats) {
    const size = plan.teamSize;
    const count = players.length / size;
    const describe = team => {
      const ages = CATEGORY_ORDER.map(category =>
        team.filter(player => player.category === category).length);
      const skills = [1, 2, 3, 4, 5].map(skill =>
        team.filter(player => player.skill === skill).length);
      return {
        total: sumSkill(team),
        composition: ages.reduce((sum, n) => sum + n * n, 0) * 2 +
          skills.reduce((sum, n) => sum + n * n, 0) +
          Math.max(0, skills[4] - 1) * 4,
        history: teamHistoryScore(team, historyStats)
      };
    };
    const objective = stats => {
      const totals = stats.map(team => team.total);
      return [
        Math.max(...totals) - Math.min(...totals),
        totals.reduce((sum, n) => sum + n * n, 0),
        stats.reduce((sum, team) => sum + team.composition, 0),
        stats.reduce((sum, team) => sum + team.history, 0)
      ];
    };
    const better = (a, b) => {
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return a[i] < b[i];
      }
      return false;
    };
    let bestTeams;
    let bestScore;
    const started = Date.now();
    for (let attempt = 0; attempt < 16; attempt++) {
      const teams = Array.from({ length: count }, () => []);
      const ordered = shuffle(players).sort((a, b) => b.skill - a.skill);
      ordered.forEach(player => {
        const available = shuffle(teams.filter(team => team.length < size));
        available.sort((a, b) => sumSkill(a) - sumSkill(b) ||
          (describe([...a, player]).composition - describe(a).composition) -
          (describe([...b, player]).composition - describe(b).composition));
        available[0].push(player);
      });
      let stats = teams.map(describe);
      let score = objective(stats);
      for (let pass = 0; pass < 20; pass++) {
        let move = null;
        let nextScore = score;
        for (let a = 0; a < count; a++) {
          for (let b = a + 1; b < count; b++) {
            for (let i = 0; i < size; i++) {
              for (let j = 0; j < size; j++) {
                [teams[a][i], teams[b][j]] = [teams[b][j], teams[a][i]];
                const sa = describe(teams[a]);
                const sb = describe(teams[b]);
                const candidate = stats.slice();
                candidate[a] = sa;
                candidate[b] = sb;
                const value = objective(candidate);
                if (better(value, nextScore)) {
                  nextScore = value;
                  move = { a, b, i, j, sa, sb };
                }
                [teams[a][i], teams[b][j]] = [teams[b][j], teams[a][i]];
              }
            }
          }
        }
        // Equal-total exchanges can improve composition where any single
        // swap would temporarily worsen the skill balance (5+1 vs 3+3).
        if (!move && size >= 3 && Date.now() - started <= 300) {
          for (let a = 0; a < count; a++) {
            for (let b = a + 1; b < count; b++) {
              for (let i = 0; i < size; i++) {
                for (let k = i + 1; k < size; k++) {
                  for (let j = 0; j < size; j++) {
                    for (let l = j + 1; l < size; l++) {
                      if (teams[a][i].skill + teams[a][k].skill !==
                          teams[b][j].skill + teams[b][l].skill) continue;
                      [teams[a][i], teams[b][j]] = [teams[b][j], teams[a][i]];
                      [teams[a][k], teams[b][l]] = [teams[b][l], teams[a][k]];
                      const sa = describe(teams[a]);
                      const sb = describe(teams[b]);
                      const candidate = stats.slice();
                      candidate[a] = sa;
                      candidate[b] = sb;
                      const value = objective(candidate);
                      if (better(value, nextScore)) {
                        nextScore = value;
                        move = { a, b, i, j, k, l, sa, sb };
                      }
                      [teams[a][i], teams[b][j]] = [teams[b][j], teams[a][i]];
                      [teams[a][k], teams[b][l]] = [teams[b][l], teams[a][k]];
                    }
                  }
                }
              }
            }
          }
        }
        if (!move) break;
        const { a, b, i, j, sa, sb } = move;
        [teams[a][i], teams[b][j]] = [teams[b][j], teams[a][i]];
        if (move.k !== undefined) {
          [teams[a][move.k], teams[b][move.l]] = [teams[b][move.l], teams[a][move.k]];
        }
        stats[a] = sa;
        stats[b] = sb;
        score = nextScore;
        if (Date.now() - started > 300) break;
      }
      if (!bestScore || better(score, bestScore)) {
        bestScore = score;
        bestTeams = teams.map(team => [...team]);
      }
      if (Date.now() - started > 300) break;
    }

    // Pair only after every team has been balanced. Pair history can no
    // longer create separate strength tiers on different courts.
    const remaining = shuffle(bestTeams);
    const gameGroups = [];
    for (let court = 0; court < plan.playableCourts; court++) {
      const team1 = remaining.shift();
      let opponent = 0;
      for (let i = 1; i < remaining.length; i++) {
        if (matchupHistoryScore(team1, remaining[i], historyStats) <
            matchupHistoryScore(team1, remaining[opponent], historyStats)) opponent = i;
      }
      const team2 = remaining.splice(opponent, 1)[0];
      gameGroups.push({ split: { team1, team2 } });
    }
    return { gameGroups, waitingGroups: remaining.map(players => ({ players })) };
  }

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

      players: [
        ...players
      ],

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
    // A, B, ... Z, AA, AB ...

    let value =
      index + 1;

    let label = "";

    while (
      value > 0
    ) {
      value--;

      label =
        String.fromCharCode(
          65 +
          (
            value % 26
          )
        ) +
        label;

      value =
        Math.floor(
          value / 26
        );
    }

    return label;
  }

  // ==================================================
  // STANDARD SESSION BUILD
  // ==================================================

  function buildStandardSession(
    players,
    plan,
    teamIndexStart,
    courtOffset,
    historyStats
  ) {
    const rotationPlayers =
      selectRotationPlayers(
        players,
        plan.individualRotation,
        historyStats
      );

    const rotationIds =
      new Set(
        rotationPlayers.map(
          player => player.id
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
      createGloballyBalancedStructure(
        teamPlayers,
        plan,
        historyStats
      );

    const courtGames = [];
    const teams = [];
    const waitingTeams = [];

    let teamIndex =
      teamIndexStart;

    structure.gameGroups.forEach(
      (group, courtIndex) => {
        const team1 =
          createTeamObject(
            group.split.team1,
            `Team ${teamLetter(teamIndex)}`,
            `T${teamIndex + 1}`
          );

        teamIndex++;

        const team2 =
          createTeamObject(
            group.split.team2,
            `Team ${teamLetter(teamIndex)}`,
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
            `Team ${teamLetter(teamIndex)}`,
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

    if (plan.autoAssignRotation) {
      const onCourt = new Set(courtGames.flatMap(game => [game.team1.id, game.team2.id]));
      for (const player of [...rotationPlayers]) {
        let available = teams.filter(team => team.players.length === team.teamSize);
        const active = available.filter(team => onCourt.has(team.id));
        if (active.length) available = active;
        if (!available.length) break;
        const score = team => {
          const averages = teams.map(candidate => candidate === team
            ? (candidate.totalSkill + player.skill) / (candidate.players.length + 1) : candidate.averageSkill);
          return [Math.max(...averages) - Math.min(...averages),
            averages.reduce((sum, value) => sum + Math.pow(value - averageSkill(players), 2), 0),
            team.players.filter(member => member.category === player.category).length,
            team.players.filter(member => member.skill === player.skill).length];
        };
        const compare = (a, b) => {
          for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
          return 0;
        };
        available = shuffle(available).sort((a, b) => compare(score(a), score(b)));
        const team = available[0];
        team.players.push(player);
        team.substituteIds = [player.id];
        team.totalSkill += player.skill;
        team.averageSkill = team.totalSkill / team.players.length;
        team.averageAgeRank = averageAgeRank(team.players);
        rotationPlayers.splice(rotationPlayers.findIndex(candidate => candidate.id === player.id), 1);
      }
      plan.individualRotation = rotationPlayers.length;
      plan.assignedSubstitutes = teams.reduce((sum, team) => sum + (team.substituteIds?.length || 0), 0);
      plan.waitingPlayers = waitingTeams.reduce((sum, team) => sum + team.players.length, 0) + rotationPlayers.length;
    }

    return { teams, courtGames, waitingTeams, rotationPlayers, nextTeamIndex: teamIndex };
  }

  function generateStandardSession(
    selectedPlayers,
    courts,
    formatPreference,
    historyStats
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
        0,
        historyStats
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
    courts,
    historyStats
  ) {
    const kidsCourt =
      findSpecialKidsCourt(
        selectedPlayers,
        historyStats
      );

    if (!kidsCourt) {
      return null;
    }

    const specialIds =
      new Set(
        kidsCourt.players.map(
          player => player.id
        )
      );

    const remainingPlayers =
      selectedPlayers.filter(
        player =>
          !specialIds.has(
            player.id
          )
      );

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

        specialKidsCourt:
          true,

        team1:
          teamA,

        team2:
          teamB
      }
    ];

    const allTeams = [
      teamA,
      teamB
    ];

    let waitingTeams = [];

    let rotationPlayers = [];

    let remainingPlan = null;

    const remainingCourts =
      Math.max(
        0,
        courts - 1
      );

    // Even with no remaining court,
    // complete waiting teams are preferable to
    // treating everybody as individual rotation players.
    if (
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
          1,
          historyStats
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
    } else {
      rotationPlayers = [
        ...remainingPlayers
      ];
    }

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
        valid:
          true,

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
          Math.max(
            0,
            courts -
            playableCourts
          )
      },

      teams:
        allTeams,

      courtGames,

      waitingTeams,

      rotationPlayers
    };
  }

  // ==================================================
  // OPTIONAL ADULT-ONLY SESSION
  // ==================================================

  function generateKidsOnlySession(selectedPlayers, courts, formatPreference, historyStats, options) {
    const kids = selectedPlayers.filter(player => player.category === "Kids");
    const others = selectedPlayers.filter(player => player.category !== "Kids");
    const kidsPlan = choosePlan(kids.length, 1, "3");
    const kidsResult = buildStandardSession(kids, kidsPlan, 0, 0, historyStats);
    kidsResult.courtGames.forEach(game => { game.specialKidsCourt = true; });

    let otherResult = null;
    if (others.length >= 6) {
      const adultCount = others.filter(player => player.category === "18+").length;
      if (options.adultOnly === true && adultCount >= 6) {
        otherResult = generateAdultOnlySession(others, courts - 1, formatPreference,
          historyStats, Number.isInteger(options.maxAdultCourts) ? options.maxAdultCourts : 1);
      } else {
        const preference = formatPreference === "4" && others.length < 8 ? "3" : formatPreference;
        otherResult = generateStandardSession(others, courts - 1, preference, historyStats);
      }
      otherResult.teams.forEach((team, index) => {
        const teamIndex = kidsResult.teams.length + index;
        team.id = `T${teamIndex + 1}`;
        team.name = `Team ${teamLetter(teamIndex)}`;
      });
      otherResult.courtGames.forEach(game => { game.court++; });
    }

    const teams = [...kidsResult.teams, ...(otherResult?.teams || [])];
    const courtGames = [...kidsResult.courtGames, ...(otherResult?.courtGames || [])];
    const waitingTeams = [...kidsResult.waitingTeams, ...(otherResult?.waitingTeams || [])];
    const rotationPlayers = [...kidsResult.rotationPlayers, ...(otherResult?.rotationPlayers || others)];
    const formats = [...new Set(teams.map(team => `${team.teamSize} vs ${team.teamSize}`))];
    return {
      plan: {
        valid: true,
        specialKidsCourt: true,
        adultOnlyActive: Boolean(otherResult?.plan.adultOnlyActive),
        adultCourtsUsed: otherResult?.plan.adultCourtsUsed || 0,
        formatLabel: formats.join(" + "),
        mixedFormats: formats.length > 1,
        teamSize: formats.length === 1 ? 3 : null,
        completeTeams: teams.length,
        playableCourts: courtGames.length,
        waitingTeams: waitingTeams.length,
        individualRotation: rotationPlayers.length,
        assignedSubstitutes: teams.reduce((sum, team) => sum + (team.substituteIds?.length || 0), 0),
        waitingPlayers: waitingTeams.reduce((sum, team) => sum + team.players.length, 0) + rotationPlayers.length,
        unusedCourts: courts - courtGames.length
      },
      teams, courtGames, waitingTeams, rotationPlayers
    };
  }

  function generateAdultOnlySession(
    selectedPlayers,
    courts,
    formatPreference,
    historyStats,
    maxAdultCourts
  ) {
    const adults = selectedPlayers.filter(
      player => player.category === "18+"
    );

    const younger = selectedPlayers.filter(
      player => player.category !== "18+"
    );

    const adultCourtLimit = Math.min(
      courts,
      Math.max(1, maxAdultCourts)
    );

    // Six adults can always play 3v3, including when 4v4 was
    // requested but the adult pool cannot form two 4-player teams.
    const adultPreference =
      formatPreference === "4" && adults.length < 8
        ? "3"
        : formatPreference;

    const adultPlan = choosePlan(
      adults.length,
      adultCourtLimit,
      adultPreference
    );

    const adultResult = buildStandardSession(
      adults,
      adultPlan,
      0,
      0,
      historyStats
    );

    adultResult.courtGames.forEach(
      game => { game.adultOnly = true; }
    );

    const adultCourtsUsed = adultPlan.playableCourts;
    const youngerCourts = courts - adultCourtsUsed;

    let youngerResult = null;

    if (younger.length >= 6) {
      if (!youngerResult) {
        const youngerPreference =
          formatPreference === "4" && younger.length < 8
            ? "3"
            : formatPreference;

        youngerResult = generateStandardSession(
          younger,
          youngerCourts,
          youngerPreference,
          historyStats
        );
      }

      youngerResult.teams.forEach((team, index) => {
        const teamIndex = adultResult.teams.length + index;
        team.id = `T${teamIndex + 1}`;
        team.name = `Team ${teamLetter(teamIndex)}`;
      });

      youngerResult.courtGames.forEach(game => {
        game.court += adultCourtsUsed;
      });
    }

    const teams = [
      ...adultResult.teams,
      ...(youngerResult?.teams || [])
    ];

    const courtGames = [
      ...adultResult.courtGames,
      ...(youngerResult?.courtGames || [])
    ];

    const waitingTeams = [
      ...adultResult.waitingTeams,
      ...(youngerResult?.waitingTeams || [])
    ];

    const rotationPlayers = [
      ...adultResult.rotationPlayers,
      ...(youngerResult?.rotationPlayers || younger)
    ];

    const formats = [
      ...new Set(
        teams.map(
          team => `${team.teamSize} vs ${team.teamSize}`
        )
      )
    ];

    const playableCourts = courtGames.length;

    return {
      plan: {
        valid: true,
        formatLabel: formats.join(" + "),
        mixedFormats: formats.length > 1,
        specialKidsCourt: Boolean(
          youngerResult?.plan?.specialKidsCourt
        ),
        adultOnlyActive: true,
        adultCourtsUsed,
        teamSize: formats.length === 1
          ? teams[0].teamSize
          : null,
        completeTeams: teams.length,
        playableCourts,
        waitingTeams: waitingTeams.length,
        individualRotation: rotationPlayers.length,
        assignedSubstitutes: teams.reduce((sum, team) => sum + (team.substituteIds?.length || 0), 0),
        waitingPlayers: waitingTeams.reduce((sum, team) => sum + team.players.length, 0) + rotationPlayers.length,
        unusedCourts: courts - playableCourts
      },
      teams,
      courtGames,
      waitingTeams,
      rotationPlayers
    };
  }

  // ==================================================
  // VALIDATION
  // ==================================================

  function validateInputs(
    selectedPlayers,
    courts,
    formatPreference
  ) {
    if (
      !Array.isArray(
        selectedPlayers
      )
    ) {
      throw new Error(
        "Invalid player list."
      );
    }

    if (
      selectedPlayers.length < 6
    ) {
      throw new Error(
        "Select at least 6 players."
      );
    }

    if (
      !Number.isInteger(courts) ||
      courts < 1
    ) {
      throw new Error(
        "At least one court is required."
      );
    }

    if (
      ![
        "auto",
        "3",
        "4"
      ].includes(
        formatPreference
      )
    ) {
      throw new Error(
        "Invalid game format."
      );
    }

    const ids =
      new Set();

    selectedPlayers.forEach(
      player => {
        if (
          !player ||
          !player.id ||
          !player.name
        ) {
          throw new Error(
            "One or more players are invalid."
          );
        }

        if (
          !CATEGORY_ORDER.includes(
            player.category
          )
        ) {
          throw new Error(
            `Unknown age category for ${player.name}.`
          );
        }

        if (
          !Number.isInteger(
            player.skill
          ) ||
          player.skill < 1 ||
          player.skill > 5
        ) {
          throw new Error(
            `Invalid skill value for ${player.name}.`
          );
        }

        if (
          ids.has(
            player.id
          )
        ) {
          throw new Error(
            `Duplicate player id: ${player.id}`
          );
        }

        ids.add(
          player.id
        );
      }
    );
  }

  // ==================================================
  // MAIN GENERATION
  // ==================================================

  function generate(
    selectedPlayers,
    courts,
    formatPreference,
    approvedHistory = [],
    options = {}
  ) {
    validateInputs(
      selectedPlayers,
      courts,
      formatPreference
    );

    const historyStats =
      buildHistoryStats(
        approvedHistory
      );

    const adultCount = selectedPlayers.filter(
      player => player.category === "18+"
    ).length;

    if (options.kidsOnly === true && selectedPlayers.filter(player => player.category === "Kids").length >= 6) {
      return generateKidsOnlySession(selectedPlayers, courts, formatPreference, historyStats, options);
    }

    if (options.adultOnly === true && adultCount >= 6) {
      const requestedMaximum = Number.isInteger(
        options.maxAdultCourts
      )
        ? options.maxAdultCourts
        : 1;

      return generateAdultOnlySession(
        selectedPlayers,
        courts,
        formatPreference,
        historyStats,
        requestedMaximum
      );
    }

    return generateStandardSession(
      selectedPlayers,
      courts,
      formatPreference,
      historyStats
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
