(function () {
  "use strict";

  // Select whole teams within the existing court capacity and group boundaries.
  // Waiting teams keep their queue order; no player roster is rebuilt here.
  function plan(result, outcomes, mode, groupForTeam) {
    if (!["results", "waiting", "waiting-winners"].includes(mode)) throw new Error("Choose a championship format.");
    const buckets = new Map();
    const key = team => `${team.teamSize}|${groupForTeam(team)}`;
    result.courtGames.forEach(game => {
      const outcome = outcomes.find(item => item.court === game.court &&
        item.team1Id === game.team1.id && item.team2Id === game.team2.id);
      if (!outcome || ![game.team1.id, game.team2.id].includes(outcome.winnerTeamId)) {
        throw new Error("Record a winner for every court before continuing championship play.");
      }
      const group = key(game.team1);
      if (key(game.team2) !== group) throw new Error("These teams cannot share a court.");
      if (!buckets.has(group)) buckets.set(group, { courts: [], winners: [], losers: [], waiting: [] });
      const bucket = buckets.get(group);
      bucket.courts.push(game);
      bucket.winners.push(game.team1.id === outcome.winnerTeamId ? game.team1 : game.team2);
      bucket.losers.push(game.team1.id === outcome.winnerTeamId ? game.team2 : game.team1);
    });
    result.waitingTeams.forEach(team => buckets.get(key(team))?.waiting.push(team));

    const games = [];
    let mixedPairs = 0;
    buckets.forEach(bucket => {
      const slots = bucket.courts.length * 2;
      const priority = mode === "waiting-winners" ? [...bucket.winners, ...bucket.waiting, ...bucket.losers] : mode === "waiting"
        ? [...bucket.waiting, ...bucket.losers, ...bucket.winners]
        : [...bucket.winners, ...bucket.losers];
      const crossCategory = bucket.courts[0].categoryMatchup && bucket.courts[0].category1 !== bucket.courts[0].category2;
      const selected = crossCategory
        ? [bucket.courts[0].category1, bucket.courts[0].category2].flatMap(category => priority.filter(team => team.requiredCategory === category).slice(0, bucket.courts.length))
        : priority.slice(0, slots);
      const ids = new Set(selected.map(team => team.id));
      const waiting = bucket.waiting.filter(team => ids.has(team.id));
      const losers = bucket.losers.filter(team => ids.has(team.id));
      const winners = bucket.winners.filter(team => ids.has(team.id));
      const pairs = [];
      if (crossCategory) {
        const left = selected.filter(team => team.requiredCategory === bucket.courts[0].category1);
        const right = selected.filter(team => team.requiredCategory === bucket.courts[0].category2);
        const role = team => bucket.waiting.includes(team) ? "waiting" : bucket.winners.includes(team) ? "winner" : "loser";
        const pairRank = (a, b) => {
          const roles = [role(a), role(b)];
          const target = mode === "waiting-winners" ? "winner" : "loser";
          if (mode !== "results" && roles.includes("waiting") && roles.includes(target)) return 0;
          if (role(a) === role(b)) return 1;
          return 2;
        };
        while (left.length) {
          let best = null;
          left.forEach((a, i) => right.forEach((b, j) => {
            const rank = pairRank(a, b);
            if (!best || rank < best.rank) best = { i, j, rank };
          }));
          if (best.rank === 2) mixedPairs++;
          pairs.push([left.splice(best.i, 1)[0], right.splice(best.j, 1)[0]]);
        }
      } else {
        if (mode === "waiting-winners") {
          while (waiting.length && winners.length) pairs.push([waiting.shift(), winners.shift()]);
        } else if (mode === "waiting") {
          while (waiting.length && losers.length) pairs.push([waiting.shift(), losers.shift()]);
        }
        for (const pool of [waiting, losers, winners]) {
          while (pool.length >= 2) pairs.push([pool.shift(), pool.shift()]);
        }
        const remainder = [...waiting, ...losers, ...winners];
        while (remainder.length >= 2) {
          mixedPairs++;
          pairs.push([remainder.shift(), remainder.shift()]);
        }
      }
      if (pairs.length !== bucket.courts.length) throw new Error("Not enough compatible teams to fill these courts.");
      pairs.forEach(([team1, team2], index) => {
        const { historyIndex, winnerTeamId, ...court } = bucket.courts[index];
        games.push({ ...court, team1, team2 });
      });
    });
    games.sort((a, b) => a.court - b.court);
    const playing = new Set(games.flatMap(game => [game.team1.id, game.team2.id]));
    const queue = [...result.waitingTeams, ...result.courtGames.flatMap(game => [game.team1, game.team2])];
    const waitingTeams = queue.filter((team, index) => !playing.has(team.id) && queue.findIndex(other => other.id === team.id) === index);
    return { games, waitingTeams, mixedPairs };
  }

  window.Championship = { plan };
})();
