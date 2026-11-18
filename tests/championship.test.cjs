const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'championship.js'), 'utf8'), context);
const { plan } = context.window.Championship;

function fixture(courts, waiting, group = 'regular', offset = 0, teamSize = 3) {
  const teams = Array.from({length:courts * 2 + waiting}, (_, i) => ({id:`${offset+i}`, name:`Team ${offset+i}`, group, teamSize}));
  const courtGames = Array.from({length:courts}, (_, i) => ({court:offset+i+1, teamSize, team1:teams[i*2], team2:teams[i*2+1]}));
  const outcomes = courtGames.map(game => ({court:game.court, team1Id:game.team1.id, team2Id:game.team2.id, winnerTeamId:game.team1.id}));
  return {teams, courtGames, waitingTeams:teams.slice(courts*2), outcomes};
}
const group = team => team.group;

test('the additional waiting-first mode admits the whole queue before winners, with older waiting teams kept first next time', () => {
  for (let courts=1;courts<=4;courts++) for (let count=0;count<=10;count++) {
    const input=fixture(courts,count);
    const next=plan(input,input.outcomes,'waiting-first-winners',group);
    const active=next.games.flatMap(game=>[game.team1.id,game.team2.id]);
    input.waitingTeams.slice(0,courts*2).forEach(team=>assert.ok(active.includes(team.id)));
    const winnerCount=input.outcomes.filter(game=>active.includes(game.winnerTeamId)).length;
    assert.equal(winnerCount,Math.min(courts,Math.max(0,courts*2-count)));
    assert.equal(new Set([...active,...next.waitingTeams.map(team=>team.id)]).size,input.teams.length);
  }
  const input=fixture(2,6);
  const first=plan(input,input.outcomes,'waiting-first-winners',group);
  const remaining=input.waitingTeams.slice(4).map(team=>team.id);
  assert.deepEqual([...first.waitingTeams.slice(0,2).map(team=>team.id)],remaining);
  const outcomes=first.games.map(game=>({court:game.court,team1Id:game.team1.id,team2Id:game.team2.id,winnerTeamId:game.team1.id}));
  const second=plan({...input,courtGames:first.games,waitingTeams:first.waitingTeams},outcomes,'waiting-first-winners',group);
  remaining.forEach(id=>assert.ok(second.games.some(game=>[game.team1.id,game.team2.id].includes(id))));
});

test('mixed-category teams can continue every championship mode without being treated as opposing pure categories', () => {
  const input=fixture(2,4,'mixed-category-group');
  input.teams.forEach(team=>team.allowedCategories=['U18','18+']);
  input.courtGames.forEach(game=>Object.assign(game,{categoryMatchup:true,categoryMode:'mix',category1:'U18',category2:'18+'}));
  for(const mode of ['waiting-first-winners','waiting-winners','waiting','results']) {
    const next=plan(input,input.outcomes,mode,group);
    assert.equal(next.games.length,2);
    assert.equal(new Set(next.games.flatMap(game=>[game.team1.id,game.team2.id]).concat(next.waitingTeams.map(team=>team.id))).size,8);
  }
});

test('winners meet winners and losers meet losers when the counts allow it', () => {
  const input = fixture(2,0);
  const next = plan(input, input.outcomes, 'results', group);
  const winners = new Set(input.outcomes.map(game => game.winnerTeamId));
  assert.equal(next.games.length, 2);
  assert.equal(next.mixedPairs, 0);
  next.games.forEach(game => assert.equal(winners.has(game.team1.id), winners.has(game.team2.id)));
});

test('two waiting teams face losers while both winners rest', () => {
  const input = fixture(2,2);
  const next = plan(input, input.outcomes, 'waiting', group);
  const waiting = new Set(input.waitingTeams.map(team => team.id));
  const winners = new Set(input.outcomes.map(game => game.winnerTeamId));
  next.games.forEach(game => {
    assert.notEqual(waiting.has(game.team1.id), waiting.has(game.team2.id));
    assert.equal(winners.has(game.team1.id) || winners.has(game.team2.id), false);
  });
  assert.deepEqual([...next.waitingTeams.map(team => team.id)].sort(), [...winners].sort());
});

