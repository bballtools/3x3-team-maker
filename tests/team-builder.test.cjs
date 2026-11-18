const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');

function runtime() {
  let seed = 123456;
  const math = Object.create(Math);
  math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const context = vm.createContext({ window: {}, Math: math, console });
  for (const file of ['optimizer.js', 'game-counter.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  }
  return context.window;
}

function roster(n, categories = ['U14', 'U16', 'U18'], skills = [1, 2, 3, 4, 5]) {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`, name: `Player ${i}`, category: categories[i % categories.length], skill: skills[i % skills.length]
  }));
}

function assertPartition(result, input) {
  const ids = result.teams.flatMap(team => team.players).concat(result.rotationPlayers).map(player => player.id);
  assert.equal(ids.length, input.length);
  assert.equal(new Set(ids).size, input.length);
  assert.deepEqual([...ids].sort(), input.map(player => player.id).sort());
  assert.equal(result.courtGames.length, result.plan.playableCourts);
  assert.equal(result.waitingTeams.length, result.plan.waitingTeams);
  result.teams.forEach(team => {
    const substitutes = team.substituteIds || [];
    assert.ok(substitutes.length <= 1);
    assert.equal(team.players.length, team.teamSize + substitutes.length);
    substitutes.forEach(id => assert.ok(team.players.some(player => player.id === id)));
    const rated = team.players.filter(player => Number.isInteger(player.skill));
    assert.equal(team.averageSkill, rated.length ? rated.reduce((sum, player) => sum + player.skill, 0) / rated.length : null);
  });
}

test('the full 1–10 scale balances regular and waiting teams and rejects fractional or out-of-range ratings', () => {
  const { TeamOptimizer } = runtime();
  const input = roster(30, ['U16'], [1,2,3,4,5,6,7,8,9,10]);
  const result = TeamOptimizer.generate(input, 2, '3');
  assertPartition(result, input);
  const totals = result.teams.map(team => team.totalSkill);
  assert.ok(Math.max(...totals) - Math.min(...totals) <= 1);
  for (const skill of [0, 11, 1.5]) {
    assert.throws(() => TeamOptimizer.generate([{...input[0], skill}, ...input.slice(1)], 2, '3'), /Invalid skill/);
  }
});

test('remixes give newcomers and less-played players court priority, including Auto substitutes and unassigned rotation', () => {
  const { TeamOptimizer, GameCounter } = runtime();
  for (const [n, fresh] of [[30,18],[27,20],[11,10],[19,6]]) for (const format of ['3','4','auto']) {
    const input = roster(n, ['U16']);
    const history = [{teams:[], matchups:input.slice(fresh).map(player => ({
      team1:[player.id,'departed1','departed2'], team2:['departed3','departed4','departed5'], gamesPlayed:3
    }))}];
    const result = TeamOptimizer.generate(input,2,format,history);
    assertPartition(result,input);
    const counts = GameCounter.totals(history).players;
    const active = result.courtGames.flatMap(game => [...game.team1.players,...game.team2.players]);
    const outside = result.waitingTeams.flatMap(team=>team.players).concat(result.rotationPlayers);
    if (outside.length) assert.ok(Math.max(...active.map(player=>counts.get(player.id)||0)) <= Math.min(...outside.map(player=>counts.get(player.id)||0)), `${n}, ${format}`);
  }
});

test('category rules build pure opposing teams, mix everyone else and preserve Kids helpers', () => {
  const { TeamOptimizer } = runtime();
  for (const [a,b] of [['U14','U16'],['U16','U16'],['18+','18+']]) for (const format of ['3','4','auto']) {
    const input = roster(30,['U14','U16','18+']);
    const result = TeamOptimizer.generate(input,3,format,[],{categoryMatchup:{category1:a,category2:b,maxCourts:1}});
    assertPartition(result,input);
    assert.equal(result.plan.categoryMatchupActive,true);
    assert.equal(result.plan.categoryCourtsUsed,1);
    const match = result.courtGames.find(game=>game.categoryMatchup);
    assert.ok(match.team1.players.every(player=>player.category===a));
    assert.ok(match.team2.players.every(player=>player.category===b));
    result.teams.filter(team=>!team.requiredCategory).forEach(team=>assert.ok(team.players.every(player=>player.category!==a&&player.category!==b)));
  }
  const input = roster(25,['U14','U16','18+']);
  input.slice(0,5).forEach(player=>player.category='Kids');
  const helper = input.find(player=>player.category==='U14');
  const result = TeamOptimizer.generate(input,3,'auto',[],{kidsOnly:true,kidsGroupPlayerIds:[...input.slice(0,5).map(player=>player.id),helper.id],categoryMatchup:{category1:'U14',category2:'U16',maxCourts:1}});
  assertPartition(result,input);
  assert.equal(result.plan.specialKidsCourt,true);
  assert.equal(result.plan.categoryMatchupActive,true);
  assert.ok(result.teams.find(team=>team.players.some(player=>player.id===helper.id)).group==='Kids');
  assert.ok(result.courtGames.find(game=>game.categoryMatchup).court>1);
});

test('mix mode balances a combined category pool while retaining separate Kids and adult-only groups', () => {
  const {TeamOptimizer}=runtime();
  const input=roster(36,['U14']);
  input.slice(0,6).forEach(player=>player.category='Kids');
  input.slice(6,12).forEach(player=>player.category='U16');
  input.slice(12,18).forEach(player=>player.category='U18');
  input.slice(18,30).forEach(player=>player.category='18+');
  const result=TeamOptimizer.generate(input,5,'3',[],{kidsOnly:true,categoryMatchups:[
    {category1:'U16',category2:'U18',mode:'mix',maxCourts:2},
    {category1:'18+',category2:'18+',mode:'versus',maxCourts:1}
  ]});
  assertPartition(result,input);
  const mixed=result.teams.filter(team=>team.allowedCategories);
  assert.equal(mixed.length,4);
  mixed.forEach(team=>{
    assert.ok(team.players.every(player=>['U16','U18'].includes(player.category)));
    assert.equal(new Set(team.players.map(player=>player.category)).size,2);
  });
  const adultTeams=result.teams.filter(team=>team.requiredCategory==='18+');
  adultTeams.forEach(team=>assert.ok(team.players.every(player=>player.category==='18+')));
  assert.ok(result.courtGames.some(game=>game.specialKidsCourt));
  assert.ok(result.courtGames.some(game=>game.categoryMode==='mix'));
  assert.ok(result.courtGames.some(game=>game.categoryMode==='versus'));
  const sparse=roster(6,['U18']);
  sparse[0].category='18+';
  const combined=TeamOptimizer.generate(sparse,1,'4',[],{categoryMatchup:{category1:'U18',category2:'18+',mode:'mix',maxCourts:1}});
  assertPartition(combined,sparse);
  assert.equal(combined.courtGames[0].teamSize,3);
  assert.equal(combined.plan.categoryMatchupActive,true);
});

test('62 players on six baskets support Kids, U16-only, adults-only and three mixed baskets together', () => {
  const { TeamOptimizer }=runtime();
  const input=roster(62,['U14','U18']);
  input.slice(0,6).forEach(player=>player.category='Kids');
  input.slice(6,18).forEach(player=>player.category='U16');
  input.slice(18,30).forEach(player=>player.category='18+');
  const rules=[{category1:'U16',category2:'U16',maxCourts:1},{category1:'18+',category2:'18+',maxCourts:1}];
  const result=TeamOptimizer.generate(input,6,'auto',[],{kidsOnly:true,categoryMatchups:rules});
  assertPartition(result,input);
  assert.equal(result.courtGames.length,6);
  assert.equal(result.courtGames.filter(game=>game.specialKidsCourt).length,1);
  assert.equal(result.plan.categoryMatchups.length,2);
  assert.equal(result.plan.categoryCourtsUsed,2);
  for(const category of ['U16','18+']) {
    const games=result.courtGames.filter(game=>game.category1===category);
    assert.equal(games.length,1);
    assert.ok([...games[0].team1.players,...games[0].team2.players].every(player=>player.category===category));
  }
  const mixed=result.courtGames.filter(game=>!game.specialKidsCourt&&!game.categoryMatchup);
  assert.equal(mixed.length,3);
  mixed.forEach(game=>assert.ok([...game.team1.players,...game.team2.players].every(player=>['U14','U18'].includes(player.category))));
  assert.throws(()=>TeamOptimizer.generate(input,2,'auto',[],{kidsOnly:true,categoryMatchups:rules}),/only 1 remain/);
  assert.throws(()=>TeamOptimizer.generate(input,6,'auto',[],{categoryMatchups:[rules[0],{category1:'U16',category2:'18+',maxCourts:1}]}),/already used/);
});

test('category matchups require three per side or six of the same category and honor basket limits', () => {
  const { TeamOptimizer } = runtime();
  const input = roster(18,['U14','U16','18+']);
  const result = TeamOptimizer.generate(input,2,'4',[],{categoryMatchup:{category1:'U14',category2:'U16',maxCourts:2}});
  assertPartition(result,input);
  assert.equal(result.plan.categoryCourtsUsed,1);
  const minimum = input.slice(0,6);
  minimum.forEach((player,i)=>player.category=i<3?'U14':'U16');
  const three = TeamOptimizer.generate(minimum,1,'4',[],{categoryMatchup:{category1:'U14',category2:'U16',maxCourts:1}});
  assertPartition(three,minimum);
  assert.equal(three.courtGames[0].teamSize,3);
  const invalid = TeamOptimizer.generate(input,2,'auto',[],{categoryMatchup:{category1:'U18',category2:'U16',maxCourts:1}});
  assertPartition(invalid,input);
  assert.equal(Boolean(invalid.plan.categoryMatchupActive),false);
  assert.match(invalid.plan.categoryNotice,/at least 3/);
});

test('six teams share the same skill average and represent all three ages', () => {
  const { TeamOptimizer } = runtime();
  const input = roster(18, ['U14', 'U16', 'U18'], [1, 3, 5]);
  const result = TeamOptimizer.generate(input, 3, '3');
  assertPartition(result, input);
  result.teams.forEach(team => {
    assert.equal(team.averageSkill, 3);
    assert.equal(new Set(team.players.map(player => player.category)).size, 3);
    assert.equal(team.players.filter(player => player.skill === 5).length, 1);
  });
});

test('waiting teams participate in global balancing', () => {
  const { TeamOptimizer } = runtime();
  const input = roster(24, ['U14', 'U16', 'U18', '18+'], [1, 2, 4, 5]);
  const result = TeamOptimizer.generate(input, 1, '4');
  assertPartition(result, input);
  assert.equal(result.waitingTeams.length, 4);
  result.teams.forEach(team => {
    assert.equal(team.averageSkill, 3);
    assert.equal(new Set(team.players.map(player => player.category)).size, 4);
  });
});

test('all skill levels are spread rather than stacking fives with ones', () => {
  const { TeamOptimizer } = runtime();
  const input = roster(18, ['U16'], [5, 5, 1, 3, 3, 3]);
  const result = TeamOptimizer.generate(input, 3, '3');
  const totals = result.teams.map(team => team.totalSkill);
  // Three odd ratings always sum to an odd number: 9 and 11 are
  // the closest possible totals for this roster's average of 10.
  assert.equal(Math.max(...totals) - Math.min(...totals), 2);
  result.teams.forEach(team => assert.ok(team.players.filter(player => player.skill === 5).length <= 1));
});

test('uneven attendance and all supported formats retain every player exactly once', () => {
  const { TeamOptimizer } = runtime();
  for (const n of [6, 7, 8, 11, 17, 31, 48, 80]) {
    for (const format of ['auto', '3', ...(n >= 8 ? ['4'] : [])]) {
      const input = roster(n);
      const result = TeamOptimizer.generate(input, 2, format);
      assertPartition(result, input);
      const totals = result.teams.map(team => team.players.filter(player => !team.substituteIds?.includes(player.id))
        .reduce((sum, player) => sum + player.skill, 0));
      assert.ok(Math.max(...totals) - Math.min(...totals) <= 1, `${n} players, ${format}`);
    }
  }
});

test('separate Kids court and adult-only restrictions survive global balancing', () => {
  const { TeamOptimizer } = runtime();
  const input = roster(24, ['U14', 'U16', 'U18']);
  input.slice(0, 6).forEach(player => player.category = 'Kids');
  input.slice(12).forEach(player => player.category = '18+');
  const result = TeamOptimizer.generate(input, 3, 'auto', [], { kidsOnly: true, adultOnly: true, maxAdultCourts: 1 });
  assertPartition(result, input);
  assert.equal(result.plan.adultOnlyActive, true);
  assert.equal(result.plan.specialKidsCourt, true);
  const adultTeams = result.teams.filter(team => team.players.some(player => player.category === '18+'));
  adultTeams.forEach(team => assert.ok(team.players.every(player => player.category === '18+')));
  assert.ok(result.courtGames.filter(game => game.adultOnly).length <= 1);
  const kidsGame = result.courtGames.find(game => game.specialKidsCourt);
  assert.ok(kidsGame);
  assert.equal(kidsGame.teamSize, 3);
  assert.ok([...kidsGame.team1.players, ...kidsGame.team2.players].every(player => player.category === 'Kids'));
});

test('Kids are mixed by default in auto and forced formats, also with adult-only mode', () => {
  const { TeamOptimizer } = runtime();
  const input = roster(24, ['Kids', 'U14', 'U16', '18+']);
  for (const format of ['auto', '3', '4']) {
    for (const adultOnly of [false, true]) {
      const result = TeamOptimizer.generate(input, 3, format, [], { adultOnly });
      assertPartition(result, input);
      assert.equal(result.plan.specialKidsCourt, false);
      result.teams.filter(team => team.players.some(player => player.category === 'Kids'))
        .forEach(team => assert.ok(team.players.some(player => player.category !== 'Kids')));
    }
  }
});

test('Kids-only always reserves exactly one 3v3 basket, with surplus Kids kept separate', () => {
  const { TeamOptimizer } = runtime();
  for (const kidsCount of [6, 7, 9, 12]) {
    for (const courts of [1, 3]) {
      const input = roster(kidsCount + 12);
      input.slice(0, kidsCount).forEach(player => player.category = 'Kids');
      input.slice(kidsCount).forEach(player => player.category = '18+');
      const result = TeamOptimizer.generate(input, courts, '4', [], { kidsOnly: true, adultOnly: true });
      assertPartition(result, input);
      assert.equal(result.courtGames.filter(game => game.specialKidsCourt).length, 1);
      assert.equal(result.courtGames[0].teamSize, 3);
      assert.ok(result.courtGames.length <= courts);
      assert.equal(new Set(result.teams.map(team => team.id)).size, result.teams.length);
      result.teams.filter(team => team.players.some(player => player.category === 'Kids'))
        .forEach(team => assert.ok(team.players.every(player => player.category === 'Kids')));
      if (courts === 1) assert.equal(result.plan.adultCourtsUsed, 0);
    }
  }
});

test('fewer than six Kids never borrows older players for a Kids-only basket', () => {
  const { TeamOptimizer } = runtime();
  for (const kidsCount of [0, 2, 5]) {
    const input = roster(18);
    input.slice(0, kidsCount).forEach(player => player.category = 'Kids');
    const result = TeamOptimizer.generate(input, 2, 'auto', [], { kidsOnly: true });
    assertPartition(result, input);
    assert.equal(result.plan.specialKidsCourt, false);
  }
});

test('game counters count actual games, keep player history across remixes, and exclude waiting', () => {
  const { GameCounter } = runtime();
  const history = [
    { teams: [['a', 'b'], ['c', 'd'], ['e', 'f']], matchups: [{ team1: ['a', 'b'], team2: ['c', 'd'], gamesPlayed: 2 }] },
    { matchups: [{ team1: ['a', 'e'], team2: ['b', 'f'], gamesPlayed: 1 }] },
    { matchups: [{ team1: ['a', 'b'], team2: ['c', 'd'] }] }
  ];
  let totals = GameCounter.totals(JSON.parse(JSON.stringify(history)));
  assert.equal(totals.players.get('a'), 3);
  assert.equal(totals.players.get('e'), 1);
  assert.equal(totals.players.get('c'), 2);
  assert.equal(totals.lineups.get(GameCounter.lineupKey(['b', 'a'])), 2);
  history[0].matchups[0].gamesPlayed--;
  totals = GameCounter.totals(history);
  assert.equal(totals.players.get('a'), 2);
  assert.equal(GameCounter.count({ gamesPlayed: -1 }), 0);
});

test('Auto reduces waiting, uses available baskets and favors more simultaneous players on a tie', () => {
  const { TeamOptimizer } = runtime();
  for (const [n, courts, expected] of [[8, 1, 4], [12, 2, 3], [18, 2, 4], [24, 3, 4], [42, 3, 4]]) {
    assert.equal(TeamOptimizer.choosePlan(n, courts, 'auto').teamSize, expected, `${n} players / ${courts} baskets`);
  }
  assert.equal(TeamOptimizer.choosePlan(42, 3, '3').teamSize, 3);
  assert.equal(TeamOptimizer.choosePlan(18, 3, '4').teamSize, 4);
});

test('48-player regression keeps Kids 3v3, chooses regular 4v4 and attaches the two leftovers', () => {
  const { TeamOptimizer } = runtime();
  const input = roster(48);
  input.slice(0, 6).forEach(player => player.category = 'Kids');
  const result = TeamOptimizer.generate(input, 4, 'auto', [], { kidsOnly: true });
  assertPartition(result, input);
  assert.equal(result.teams.length, 12);
  assert.equal(result.waitingTeams.length, 4);
  assert.equal(result.rotationPlayers.length, 0);
  assert.equal(result.teams.flatMap(team => team.substituteIds || []).length, 2);
  assert.equal(result.courtGames[0].teamSize, 3);
  result.courtGames.slice(1).forEach(game => assert.equal(game.teamSize, 4));
  const active = result.courtGames.flatMap(game => [game.team1, game.team2]);
  assert.equal(active.flatMap(team => team.substituteIds || []).length, 2);
  assert.equal(result.plan.waitingPlayers, 16);
});

test('three leftovers are assigned to three distinct teams; capacity limits leave a player unassigned', () => {
  const { TeamOptimizer } = runtime();
  const input = roster(27);
  const result = TeamOptimizer.generate(input, 3, 'auto');
  assertPartition(result, input);
  assert.equal(result.plan.teamSize, 4);
  assert.equal(result.teams.filter(team => team.substituteIds?.length).length, 3);
  assert.equal(result.rotationPlayers.length, 0);
  const small = TeamOptimizer.generate(roster(11), 1, 'auto');
  assertPartition(small, roster(11));
  assert.equal(small.teams.filter(team => team.substituteIds?.length).length, 2);
  assert.equal(small.rotationPlayers.length, 1);
  const seven = TeamOptimizer.generate(roster(7), 1, 'auto');
  assertPartition(seven, roster(7));
  assert.equal(seven.rotationPlayers.length, 0);
  assert.equal(seven.teams.flatMap(team => team.substituteIds || []).length, 1);
});

test('consecutive Auto mixes select different substitutes and distribute roles over history', () => {
  const { TeamOptimizer } = runtime();
  const input = roster(27);
  const history = [];
  const roles = new Set();
  let previous = [];
  for (let round = 1; round <= 6; round++) {
    const result = TeamOptimizer.generate(input, 3, 'auto', history);
    const ids = result.teams.flatMap(team => team.substituteIds || []);
    assert.equal(ids.length, 3);
    ids.forEach(id => {
      assert.ok(!previous.includes(id), 'consecutive substitute role');
      assert.ok(!roles.has(id), 'a fresh player should be used before repeating a role');
      roles.add(id);
    });
    history.push({ round, rotationRoleIds: ids, substitutePlayerIds: ids,
      teams: result.teams.map(team => team.players.map(player => player.id)), matchups: [] });
    previous = ids;
  }
  assert.equal(roles.size, 18);
});

test('rotation history handles legacy unassigned players and unavoidable repeats', () => {
  const { TeamOptimizer } = runtime();
  const input = roster(11, ['U16']);
  const legacy = [{ rotation: ['p0', 'p1', 'p2'], teams: [], matchups: [] }];
  const next = TeamOptimizer.generate(input, 1, '4', legacy);
  assert.equal(next.rotationPlayers.length, 3);
  assert.ok(next.rotationPlayers.every(player => !legacy[0].rotation.includes(player.id)));
  const allPrevious = [{ rotationRoleIds: input.map(player => player.id), teams: [], matchups: [] }];
  const unavoidable = TeamOptimizer.generate(input, 1, 'auto', allPrevious);
  assertPartition(unavoidable, input);
});

test('explicit U14 helpers belong only to the reserved Kids group before other teams are built', () => {
  const { TeamOptimizer } = runtime();
  const input = roster(20, ['U16']);
  input.slice(0, 4).forEach(player => player.category = 'Kids');
  input.slice(4, 8).forEach(player => player.category = 'U14');
  const selectedIds = input.slice(0, 6).map(player => player.id);
  const result = TeamOptimizer.generate(input, 3, 'auto', [], { kidsOnly: true, kidsGroupPlayerIds: selectedIds });
  assertPartition(result, input);
  assert.equal(result.plan.specialKidsCourt, true);
  const kidsTeams = result.teams.filter(team => team.group === 'Kids');
  assert.equal(kidsTeams.length, 2);
  assert.deepEqual(Array.from(kidsTeams.flatMap(team => team.players.map(player => player.id))).sort(), selectedIds.sort());
  assert.ok(result.teams.filter(team => team.group !== 'Kids').every(team => team.players.every(player => !selectedIds.includes(player.id))));
  assert.equal(result.courtGames[0].teamSize, 3);
  assert.throws(() => TeamOptimizer.generate(input, 3, 'auto', [], { kidsOnly: true, kidsGroupPlayerIds: ['p9'] }), /Kids and U14/);
});

test('unknown Dunker skills are excluded from averages and restricted to an explicit Kids group', () => {
  const { TeamOptimizer } = runtime();
  const kids = roster(2, ['Kids'], [2, 4]);
  const guests = Array.from({ length: 4 }, (_, i) => ({ id: `d${i}`, name: `Dunker ${i + 1}`, category: 'Kids', source: 'session', isPlaceholder: true, skill: null }));
  const input = [...kids, ...guests];
  const result = TeamOptimizer.generate(input, 1, 'auto', [], { kidsOnly: true, kidsGroupPlayerIds: input.map(player => player.id) });
  assertPartition(result, input);
  result.teams.forEach(team => {
    const known = team.players.filter(player => player.skill !== null);
    assert.equal(team.knownSkillCount, known.length);
    assert.equal(team.averageSkill, known.length ? known.reduce((sum, player) => sum + player.skill, 0) / known.length : null);
  });
  assert.throws(() => TeamOptimizer.generate(input, 1, '3'), /Invalid skill/);
  const allGuests = Array.from({ length: 6 }, (_, i) => ({ ...guests[0], id: `g${i}`, name: `Dunker ${i + 1}` }));
  const unknown = TeamOptimizer.generate(allGuests, 1, '3', [], { kidsOnly: true, kidsGroupPlayerIds: allGuests.map(player => player.id) });
  assertPartition(unknown, allGuests);
  assert.ok(unknown.teams.every(team => team.averageSkill === null));
  assert.ok(unknown.teams.every(team => team.totalSkill === 0));
});
