const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');

// A minimal document checks application wiring and generated markup. It does
// not substitute for checking layout in an actual browser.
async function boot(storage = new Map(), clipboardMode = 'modern', rosterOverride = null) {
  const elements = new Map();
  const handlers = new Map();
  const copied = [];
  let selected;
  function element() {
    return {
      value: '', hidden: false, disabled: false, checked: false, innerHTML: '', textContent: '', children: [],
      events: {}, listeners: {}, addEventListener(type, handler) {
        (this.listeners[type] ||= []).push(handler);
        this.events[type] = (...args) => {
          let result;
          for (const listener of this.listeners[type]) result = listener(...args);
          return result;
        };
      }, querySelectorAll: () => [], querySelector: () => null,
      classList: { toggle() {} }, scrollIntoView() {}, focus() {},
      style: {}, setAttribute() {}, remove() {}, select() { selected = this; },
      open: false, showModal() { this.open = true; }, close() { this.open = false; },
      appendChild(child) { this.children.push(child); }, replaceChildren() { this.children = []; }
    };
  }
  for (const match of fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/id="([^"]+)"/g)) {
    elements.set(match[1], element());
  }
  elements.get('gameFormat').value = '3';
  elements.get('completeAllGames').disabled = true;
  elements.get('undoLastCompletion').disabled = true;
  const input = rosterOverride || Array.from({ length: 19 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, category: 'U16', skill: i % 5 + 1 }));
  const context = vm.createContext({
    window: { confirm: () => true }, console, setTimeout,
    navigator: { clipboard: { writeText: async text => {
      if (clipboardMode !== 'modern') throw new Error('Clipboard API unavailable');
      copied.push(text);
    } } },
    document: {
      getElementById: id => elements.get(id), createElement: element,
      querySelectorAll: () => [],
      body: { appendChild() {} },
      execCommand: command => {
        if (clipboardMode === 'denied') return false;
        assert.equal(command, 'copy');
        copied.push(selected.value);
        return true;
      },
      addEventListener: (type, handler) => handlers.set(type, handler)
    },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    fetch: async () => ({ ok: true, json: async () => input })
  });
  // Browser globals resolve as both window properties and bare names.
  for (const file of ['optimizer.js', 'game-counter.js', 'championship.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  }
  Object.assign(context, context.window);
  vm.runInContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  const run = code => vm.runInContext(code, context);
  // Existing scenarios pass historical indices; only the shared completion
  // control is clickable now, so those indices no longer choose a court.
  const click = (_round, _game, change) => {
    // Counter regressions can deliberately replay the same matchups. Every
    // recorded game now requires fresh winner choices and a scheduled batch.
    if (change > 0) run(`if (currentResult && currentRoundApproved) {
      if (pendingGameCompletion()) startScheduledGames();
      currentResult.courtGames.forEach(game => { game.winnerTeamId = game.team1.id; });
      updateCompletionControls();
    }`);
    const button = elements.get(change > 0 ? 'completeAllGames' : 'undoLastCompletion');
    if (!button.disabled) {
      const result = button.events.click();
      if (change > 0 && elements.get('completionDialog').open) elements.get('confirmGameCompletion').events.click();
      return result;
    }
  };
  return { run, click, elements, storage, copied };
}

test('leaders can add and remove multiple category rows and restore them with approved six-basket sessions', async () => {
  const roster=Array.from({length:62},(_,i)=>({id:`m${i}`,name:`Player ${i}`,skill:i%10+1,category:i<6?'Kids':i<18?'U16':i<30?'18+':i%2?'U14':'U18'}));
  const app=await boot(new Map(),'modern',roster);
  app.elements.get('adultOnlyMode').value='category';
  app.elements.get('matchupCategory1').value='U16';
  app.elements.get('matchupCategory2').value='U16';
  app.elements.get('kidsOnlyMode').checked=true;
  app.run('courts=6; presentPlayerIds=new Set(players.map(player=>player.id)); updatePlayerSummary();');
  app.elements.get('addCategoryRule').events.click();
  const change=(field,value)=>app.elements.get('additionalCategoryRules').events.change({target:{closest:()=>({dataset:{ruleIndex:'0',ruleField:field},value})}});
  change('category1','18+');change('category2','18+');
  assert.match(app.elements.get('categoryBasketBudget').textContent,/1 Kids basket · 2 category baskets · 3 baskets left/);
  await app.run('generateTeams(false)');
  assert.equal(app.run('currentResult.courtGames.length'),6);
  assert.equal(app.run('currentResult.plan.categoryMatchups.length'),2);
  app.run('approveCurrentFormation()');
  app.click(0,0,1);
  app.elements.get('previewChampionship').events.click();
  app.elements.get('startChampionship').events.click();
  assert.equal(app.run('currentResult.courtGames.filter(game=>game.categoryMatchup).every(game=>game.team1.categoryRuleId===game.team2.categoryRuleId)'),true);
  const reloaded=await boot(app.storage,'modern',roster);
  assert.equal(reloaded.run('additionalCategoryRules[0].category1'),'18+');
  assert.equal(reloaded.run('adultOnlyOptions().categoryMatchups.length'),2);
  assert.equal(reloaded.run('currentResult.courtGames.length'),6);
  reloaded.elements.get('additionalCategoryRules').events.click({target:{closest:()=>({dataset:{removeRule:'0'}})}});
  assert.equal(reloaded.run('additionalCategoryRules.length'),0);
  assert.equal(reloaded.run('currentResult'),null);
});

test('category settings drive pure matchups, protect manual changes and persist through championship play and reload', async () => {
  const roster = Array.from({length:24},(_,i)=>({id:`p${i}`,name:`Player ${i}`,category:['U14','U16','U18','18+'][Math.floor(i/6)],skill:i%10+1}));
  const app = await boot(new Map(),'modern',roster);
  app.elements.get('adultOnlyMode').value='category';
  app.elements.get('matchupCategory1').value='U14';
  app.elements.get('matchupCategory2').value='U16';
  app.run(`courts=3; presentPlayerIds=new Set(players.map(player=>player.id)); updatePlayerSummary();`);
  app.elements.get('adultOnlyMode').events.change();
  assert.match(app.elements.get('adultOnlyStatus').textContent,/U14 vs U16 is available/);
  assert.equal(app.elements.get('categoryMatchupSetting').hidden,false);
  await app.run('generateTeams(false)');
  assert.equal(app.run('currentResult.plan.categoryMatchupActive'),true);
  app.run(`const categoryGame=currentResult.courtGames.find(game=>game.categoryMatchup);
    const mixedTeam=currentResult.teams.find(team=>!team.requiredCategory);
    const leftId=categoryGame.team1.players[0].id, rightId=categoryGame.team2.players[0].id;
    handlePlayerSwapClick('team',categoryGame.team1.id,leftId);
    handlePlayerSwapClick('team',categoryGame.team2.id,rightId);`);
  assert.equal(app.run('categoryGame.team1.players[0].id'),app.run('leftId'));
  assert.equal(app.run('canAssignSubstitute(categoryGame.team2.players[0],categoryGame.team1)'),false);
  assert.equal(app.run('canAssignSubstitute(categoryGame.team1.players[0],mixedTeam)'),false);
  app.run(`const wrongWaiting=currentResult.waitingTeams.find(team=>team.requiredCategory===categoryGame.team2.requiredCategory);
    handleTeamMove(categoryGame.team1.id); handleTeamMove(wrongWaiting.id);`);
  assert.equal(app.run('currentResult.courtGames.find(game=>game.categoryMatchup).team1.id'),app.run('categoryGame.team1.id'));
  assert.match(app.elements.get('teamMoveStatus').textContent,/break the selected category matchup/);
  app.run('approveCurrentFormation()');
  app.click(0,0,1);
  assert.equal(app.elements.get('championshipPairing').value,'waiting-winners');
  app.elements.get('previewChampionship').events.click();
  app.elements.get('startChampionship').events.click();
  assert.equal(app.run('currentResult.courtGames.filter(game=>game.categoryMatchup).every(game=>game.team1.requiredCategory!==game.team2.requiredCategory)'),true);
  const reloaded=await boot(app.storage,'modern',roster);
  assert.equal(reloaded.elements.get('adultOnlyMode').value,'category');
  assert.equal(reloaded.elements.get('matchupCategory1').value,'U14');
  assert.equal(reloaded.elements.get('matchupCategory2').value,'U16');
  assert.equal(reloaded.run('currentResult.plan.categoryMatchupActive'),true);
  assert.equal(reloaded.run('currentResult.scheduleBatchNumber'),2);
});

test('winners require approval, completion is confirmed once, championship previews are reviewed, and schedules preserve results', async () => {
  const app = await boot();
  app.run(`presentPlayerIds = new Set(players.slice(0,18).map(player => player.id));
    renderResult(TeamOptimizer.generate(getPresentPlayers(), 2, '3'), false);`);
  const choose = (target, court, value) => target.elements.get('resultsSection').events.change({target:{closest: selector =>
    selector === 'select[data-court-winner]' ? {dataset:{courtWinner:String(court)},value} : null}});
  const firstWinner = app.run('currentResult.courtGames[0].team1.id');
  choose(app, 1, firstWinner);
  assert.equal(app.run('currentResult.courtGames[0].winnerTeamId'), undefined);
  assert.doesNotMatch(app.elements.get('courtResults').children.at(-1).innerHTML, /data-court-winner/);
  app.run('approveCurrentFormation()');
  assert.equal(app.run('currentStoredFormation().scheduleBatches.length'), 1);
  assert.match(app.elements.get('automaticSchedule').innerHTML, /Up next/);
  choose(app,1,'invalid-team');
  assert.equal(app.run('currentResult.courtGames[0].winnerTeamId'), undefined);
  choose(app,1,firstWinner);
  assert.equal(app.elements.get('completeAllGames').disabled, true);
  choose(app,2,app.run('currentResult.courtGames[1].team1.id'));
  assert.equal(app.elements.get('completeAllGames').disabled, false);
  app.elements.get('completeAllGames').events.click();
  assert.equal(app.elements.get('completionDialog').open,true);
  assert.equal(app.run('currentStoredFormation().completions?.length || 0'), 0);
  app.elements.get('cancelGameCompletion').events.click();
  assert.equal(app.elements.get('completionDialog').open,false);
  app.elements.get('completeAllGames').events.click();
  app.elements.get('confirmGameCompletion').events.click();
  app.run('completeAllGames(true);');
  assert.equal(app.run('currentStoredFormation().completions.length'), 1);
  assert.equal(app.elements.get('nextGameControls').hidden, false);
  assert.equal(app.elements.get('completeAllGames').disabled, true);
  assert.match(app.elements.get('automaticSchedule').innerHTML, /Completed|Winner:/);
  const original = app.run('JSON.stringify(currentResult.courtGames.map(game => [game.team1.id,game.team2.id]))');
  const snapshot = app.run('JSON.stringify(currentStoredFormation().completions[0].results)');
  const restored = await boot(app.storage);
  assert.equal(restored.elements.get('nextGameControls').hidden, false);
  restored.elements.get('championshipPairing').value = 'waiting';
  restored.elements.get('previewChampionship').events.click();
  assert.equal(restored.run('JSON.stringify(currentResult.courtGames.map(game => [game.team1.id,game.team2.id]))'), original);
  assert.equal(restored.elements.get('startChampionship').hidden, false);
  restored.elements.get('startChampionship').events.click();
  assert.equal(restored.run('currentResult.scheduleBatchNumber'), 2);
  assert.equal(restored.run('currentStoredFormation().scheduleBatches.length'), 2);
  assert.equal(restored.run('pendingGameCompletion()'), null);
  assert.equal(restored.run('currentResult.courtGames.every(game => !game.winnerTeamId)'), true);
  assert.equal(restored.run('currentResult.waitingTeams.every(team => currentStoredFormation().completions[0].results.some(game => game.winnerTeamId === team.id))'), true);
  assert.equal(restored.run('JSON.stringify(currentStoredFormation().completions[0].results)'), snapshot);
  assert.equal(restored.run('Math.max(...GameCounter.totals(approvedFormations).players.values())'), 1);
  assert.match(restored.elements.get('automaticSchedule').innerHTML, /Up next/);
  assert.match(restored.elements.get('automaticSchedule').innerHTML, /Winner:/);
  const next = await boot(restored.storage);
  assert.equal(next.run('currentResult.scheduleBatchNumber'), 2);
  const nextLayout = next.run('JSON.stringify(currentResult.courtGames.map(game => [game.team1.id,game.team2.id]))');
  next.run('undoLastCompletion()');
  assert.equal(next.run('JSON.stringify(currentResult.courtGames.map(game => [game.team1.id,game.team2.id]))'), nextLayout);
  assert.match(next.elements.get('automaticSchedule').innerHTML, /Completion undone/);
  assert.doesNotMatch(next.elements.get('automaticSchedule').innerHTML, /Winner:/);
  assert.equal(next.run('Math.max(...GameCounter.totals(approvedFormations).players.values())'), 0);
});

test('undo allows correcting a winner and remix adds games only after the new formation is approved', async () => {
  const app = await boot();
  app.run(`presentPlayerIds = new Set(players.map(player => player.id));
    renderResult(TeamOptimizer.generate(getPresentPlayers(), 2, '3'), false); approveCurrentFormation();`);
  app.click(0,0,1);
  app.run(`undoLastCompletion(); currentResult.courtGames.forEach(game => {game.winnerTeamId = game.team2.id;}); completeAllGames(true);`);
  assert.equal(app.run('currentStoredFormation().completions.filter(game => !game.undone).length'),1);
  assert.equal(app.run('currentStoredFormation().completions.at(-1).results.every(game => game.winnerTeamId === game.team2Id)'),true);
  app.elements.get('scheduleNotes').value = 'Keep this note';
  app.elements.get('scheduleNotes').events.input({target:app.elements.get('scheduleNotes')});
  await app.run('remixForNextRound()');
  assert.equal(app.run('currentRoundApproved'),false);
  assert.equal(app.run('approvedFormations.length'),1);
  assert.equal(app.run('approvedFormations[0].scheduleBatches.length'),1);
  app.run('approveCurrentFormation()');
  assert.equal(app.run('approvedFormations.length'),2);
  assert.equal(app.run('approvedFormations[1].scheduleBatches.length'),1);
  assert.equal(app.elements.get('scheduleNotes').value,'Keep this note');
  assert.match(app.elements.get('automaticSchedule').innerHTML,/Formation 2/);
});

test('an older approved session gains automatic scheduling without inventing old winners or losing newly selected winners', async () => {
  const app = await boot();
  app.run(`presentPlayerIds = new Set(players.map(player => player.id));
    renderResult(TeamOptimizer.generate(getPresentPlayers(), 2, '3'), false); approveCurrentFormation();
    delete currentStoredFormation().scheduleBatches; delete currentResult.scheduleBatchNumber;
    currentStoredFormation().matchups.forEach(game => { game.gamesPlayed = 2; }); saveEveningSession();`);
  const restored = await boot(app.storage);
  assert.doesNotMatch(restored.elements.get('automaticSchedule').innerHTML, /Winner:/);
  restored.click(0,0,1);
  assert.equal(restored.run('currentStoredFormation().completions[0].results.every(game => game.winnerTeamId && game.winnerName)'),true);
  assert.equal(restored.run('currentStoredFormation().matchups.every(game => game.gamesPlayed === 3)'),true);
  assert.equal(restored.run('currentStoredFormation().scheduleBatches.length'),1);
});

test('checked-in overview groups the full selection and follows check-ins, skill edits, reload and reset', async () => {
  const roster = [
    {id:'a', name:'Alex <A>', category:'Kids', skill:2},
    {id:'b', name:'Zara', category:'U14', skill:4},
    {id:'c', name:'Bob', category:'U14', skill:10},
    {id:'d', name:'Absent', category:'18+', skill:7}
  ];
  const app = await boot(new Map(), 'modern', roster);
  assert.match(app.elements.get('checkedInSummary').textContent, /No players checked in yet/);
  app.run(`sessionDunkers = [{id:'guest', name:'Dunker 1', category:'Kids', skill:null, source:'session', isPlaceholder:true}];
    mergePlayerSources(); presentPlayerIds = new Set(['a','b','c','guest']); updateAttendanceResults(); updatePlayerSummary();`);
  const summary = app.elements.get('checkedInSummary');
  const groups = app.elements.get('checkedInGroups');
  assert.match(summary.textContent, /4 checked in · Average skill 5.3\/10 · 1 unrated/);
  assert.match(groups.innerHTML, /Kids checked-in players/);
  assert.match(groups.innerHTML, /Alex &lt;A&gt;/);
  assert.doesNotMatch(groups.innerHTML, /Absent|Alex <A>/);
  assert.ok(groups.innerHTML.indexOf('Zara') < groups.innerHTML.indexOf('Bob'));
  assert.match(groups.innerHTML, /Skill unknown/);
  assert.match(app.elements.get('checkedInDistribution').innerHTML, /50% of today/);
  app.run(`activeCategory = 'U14'; playerSearch.value = 'Bob'; renderPlayerInterface();`);
  assert.match(groups.innerHTML, /Zara/);
  assert.match(groups.innerHTML, /Alex &lt;A&gt;/);
  assert.match(summary.textContent, /4 checked in/);
  const select = {value:'6', dataset:{playerSkill:'a'}};
  app.elements.get('playerList').events.change({target:{closest: selector => selector === 'select[data-player-skill]' ? select : null}});
  assert.match(summary.textContent, /Average skill 6.7\/10/);
  assert.match(groups.innerHTML, /Skill 6 out of 10/);
  const restored = await boot(app.storage, 'modern', roster);
  assert.match(restored.elements.get('checkedInSummary').textContent, /4 checked in/);
  const checkbox = {checked:false, dataset:{id:'b'}};
  restored.elements.get('playerList').events.change({target:{closest: selector => selector === '.playerCheckbox' ? checkbox : null}});
  assert.match(restored.elements.get('checkedInSummary').textContent, /3 checked in/);
  assert.doesNotMatch(restored.elements.get('checkedInGroups').innerHTML, /Zara/);
  restored.run('startNewSession()');
  assert.match(restored.elements.get('checkedInSummary').textContent, /No players checked in yet/);
  assert.doesNotMatch(restored.elements.get('checkedInGroups').innerHTML, /Dunker 1|Alex &lt;A&gt;/);
});

test('late check-ins preserve approved courts and counts, survive reload, and enter the next remix', async () => {
  const app = await boot();
  app.run(`presentPlayerIds = new Set(players.slice(0, 6).map(player => player.id));
    renderResult(TeamOptimizer.generate(getPresentPlayers(), 1, '3'), false); approveCurrentFormation();`);
  app.click(0, 0, 1);
  const before = app.run('JSON.stringify(currentResult.courtGames)');
  app.run(`presentPlayerIds.add('p6'); updateAttendanceResults();`);
  assert.equal(app.run('currentRoundApproved'), true);
  assert.equal(app.run('JSON.stringify(currentResult.courtGames)'), before);
  assert.equal(app.run('currentResult.rotationPlayers[0].id'), 'p6');
  assert.equal(app.run('GameCounter.totals(approvedFormations).players.get("p6") || 0'), 0);
  const reloaded = await boot(app.storage);
  assert.equal(reloaded.run('currentResult.rotationPlayers[0].id'), 'p6');
  assert.equal(reloaded.run('presentPlayerIds.size'), 7);
  reloaded.run(`assignSubstitute('p6', currentResult.teams[0].id);`);
  reloaded.click(0, 0, 1);
  assert.equal(reloaded.run('GameCounter.totals(approvedFormations).players.get("p6")'), 1);
  reloaded.elements.get('editNextAttendance').events.click();
  assert.equal(reloaded.run('currentResult'), null);
  reloaded.run(`presentPlayerIds.delete('p0'); updateAttendanceResults();`);
  await reloaded.run('generateTeams(false)');
  assert.equal(reloaded.run('currentResult.teams.flatMap(team => team.players).some(player => player.id === "p0")'), false);
  assert.equal(reloaded.run('GameCounter.totals(approvedFormations).players.get("p6")'), 1);
});

test('schedule notes and attendance persist independently of a formation and reset with the session', async () => {
  const app = await boot();
  app.elements.get('scheduleNotes').events.input({ target: { value: '18:00 Court 1 — A vs B\nNext: C' } });
  app.run(`presentPlayerIds.add('p0'); updateAttendanceResults();`);
  const reloaded = await boot(app.storage);
  assert.equal(reloaded.elements.get('scheduleNotes').value, '18:00 Court 1 — A vs B\nNext: C');
  assert.equal(reloaded.run('presentPlayerIds.has("p0")'), true);
  reloaded.run('startNewSession()');
  assert.equal(reloaded.elements.get('scheduleNotes').value, '');
  assert.equal(reloaded.storage.size, 0);
});

test('legacy newcomers and approved guests migrate to 1–10 once without changing completed games', async () => {
  const storage = new Map([['bballtools_3x3_local_players_v1', JSON.stringify([
    {id:'local1', name:'Local One', category:'U16', skill:3}
  ])]]);
  const app = await boot(storage);
  assert.equal(app.run('localPlayers[0].skill'), 6);
  app.run(`presentPlayerIds = new Set(players.slice(0,6).map(player => player.id));
    renderResult(TeamOptimizer.generate(getPresentPlayers(), 1, '3'), false); approveCurrentFormation();`);
  app.click(0,0,1);
  const key = 'bballtools_3x3_evening_session_v1';
  const legacy = JSON.parse(storage.get(key));
  delete legacy.skillScale;
  storage.set(key, JSON.stringify(legacy));
  const migrated = await boot(storage);
  assert.equal(migrated.run('currentResult.teams.flatMap(team => team.players).find(player => player.id === "p0").skill'), 2);
  migrated.run('saveEveningSession()');
  const again = await boot(storage);
  assert.equal(again.run('currentResult.teams.flatMap(team => team.players).find(player => player.id === "p0").skill'), 2);
  assert.equal(again.run('localPlayers[0].skill'), 6);
  assert.equal(again.run('Math.max(...GameCounter.totals(approvedFormations).players.values())'), 1);
});

test('editing a skill persists across sessions and changes approved averages without moving teams', async () => {
  const app = await boot();
  app.run(`presentPlayerIds = new Set(players.slice(0,6).map(player => player.id));
    renderResult(TeamOptimizer.generate(getPresentPlayers(), 1, '3'), false); approveCurrentFormation();`);
  const lineup = app.run('JSON.stringify(currentResult.teams.map(team => team.players.map(player => player.id)))');
  const select = {value:'9', dataset:{playerSkill:'p0'}};
  app.elements.get('playerList').events.change({target:{closest: selector => selector === 'select[data-player-skill]' ? select : null}});
  assert.equal(app.run('players.find(player => player.id === "p0").skill'), 9);
  assert.equal(app.run('JSON.stringify(currentResult.teams.map(team => team.players.map(player => player.id)))'), lineup);
  const restored = await boot(app.storage);
  assert.equal(restored.run('players.find(player => player.id === "p0").skill'), 9);
  restored.run('startNewSession()');
  const next = await boot(app.storage);
  assert.equal(next.run('players.find(player => player.id === "p0").skill'), 9);
});

test('approval, completion, undo, remix, reload, and session reset keep counts consistent', async () => {
  const app = await boot();
  app.run(`presentPlayerIds = new Set(players.map(player => player.id));
    currentResult = TeamOptimizer.generate(players, 1, '3');
    renderResult(currentResult, false); approveCurrentFormation();`);
  assert.equal(app.run('approvedFormations.length'), 1);
  assert.equal(app.run('approvedFormations[0].matchups[0].gamesPlayed'), 0);
  assert.equal(app.elements.get('completeAllGames').disabled, true, 'winner choices are required after approval');
  assert.doesNotMatch(app.elements.get('courtResults').children.at(-1).innerHTML, /data-game-change|Game completed/);
  app.click(0, 0, 1);
  assert.equal(app.run('GameCounter.totals(approvedFormations).players.size'), 6);
  assert.equal(app.run('Math.max(...GameCounter.totals(approvedFormations).players.values())'), 1);
  assert.match(app.elements.get('gameCounterPanel').innerHTML, /fewer games/);
  app.click(0, 0, 1);
  assert.equal(app.run('approvedFormations[0].matchups[0].gamesPlayed'), 2);
  app.click(0, 0, -1);
  assert.equal(app.run('approvedFormations[0].matchups[0].gamesPlayed'), 1);
  assert.equal(app.run('approvedFormations[0].matchups.length'), 1);
  app.run(`currentRoundApproved = false; currentRoundNumber = 2;
    currentResult = TeamOptimizer.generate(players, 1, '3', approvedFormations);
    renderResult(currentResult, false); approveCurrentFormation();`);
  assert.equal(app.run('Math.max(...GameCounter.totals(approvedFormations).players.values())'), 1);
  app.click(1, 0, 1);
  const reloaded = await boot(app.storage);
  assert.equal(reloaded.run('approvedFormations.length'), 2);
  assert.equal(reloaded.run('approvedFormations[0].matchups[0].gamesPlayed'), 1);
  assert.equal(reloaded.elements.get('gameCounterPanel').hidden, false);
  assert.match(reloaded.elements.get('gameCounterPanel').innerHTML, /Player /);
  reloaded.click(0, 0, -1);
  reloaded.click(0, 0, -1);
  assert.equal(reloaded.run('approvedFormations[0].matchups[0].gamesPlayed'), 0);
  reloaded.run('startNewSession()');
  assert.equal(reloaded.run('approvedFormations.length'), 0);
  assert.equal(reloaded.storage.size, 0);
  assert.equal(reloaded.elements.get('gameCounterPanel').hidden, true);
});

test('legacy rounds keep their counts without assuming scheduled games were played', async () => {
  const app = await boot();
  app.run(`approvedFormations = [{ round: 1, signature: 'legacy', teams: [['p0','p1','p2'], ['p3','p4','p5']],
    matchups: [{ team1: ['p0','p1','p2'], team2: ['p3','p4','p5'] }] }]; saveEveningSession();`);
  const reloaded = await boot(app.storage);
  assert.equal(reloaded.run('GameCounter.totals(approvedFormations).players.get("p0")'), 0);
  reloaded.click(0, 0, 1);
  assert.equal(reloaded.run('GameCounter.totals(approvedFormations).players.get("p0")'), 0);
  assert.equal(reloaded.elements.get('undoLastCompletion').disabled, true);
  assert.doesNotMatch(reloaded.elements.get('gameCounterPanel').innerHTML, /data-game-change/);
});

test('search filters names and age tabs without altering attendance; clear restores the list', async () => {
  const app = await boot();
  app.run(`players = [
    { id: 'a', name: 'Álex Smith', category: 'Kids', skill: 3 },
    { id: 'b', name: 'Alex Brown', category: 'U16', skill: 3 },
    { id: 'c', name: 'Casey', category: 'Kids', skill: 3 }
  ]; presentPlayerIds = new Set(['c']);`);
  const search = app.elements.get('playerSearch');
  search.value = '  ALEX  ';
  search.events.input();
  assert.equal(app.run('getVisiblePlayers().length'), 2);
  assert.equal(app.run('presentPlayerIds.size'), 1);
  assert.equal(app.elements.get('clearPlayerSearch').hidden, false);
  app.run(`activeCategory = 'Kids'; renderPlayerInterface();`);
  assert.equal(app.run('getVisiblePlayers()[0].id'), 'a');
  app.elements.get('selectAll').events.click();
  assert.equal(app.run('presentPlayerIds.has("a")'), true);
  assert.equal(app.run('presentPlayerIds.has("b")'), false);
  search.value = 'nobody';
  search.events.input();
  assert.match(app.elements.get('playerList').innerHTML, /No players match/);
  assert.equal(app.elements.get('selectAll').disabled, true);
  app.elements.get('clearPlayerSearch').events.click();
  assert.equal(app.run('getVisiblePlayers().length'), 2);
  assert.equal(app.elements.get('clearPlayerSearch').hidden, true);
  assert.equal(app.run('presentPlayerIds.size'), 2);
});

test('search narrows immediately with every letter and clears with Escape', async () => {
  const app = await boot();
  app.run(`players = [
    { id: 'x', name: 'Xenn', category: '18+', skill: 5 },
    { id: 'y', name: 'Xavier', category: 'U16', skill: 3 },
    { id: 'z', name: 'Casey', category: 'Kids', skill: 2 }
  ]; presentPlayerIds = new Set(['z']);`);
  const search = app.elements.get('playerSearch');
  for (const [query, count] of [['x', 2], ['xe', 1], ['xen', 1], ['xenn', 1], ['xennz', 0], ['x', 2]]) {
    search.value = query;
    search.events.input();
    assert.equal(app.run('getVisiblePlayers().length'), count);
    assert.match(app.elements.get('playerSummary').textContent, new RegExp(`${count} ${count === 1 ? 'match$' : 'matches$'}`));
    assert.equal(app.run('presentPlayerIds.size'), 1);
    if (query === 'xe') {
      assert.match(app.elements.get('playerList').innerHTML, /Xenn/);
      assert.doesNotMatch(app.elements.get('playerList').innerHTML, /Xavier|Casey/);
    }
  }
  let prevented = false;
  search.events.keydown({ key: 'Escape', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(search.value, '');
  assert.equal(app.run('getVisiblePlayers().length'), 3);
  assert.equal(app.elements.get('clearPlayerSearch').hidden, true);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.indexOf('id="playerSearch"') < html.indexOf('id="categoryTabs"'));
});

test('Kids-only checkbox is passed to generation and explains insufficient attendance', async () => {
  const app = await boot();
  app.elements.get('kidsOnlyMode').checked = true;
  app.elements.get('kidsOnlyMode').events.change();
  assert.equal(app.run('adultOnlyOptions().kidsOnly'), true);
  assert.match(app.elements.get('kidsOnlyStatus').textContent, /U14 helpers or Dunkers/);
  app.run(`players.slice(0, 6).forEach(player => player.category = 'Kids');
    presentPlayerIds = new Set(players.map(player => player.id)); updatePlayerSummary();
    currentResult = TeamOptimizer.generate(getPresentPlayers(), courts, 'auto', [], adultOnlyOptions());`);
  assert.equal(app.run('currentResult.plan.specialKidsCourt'), true);
  app.run(`handlePlayerSwapClick('team', currentResult.teams[0].id, currentResult.teams[0].players[0].id);
    const otherTeam = currentResult.teams.find(team => team.players[0].category !== 'Kids');
    handlePlayerSwapClick('team', otherTeam.id, otherTeam.players[0].id);`);
  assert.match(app.run('lastSwapMessage'), /Kids can only be swapped with other Kids/);
  assert.equal(app.run('currentResult.teams[0].players.every(player => player.category === "Kids")'), true);
  app.elements.get('kidsOnlyMode').checked = false;
  app.elements.get('kidsOnlyMode').events.change();
  assert.equal(app.run('currentResult'), null);
  assert.equal(app.run('adultOnlyOptions().kidsOnly'), false);
  assert.match(app.elements.get('kidsOnlyStatus').textContent, /Off: Kids are mixed/);
});

test('manual championship exchanges whole teams and keeps counters attached to actual matchups', async () => {
  const app = await boot();
  app.run(`presentPlayerIds = new Set(players.map(player => player.id));
    currentResult = TeamOptimizer.generate(players, 1, '3');
    currentResult.championshipMode = true; renderResult(currentResult, false); approveCurrentFormation();
    const firstWinner = currentResult.courtGames[0].team1;
    const firstLoser = currentResult.courtGames[0].team2;
    const nextTeam = currentResult.waitingTeams[0];`);
  app.click(0, 0, 1);
  const clickMove = id => app.elements.get('resultsSection').events.click({ target: {
    closest: selector => selector === 'button[data-move-team]' ? { dataset: { moveTeam: id } } : null
  } });
  clickMove(app.run('nextTeam.id'));
  assert.equal(app.run('selectedMoveTeamId'), app.run('nextTeam.id'));
  clickMove(app.run('firstLoser.id'));
  assert.equal(app.run('currentResult.courtGames[0].team1.id'), app.run('firstWinner.id'));
  assert.equal(app.run('currentResult.courtGames[0].team2.id'), app.run('nextTeam.id'));
  assert.equal(app.run('currentResult.waitingTeams[0].id'), app.run('firstLoser.id'));
  assert.equal(app.run('approvedFormations[0].matchups[0].gamesPlayed'), 1);
  assert.equal(app.run('approvedFormations[0].matchups[1].gamesPlayed'), 0);
  assert.doesNotMatch(app.elements.get('courtResults').children.at(-1).innerHTML, /data-game-index/);
  app.click(0, 1, 1);
  app.run(`const nextChallenger = currentResult.waitingTeams[1];
    handleTeamMove(firstWinner.id); handleTeamMove(nextChallenger.id);`);
  assert.equal(app.run('GameCounter.totals(approvedFormations).players.get(firstWinner.players[0].id)'), 2);
  assert.equal(app.run('GameCounter.totals(approvedFormations).players.get(firstLoser.players[0].id)'), 1);
  assert.equal(app.run('GameCounter.totals(approvedFormations).players.get(nextTeam.players[0].id)'), 1);
  assert.equal(app.run('currentResult.teams.length'), 6);
  assert.equal(app.run('new Set(currentResult.courtGames.flatMap(game => [game.team1.id, game.team2.id]).concat(currentResult.waitingTeams.map(team => team.id))).size'), 6);
  const restored = await boot(app.storage);
  assert.equal(restored.run('currentResult.championshipMode'), true);
  assert.equal(restored.run('currentRoundApproved'), true);
  assert.equal(restored.run('currentRoundNumber'), 1);
  assert.equal(restored.run('currentResult.courtGames[0].team1 === currentResult.teams.find(team => team.id === currentResult.courtGames[0].team1.id)'), true);
  assert.equal(restored.run('currentResult.courtGames[0].historyIndex'), 2);
  restored.click(0, 0, -1);
  assert.equal(restored.run('approvedFormations[0].matchups[1].gamesPlayed'), 0);
  assert.equal(restored.run('approvedFormations[0].matchups[0].gamesPlayed'), 1);
});

test('manual exchanges between two baskets change both matchups without duplicating a team', async () => {
  const app = await boot();
  app.run(`currentResult = TeamOptimizer.generate(players, 2, '3');
    currentResult.championshipMode = true; renderResult(currentResult, false); approveCurrentFormation();
    const fromFirstCourt = currentResult.courtGames[0].team1;
    const fromSecondCourt = currentResult.courtGames[1].team2;`);
  app.click(0, 0, 1);
  app.run('handleTeamMove(fromFirstCourt.id); handleTeamMove(fromSecondCourt.id)');
  assert.equal(app.run('currentResult.courtGames[0].team1.id'), app.run('fromSecondCourt.id'));
  assert.equal(app.run('currentResult.courtGames[1].team2.id'), app.run('fromFirstCourt.id'));
  assert.equal(app.run('approvedFormations[0].matchups.length'), 4);
  assert.equal(app.run('approvedFormations[0].matchups[0].gamesPlayed'), 1);
  assert.equal(app.run('approvedFormations[0].matchups[1].gamesPlayed'), 1);
  assert.equal(app.run('currentResult.courtGames[0].historyIndex'), 2);
  assert.equal(app.run('currentResult.courtGames[1].historyIndex'), 3);
  assert.equal(app.run('new Set(currentResult.courtGames.flatMap(game => [game.team1.id, game.team2.id])).size'), 4);
});

test('substitutes expand the roster without changing format and all members receive shared completions', async () => {
  const app = await boot();
  app.run(`presentPlayerIds = new Set(players.map(player => player.id));
    currentResult = TeamOptimizer.generate(players, 1, '3'); renderResult(currentResult, false); approveCurrentFormation();
    const originalTeam = currentResult.courtGames[0].team1;
    const extraPlayer = currentResult.rotationPlayers[0];`);
  app.click(0, 0, 1);
  app.run('assignSubstitute(extraPlayer.id, originalTeam.id)');
  assert.equal(app.run('originalTeam.players.length'), 4);
  assert.equal(app.run('originalTeam.teamSize'), 3);
  assert.equal(app.run('currentResult.courtGames[0].teamSize'), 3);
  assert.equal(app.run('currentResult.rotationPlayers.length'), 0);
  assert.equal(app.run('currentResult.courtGames[0].historyIndex'), 1);
  assert.doesNotMatch(app.elements.get('courtResults').children.at(-1).innerHTML, /Who took part|data-game-participant/);
  app.click(0, 1, 1);
  assert.equal(app.run('GameCounter.totals(approvedFormations).players.get(extraPlayer.id)'), 1);
  assert.equal(app.run('currentResult.courtGames[0].historyIndex'), 1);
  app.click(0, 2, 1);
  assert.equal(app.run('GameCounter.totals(approvedFormations).players.get(extraPlayer.id)'), 2);
  assert.equal(app.run('GameCounter.totals(approvedFormations).players.get(originalTeam.players[0].id)'), 3);
  assert.equal(app.run('currentStoredFormation().matchups.reduce((sum, game) => sum + GameCounter.count(game), 0)'), 3);
  assert.equal(app.run('currentResult.teams[0].teamSize'), 3);
  assert.equal(app.run('currentResult.teams[0].players.length'), 4);
  assert.equal(app.run('GameCounter.count(currentStoredFormation().matchups[currentResult.courtGames[0].historyIndex])'), 2);
  assert.equal(app.run('currentStoredFormation().matchups[currentResult.courtGames[0].historyIndex].participatingPlayerIds.includes(extraPlayer.id)'), true);
  const restored = await boot(app.storage);
  assert.equal(restored.run('currentResult.courtGames[0].team1.players.length'), 4);
  assert.equal(restored.run('currentResult.courtGames[0].team1.substituteIds.length'), 1);
  restored.run(`const team = currentResult.courtGames[0].team1; returnSubstitute(team.substituteIds[0], team.id);`);
  assert.equal(restored.run('currentResult.courtGames[0].team1.players.length'), 3);
  assert.equal(restored.run('currentResult.rotationPlayers.length'), 1);
  assert.equal(restored.run('approvedFormations[0].matchups[1].team1.length'), 4);
  assert.equal(restored.run('approvedFormations[0].matchups[0].team1.length'), 3);
  assert.equal(restored.run('GameCounter.totals(approvedFormations).players.get(currentResult.rotationPlayers[0].id)'), 2);
});

test('team moves and substitute assignments respect Kids and adult separation and the one-extra limit', async () => {
  const app = await boot();
  app.run(`players = Array.from({length: 26}, (_, i) => ({id: 's' + i, name: 'Player ' + i,
    category: i < 7 ? 'Kids' : i < 14 ? '18+' : 'U16', skill: i % 5 + 1}));
    currentResult = TeamOptimizer.generate(players, 3, '3', [], {kidsOnly: true, adultOnly: true});
    currentResult.championshipMode = true; renderResult(currentResult, false);
    const kidTeam = currentResult.teams.find(team => team.players[0].category === 'Kids');
    const adultTeam = currentResult.teams.find(team => team.players[0].category === '18+');
    const freeKid = currentResult.rotationPlayers.find(player => player.category === 'Kids');
    const freeAdult = currentResult.rotationPlayers.find(player => player.category === '18+');
    handleTeamMove(kidTeam.id); handleTeamMove(adultTeam.id);`);
  assert.match(app.elements.get('teamMoveStatus').textContent, /same group/);
  app.run('assignSubstitute(freeKid.id, adultTeam.id)');
  assert.equal(app.run('adultTeam.players.length'), 3);
  app.run('assignSubstitute(freeKid.id, kidTeam.id)');
  assert.equal(app.run('kidTeam.players.length'), 4);
  app.run(`const anotherKid = {id: 'extraKid', name: 'Extra Kid', category: 'Kids', skill: 2};
    currentResult.rotationPlayers.push(anotherKid); assignSubstitute(anotherKid.id, kidTeam.id);`);
  assert.equal(app.run('kidTeam.players.length'), 4);
  assert.equal(app.run('currentResult.rotationPlayers.some(player => player.id === "extraKid")'), true);
  app.run('assignSubstitute(freeAdult.id, adultTeam.id)');
  assert.equal(app.run('adultTeam.players.length'), 4);
  assert.equal(app.run('currentResult.teams.flatMap(team => team.players).filter(player => player.id === freeAdult.id).length'), 1);
});

test('automatic substitute roles are saved, restored and avoided in the next mix', async () => {
  const app = await boot();
  app.run(`document.getElementById('gameFormat').value = 'auto';
    presentPlayerIds = new Set(players.map(player => player.id));
    currentResult = TeamOptimizer.generate(players, 2, 'auto');
    renderResult(currentResult, false); approveCurrentFormation();`);
  assert.equal(app.run('approvedFormations[0].substitutePlayerIds.length'), 3);
  assert.equal(app.run('approvedFormations[0].rotationRoleIds.length'), 3);
  assert.equal(app.run('currentResult.rotationPlayers.length'), 0);
  assert.match(app.elements.get('recommendation').innerHTML, /3 players assigned/);
  const restored = await boot(app.storage);
  assert.equal(restored.run('currentResult.teams.flatMap(team => team.substituteIds || []).length'), 3);
  restored.run(`const before = new Set(approvedFormations[0].rotationRoleIds);
    const next = TeamOptimizer.generate(players, 2, 'auto', approvedFormations);`);
  assert.equal(restored.run('next.teams.flatMap(team => team.substituteIds || []).some(id => before.has(id))'), false);
});

test('manual substitute assignment is remembered for future rotation selection', async () => {
  const app = await boot();
  app.run(`currentResult = TeamOptimizer.generate(players, 1, '3');
    renderResult(currentResult, false); approveCurrentFormation();
    const substitute = currentResult.rotationPlayers[0];
    assignSubstitute(substitute.id, currentResult.teams[0].id);`);
  assert.equal(app.run('approvedFormations[0].substitutePlayerIds.includes(substitute.id)'), true);
  app.run(`returnSubstitute(substitute.id, currentResult.teams[0].id);
    const next = TeamOptimizer.generate(players, 1, '3', approvedFormations);`);
  assert.equal(app.run('approvedFormations[0].rotationRoleIds.includes(substitute.id)'), true);
  assert.equal(app.run('next.rotationPlayers.some(player => player.id === substitute.id)'), false);
});

test('one completion counts all four courts, including Kids and substitutes, and excludes waiting teams', async () => {
  const app = await boot();
  assert.equal(app.elements.get('completeAllGames').disabled, true);
  app.run(`players = Array.from({length:48}, (_, i) => ({id:'g' + i, name:'Player ' + i,
    category: i < 6 ? 'Kids' : 'U16', skill: i % 5 + 1}));
    presentPlayerIds = new Set(players.map(player => player.id));
    currentResult = TeamOptimizer.generate(players, 4, 'auto', [], {kidsOnly:true});
    renderResult(currentResult, false);`);
  assert.equal(app.elements.get('completeAllGames').disabled, true);
  app.run('completeAllGames()');
  assert.equal(app.run('approvedFormations.length'), 0);
  app.run('approveCurrentFormation()');
  app.click(0, 0, 1);
  assert.equal(app.run('approvedFormations[0].matchups.every(game => game.gamesPlayed === 1)'), true);
  assert.equal(app.run('approvedFormations[0].completions[0].matchupIndices.length'), 4);
  assert.equal(app.run('currentResult.courtGames.flatMap(game => game.team1.players.concat(game.team2.players)).every(player => GameCounter.totals(approvedFormations).players.get(player.id) === 1)'), true);
  assert.equal(app.run('currentResult.waitingTeams.flatMap(team => team.players).every(player => !GameCounter.totals(approvedFormations).players.get(player.id))'), true);
  assert.equal(app.run('currentResult.teams.flatMap(team => team.substituteIds || []).every(id => GameCounter.totals(approvedFormations).players.get(id) === 1)'), true);
  assert.match(app.elements.get('gameCompletionStatus').textContent, /1 shared game/);
  const restored = await boot(app.storage);
  restored.elements.get('undoLastCompletion').events.click();
  assert.equal(restored.run('approvedFormations[0].matchups.every(game => game.gamesPlayed === 0)'), true);
  assert.equal(restored.run('approvedFormations[0].completions[0].undone'), true);
  assert.equal(restored.elements.get('undoLastCompletion').disabled, true);
  assert.equal(restored.run('[...GameCounter.totals(approvedFormations).players.values()].every(count => count === 0)'), true);
});

test('shared undo after a team move reverses the old court assignments and leaves the new layout intact', async () => {
  const app = await boot();
  app.run(`currentResult = TeamOptimizer.generate(players, 2, '3');
    currentResult.championshipMode = true; renderResult(currentResult, false); approveCurrentFormation();
    const outgoingId = currentResult.courtGames[0].team1.id;
    const incomingId = currentResult.waitingTeams[0].id;`);
  app.click(0, 0, 1);
  app.run('handleTeamMove(outgoingId); handleTeamMove(incomingId)');
  const incomingId = app.run('incomingId');
  const restored = await boot(app.storage);
  restored.elements.get('undoLastCompletion').events.click();
  assert.equal(restored.run('currentResult.courtGames[0].team1.id'), incomingId);
  assert.equal(restored.run('approvedFormations[0].matchups.every(game => game.gamesPlayed === 0)'), true);
  restored.click(0, 0, 1);
  assert.equal(restored.run('approvedFormations[0].matchups[0].gamesPlayed'), 0);
  assert.equal(restored.run('approvedFormations[0].matchups[1].gamesPlayed'), 1);
  assert.equal(restored.run('approvedFormations[0].matchups[2].gamesPlayed'), 1);
});

test('old participant exclusions stay historical but new shared games count every roster member', async () => {
  const app = await boot();
  app.run(`currentResult = TeamOptimizer.generate(players, 1, '3');
    const extra = currentResult.rotationPlayers[0];
    assignSubstitute(extra.id, currentResult.teams[0].id); approveCurrentFormation();
    const legacy = approvedFormations[0].matchups[0]; legacy.gamesPlayed = 1;
    legacy.participatingPlayerIds = legacy.participatingPlayerIds.filter(id => id !== extra.id);
    currentResult.courtGames[0].participatingPlayerIds = [...legacy.participatingPlayerIds];
    saveEveningSession();`);
  app.click(0, 0, 1);
  assert.equal(app.run('approvedFormations[0].matchups.length'), 2);
  assert.equal(app.run('approvedFormations[0].matchups[0].gamesPlayed'), 1);
  assert.equal(app.run('GameCounter.totals(approvedFormations).players.get(extra.id)'), 1);
  assert.equal(app.run('GameCounter.totals(approvedFormations).players.get(currentResult.teams[0].players[0].id)'), 2);
  assert.doesNotMatch(app.elements.get('courtResults').children.at(-1).innerHTML, /data-game-participant|Who took part/);
  app.elements.get('undoLastCompletion').events.click();
  assert.equal(app.run('GameCounter.totals(approvedFormations).players.get(extra.id)'), 0);
  assert.equal(app.run('approvedFormations[0].matchups[0].gamesPlayed'), 1);
});

test('team moves are standard for new formations and older saved sessions with championship mode off', async () => {
  const app = await boot();
  assert.equal(app.elements.has('championshipMode'), false);
  app.run(`currentResult = TeamOptimizer.generate(players, 1, '3');
    renderResult(currentResult, false); approveCurrentFormation();`);
  assert.equal(app.run('currentResult.championshipMode'), true);
  assert.match(app.elements.get('courtResults').children.at(-1).innerHTML, /data-move-team/);
  app.click(0, 0, 1);
  for (const [key, value] of app.storage) {
    const session = JSON.parse(value);
    if (session.activeFormation) {
      session.activeFormation.result.championshipMode = false;
      app.storage.set(key, JSON.stringify(session));
    }
  }
  const restored = await boot(app.storage);
  assert.equal(restored.run('currentResult.championshipMode'), true);
  restored.run(`const incoming = currentResult.waitingTeams[0];
    const outgoing = currentResult.courtGames[0].team1;
    handleTeamMove(incoming.id); handleTeamMove(outgoing.id);`);
  assert.equal(restored.run('currentResult.courtGames[0].team1.id === incoming.id'), true);
  assert.equal(restored.run('approvedFormations[0].matchups[0].gamesPlayed'), 1);
});

test('underfilled Kids basket offers mixing, and cancelling preserves the current formation', async () => {
  const app = await boot();
  app.run(`players.slice(0, 4).forEach(player => player.category = 'Kids');
    presentPlayerIds = new Set(players.map(player => player.id));
    currentResult = TeamOptimizer.generate(players, 2, '3');
    renderResult(currentResult, false); const original = currentResult;
    kidsOnlyMode.checked = true;`);
  const cancelled = app.run('generateTeams(false)');
  assert.equal(app.elements.get('kidsCourtDialog').open, true);
  assert.match(app.elements.get('kidsCourtChoiceMessage').textContent, /4 Kids selected/);
  app.elements.get('keepKidsCourt').events.click();
  assert.equal(app.elements.get('confirmKidsGroup').disabled, true);
  assert.match(app.elements.get('kidsCourtSetupStatus').textContent, /2 empty places/);
  app.elements.get('confirmKidsGroup').events.click();
  assert.equal(app.elements.get('kidsCourtDialog').open, true);
  app.elements.get('cancelKidsCourt').events.click();
  await cancelled;
  assert.equal(app.run('currentResult === original'), true);
  assert.equal(app.run('sessionDunkers.length'), 0);
  const mixed = app.run('generateTeams(false)');
  app.elements.get('mixKidsCourt').events.click();
  await mixed;
  assert.equal(app.elements.get('kidsCourtDialog').open, false);
  assert.equal(app.elements.get('kidsOnlyMode').checked, false);
  assert.equal(app.run('currentResult.plan.specialKidsCourt'), false);
});

test('a U14 helper and a Dunker fill two Kids places, stay separate, and survive a session reload', async () => {
  const input = Array.from({ length: 19 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`,
    category: i < 4 ? 'Kids' : i < 8 ? 'U14' : 'U16', skill: i % 5 + 1 }));
  const app = await boot(new Map(), 'modern', input);
  app.run(`presentPlayerIds = new Set(players.map(player => player.id)); kidsOnlyMode.checked = true;`);
  const generated = app.run('generateTeams(false)');
  app.elements.get('keepKidsCourt').events.click();
  app.elements.get('kidsCourtSlots').events.change({ target: { closest: () => ({ dataset: { kidsSlot: '4' }, value: 'p4' }) } });
  app.elements.get('kidsCourtSlots').events.click({ target: { closest: selector =>
    selector === 'button[data-add-dunker]' ? { dataset: { addDunker: '5' } } : null } });
  assert.equal(app.elements.get('confirmKidsGroup').disabled, false);
  assert.equal(app.run('sessionDunkers.length'), 0, 'draft guests are not committed early');
  app.elements.get('confirmKidsGroup').events.click();
  await generated;
  assert.equal(app.run('currentResult.plan.specialKidsCourt'), true);
  assert.equal(app.run('currentResult.kidsGroupPlayerIds.includes("p4")'), true);
  assert.equal(app.run('sessionDunkers[0].name'), 'Dunker 1');
  assert.equal(app.run('sessionDunkers[0].skill'), null);
  assert.equal(app.run('localPlayers.length'), 0);
  assert.equal(app.run('currentResult.teams.filter(team => teamGroup(team) !== "Kids").some(team => team.players.some(player => player.id === "p4" || player.isPlaceholder))'), false);
  assert.equal(app.run('new Set(currentResult.teams.flatMap(team => team.players).concat(currentResult.rotationPlayers).map(player => player.id)).size'), 20);
  assert.match(app.elements.get('courtResults').children[0].innerHTML, /unrated|Skill unknown/);
  app.run('approveCurrentFormation()');
  app.click(0, 0, 1);
  assert.equal(app.run('GameCounter.totals(approvedFormations).players.get(sessionDunkers[0].id)'), 1);
  const guestId = app.run('sessionDunkers[0].id');
  app.elements.get('resultsSection').events.change({ target: { closest: () => ({ dataset: { dunkerSkill: guestId }, value: '5' }) } });
  assert.equal(app.run('sessionDunkers[0].skill'), 5);
  assert.equal(app.run('currentResult.teams.filter(team => teamGroup(team) === "Kids").every(team => team.knownSkillCount === 3)'), true);
  const restored = await boot(app.storage, 'modern', input);
  assert.equal(restored.run('sessionDunkers.length'), 1);
  assert.equal(restored.run('sessionDunkers[0].skill'), 5);
  assert.equal(restored.run('currentResult.kidsGroupPlayerIds.includes("p4")'), true);
  assert.equal(restored.run('getPresentPlayers().some(player => player.id === sessionDunkers[0].id)'), true);
  const edited = restored.elements.get('editKidsGroup').events.click();
  assert.equal(restored.elements.get('kidsCourtDialog').open, true);
  restored.elements.get('kidsCourtSlots').events.change({ target: { closest: () => ({ dataset: { kidsSlot: '5' }, value: 'p5' }) } });
  restored.elements.get('confirmKidsGroup').events.click();
  await edited;
  assert.equal(restored.run('sessionDunkers.length'), 0);
  assert.equal(restored.run('currentResult.kidsGroupPlayerIds.includes("p5")'), true);
  assert.equal(restored.run(`players.some(player => player.id === ${JSON.stringify(guestId)})`), false);
  assert.equal(restored.run(`GameCounter.totals(approvedFormations).players.get(${JSON.stringify(guestId)})`), 1);
  restored.run('startNewSession()');
  assert.equal(restored.run('sessionDunkers.length'), 0);
  assert.equal(restored.run('players.some(player => player.isPlaceholder)'), false);
  assert.equal(restored.run('localPlayers.length'), 0);
});

test('Dunkers can complete a Kids-only session with fewer than six actual participants and no invented ratings', async () => {
  const input = [{ id: 'a', name: 'Kid A', category: 'Kids', skill: 2 }, { id: 'b', name: 'Kid B', category: 'Kids', skill: 4 }];
  const app = await boot(new Map(), 'modern', input);
  app.run(`presentPlayerIds = new Set(players.map(player => player.id)); kidsOnlyMode.checked = true; courts = 1;`);
  const generated = app.run('generateTeams(false)');
  app.elements.get('keepKidsCourt').events.click();
  for (let index = 2; index < 6; index++) app.run(`addDunkerToSlot(${index})`);
  app.elements.get('confirmKidsGroup').events.click();
  await generated;
  assert.equal(app.run('sessionDunkers.length'), 4);
  assert.equal(app.run('new Set(sessionDunkers.map(player => player.name)).size'), 4);
  assert.equal(app.run('currentResult.teams.length'), 2);
  assert.equal(app.run('currentResult.teams.every(team => team.players.length === 3)'), true);
  assert.equal(app.run('currentResult.teams.every(team => team.averageSkill === null || [2,3,4].includes(team.averageSkill))'), true);
  assert.equal(app.run('sessionDunkers.every(player => player.skill === null)'), true);
  assert.equal(app.run('approvedFormations.length'), 0);
});
