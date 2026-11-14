(function () {
  "use strict";

  function count(game) {
    return Number.isSafeInteger(game.gamesPlayed) && game.gamesPlayed > 0
      ? game.gamesPlayed : 0;
  }

  function lineupKey(ids) {
    return JSON.stringify([...ids].sort());
  }

  function totals(formations) {
    const players = new Map();
    const lineups = new Map();
    formations.forEach(formation => {
      (formation.matchups || []).forEach(game => {
        const played = count(game);
        [game.team1, game.team2].forEach(ids => {
          if (!Array.isArray(ids)) return;
          const key = lineupKey(ids);
          lineups.set(key, (lineups.get(key) || 0) + played);
          const participants = Array.isArray(game.participatingPlayerIds)
            ? ids.filter(id => game.participatingPlayerIds.includes(id)) : ids;
          new Set(participants).forEach(id => players.set(id, (players.get(id) || 0) + played));
        });
      });
    });
    return { players, lineups };
  }

  window.GameCounter = { count, lineupKey, totals };
})();