test('waiting teams face winners and winners stay on court even when the queue is long', () => {
  for (const count of [0,1,2,5,8]) {
    const input = fixture(2,count);
    const next = plan(input,input.outcomes,'waiting-winners',group);
    const winners = new Set(input.outcomes.map(game=>game.winnerTeamId));
    const active = next.games.flatMap(game=>[game.team1.id,game.team2.id]);
    winners.forEach(id=>assert.ok(active.includes(id)));
    if (count>=2) {
      assert.equal(next.games.filter(game=>winners.has(game.team1.id)!==winners.has(game.team2.id)).length,2);
      input.waitingTeams.slice(0,2).forEach(team=>assert.ok(active.includes(team.id)));
    }
    assert.equal(new Set(active.concat(next.waitingTeams.map(team=>team.id))).size,input.teams.length);
  }
});

test('every championship mode preserves selected cross-category opponents', () => {
  const input = fixture(2,4,'category-matchup');
  input.teams.forEach((team,index)=>team.requiredCategory=index%2?'U16':'U14');
  input.courtGames.forEach(game=>Object.assign(game,{categoryMatchup:true,category1:'U14',category2:'U16'}));
  input.outcomes[1].winnerTeamId=input.courtGames[1].team2.id;
  for (const mode of ['waiting-first-winners','waiting-winners','waiting','results']) {
    const next=plan(input,input.outcomes,mode,group);
    next.games.forEach(game=>assert.notEqual(game.team1.requiredCategory,game.team2.requiredCategory));
    const ids=next.games.flatMap(game=>[game.team1.id,game.team2.id]).concat(next.waitingTeams.map(team=>team.id));
    assert.equal(new Set(ids).size,input.teams.length);
  }
});

test('one waiting team faces the loser on a single court and odd result groups explain their fallback', () => {
  const input = fixture(1,1);
  const next = plan(input, input.outcomes, 'waiting', group);
  assert.deepEqual([...next.games.flatMap(game => [game.team1.id, game.team2.id])].sort(), ['1','2']);
  assert.equal(next.waitingTeams[0].id, '0');
  const odd = fixture(3,0);
  assert.equal(plan(odd, odd.outcomes, 'results', group).mixedPairs, 1);
});

test('all court and waiting counts preserve every team exactly once and honor queue capacity', () => {
  for (let courts=1; courts<=4; courts++) for (let waiting=0; waiting<=10; waiting++) {
    const input = fixture(courts, waiting);
    const original = JSON.stringify(input);
    for (const mode of ['waiting','results']) {
      const next = plan(input, input.outcomes, mode, group);
      const onCourt = next.games.flatMap(game => [game.team1.id, game.team2.id]);
      const ids = onCourt.concat(next.waitingTeams.map(team => team.id));
      assert.equal(next.games.length, courts);
      assert.equal(new Set(ids).size, input.teams.length);
      assert.equal(ids.length, input.teams.length);
      if (mode === 'waiting') input.waitingTeams.slice(0,courts*2).forEach(team => assert.ok(onCourt.includes(team.id)));
      assert.equal(JSON.stringify(input), original, 'preview does not mutate approved games');
    }
  }
});

test('Kids, adult groups and 3v3/4v4 stay separate, and missing winners are rejected', () => {
  const parts = [fixture(1,1,'Kids',0), fixture(1,1,'adult',10), fixture(1,2,'regular',20,4), fixture(1,1,'regular',30,3)];
  const input = {
    teams:parts.flatMap(part=>part.teams),
    courtGames:parts.flatMap(part=>part.courtGames),
    waitingTeams:parts.flatMap(part=>part.waitingTeams)
  };
  const outcomes = parts.flatMap(part=>part.outcomes);
  const next = plan(input, outcomes, 'waiting', group);
  next.games.forEach(game => {
    assert.equal(game.team1.group, game.team2.group);
    assert.equal(game.team1.teamSize, game.team2.teamSize);
    assert.equal(game.teamSize, game.team1.teamSize);
  });
  assert.throws(()=>plan(input, [], 'waiting', group), /Record a winner/);
});
