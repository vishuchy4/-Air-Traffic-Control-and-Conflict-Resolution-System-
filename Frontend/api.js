let BACKEND = false;
let backendAnswer = null;
let backendTests = {};
let backendBusy = false;

async function askBackend(path, data) {
  const response = await fetch(path, {
    method: 'POST',
    body: new URLSearchParams(data)
  });
  if (!response.ok) throw new Error(path + ' answered ' + response.status);
  return response.json();
}

function penaltiesText() {
  return cities.map((c, i) => weatherPenalty(i)).join(',');
}

const STATUS_NUMBER = {
  flying: 0,
  landed: 1,
  crashed: 2,
  holding: 3,
  scheduled: 4
};

function planeText(p) {
  return [
    p.id,
    p.priority,
    p.route.join(','),
    p.leg,
    p.progress.toFixed(5),
    p.altitude,
    p.speed,
    STATUS_NUMBER[p.status]
  ].join(';');
}

async function connectBackend() {
  try {
    const info = await (await fetch('/api/ping')).json();
    if (!info.ok) return;

    const map = await (await fetch('/api/airspace')).json();

    const same =
      map.roads.length === edges.length &&
      map.roads.every(r => {
        const e = edgeBetween(r.from, r.to);
        return e && e.distance === r.km;
      }) &&
      map.cities.every((c, i) =>
        c.macro === (cities[i].macro ? 1 : 0) &&
        c.region === cities[i].region
      );

    BACKEND = true;

    addLog(
      'Connected to the C++ backend. Airspace check: ' +
      map.roads.length +
      ' roads, ' +
      (same
        ? 'all distances and regions match the UI.'
        : 'DIFFERENT data from the UI!')
    );

    setInterval(pollBackend, 250);
  } catch (error) {
    BACKEND = false;
  }

  showPanels();
}

async function backendRoutes(from, to) {
  const answer = await askBackend('/api/routes', {
    from: from,
    to: to,
    pen: penaltiesText()
  });

  return answer.options.map(o => ({
    path: o.path,
    cost: o.cost
  }));
}

async function pollBackend() {
  if (!BACKEND || backendBusy) return;

  backendBusy = true;

  try {
    backendAnswer = await askBackend('/api/check', {
      planes: flights.map(planeText).join('|'),
      pen: penaltiesText()
    });

    const first = backendAnswer.predictions[0];

    if (first) {
      const a = findFlight(first.a);
      const b = findFlight(first.b);
      const key = first.a + '+' + first.b;

      for (const [change, other] of [[a, b], [b, a]]) {
        if (!change || !other) continue;

        const answer = await askBackend('/api/whatif', {
          change: planeText(change),
          other: planeText(other),
          pen: penaltiesText()
        });

        backendTests[change.id + '|' + key] = answer.tests;
      }
    }
  } catch (error) {
    BACKEND = false;
    addLog('The C++ backend stopped answering. The UI continues alone (JavaScript).');
  }

  backendBusy = false;
}

async function backendNow() {
  while (backendBusy) {
    await new Promise(done => setTimeout(done, 20));
  }

  await pollBackend();
}

function backendConflictPairs() {
  return backendAnswer.conflicts
    .filter(c =>
      findFlight(c.a) &&
      findFlight(c.b) &&
      findFlight(c.a).status === 'flying' &&
      findFlight(c.b).status === 'flying'
    )
    .map(c => c.a + '+' + c.b);
}

function backendPredictions() {
  const toMap = pt => ({
    lat: pt.lat,
    lon: pt.lon,
    x: (pt.lon - 68) * 24 + 40,
    y: (35 - pt.lat) * 24 + 40
  });

  return backendAnswer.predictions
    .map(pr => ({
      a: findFlight(pr.a),
      b: findFlight(pr.b),
      key: pr.a + '+' + pr.b,
      start: pr.start,
      km: pr.km,
      feet: pr.feet,
      p: toMap(pr.pa),
      q: toMap(pr.pb)
    }))
    .filter(pr =>
      pr.a &&
      pr.b &&
      pr.a.status === 'flying' &&
      pr.b.status === 'flying' &&
      !activeConflicts.includes(pr.key)
    );
}

function backendWhatIf(pr, plane) {
  const tests = backendTests[plane.id + '|' + pr.key];

  if (!tests) return null;

  return tests.map(t => ({
    kind: t.kind,
    amount: t.amount,
    label:
      t.kind === 'alt'
        ? (t.amount > 0 ? 'Raise ' : 'Lower ') + plane.id + ' by 1,000 ft'
        : t.kind === 'spd'
          ? 'Slow ' + plane.id + ' by 100 km/h'
          : 'Send ' + plane.id + ' on another route',
    fixes: t.result === -1 ? null : t.result === 1
  }));
}

function showBackendBadge() {
  const badge = $('backendBadge');
  badge.textContent = 'C++ backend: connected';
  badge.className = 'pill green' + (BACKEND ? '' : ' hidden');
}let BACKEND = false;
let backendAnswer = null;
let backendTests = {};
let backendBusy = false;

async function askBackend(path, data) {
  const response = await fetch(path, {
    method: 'POST',
    body: new URLSearchParams(data)
  });
  if (!response.ok) throw new Error(path + ' answered ' + response.status);
  return response.json();
}

function penaltiesText() {
  return cities.map((c, i) => weatherPenalty(i)).join(',');
}

const STATUS_NUMBER = {
  flying: 0,
  landed: 1,
  crashed: 2,
  holding: 3,
  scheduled: 4
};

function planeText(p) {
  return [
    p.id,
    p.priority,
    p.route.join(','),
    p.leg,
    p.progress.toFixed(5),
    p.altitude,
    p.speed,
    STATUS_NUMBER[p.status]
  ].join(';');
}

async function connectBackend() {
  try {
    const info = await (await fetch('/api/ping')).json();
    if (!info.ok) return;

    const map = await (await fetch('/api/airspace')).json();

    const same =
      map.roads.length === edges.length &&
      map.roads.every(r => {
        const e = edgeBetween(r.from, r.to);
        return e && e.distance === r.km;
      }) &&
      map.cities.every((c, i) =>
        c.macro === (cities[i].macro ? 1 : 0) &&
        c.region === cities[i].region
      );

    BACKEND = true;

    addLog(
      'Connected to the C++ backend. Airspace check: ' +
      map.roads.length +
      ' roads, ' +
      (same
        ? 'all distances and regions match the UI.'
        : 'DIFFERENT data from the UI!')
    );

    setInterval(pollBackend, 250);
  } catch (error) {
    BACKEND = false;
  }

  showPanels();
}

async function backendRoutes(from, to) {
  const answer = await askBackend('/api/routes', {
    from: from,
    to: to,
    pen: penaltiesText()
  });

  return answer.options.map(o => ({
    path: o.path,
    cost: o.cost
  }));
}

async function pollBackend() {
  if (!BACKEND || backendBusy) return;

  backendBusy = true;

  try {
    backendAnswer = await askBackend('/api/check', {
      planes: flights.map(planeText).join('|'),
      pen: penaltiesText()
    });

    const first = backendAnswer.predictions[0];

    if (first) {
      const a = findFlight(first.a);
      const b = findFlight(first.b);
      const key = first.a + '+' + first.b;

      for (const [change, other] of [[a, b], [b, a]]) {
        if (!change || !other) continue;

        const answer = await askBackend('/api/whatif', {
          change: planeText(change),
          other: planeText(other),
          pen: penaltiesText()
        });

        backendTests[change.id + '|' + key] = answer.tests;
      }
    }
  } catch (error) {
    BACKEND = false;
    addLog('The C++ backend stopped answering. The UI continues alone (JavaScript).');
  }

  backendBusy = false;
}

async function backendNow() {
  while (backendBusy) {
    await new Promise(done => setTimeout(done, 20));
  }

  await pollBackend();
}

function backendConflictPairs() {
  return backendAnswer.conflicts
    .filter(c =>
      findFlight(c.a) &&
      findFlight(c.b) &&
      findFlight(c.a).status === 'flying' &&
      findFlight(c.b).status === 'flying'
    )
    .map(c => c.a + '+' + c.b);
}

function backendPredictions() {
  const toMap = pt => ({
    lat: pt.lat,
    lon: pt.lon,
    x: (pt.lon - 68) * 24 + 40,
    y: (35 - pt.lat) * 24 + 40
  });

  return backendAnswer.predictions
    .map(pr => ({
      a: findFlight(pr.a),
      b: findFlight(pr.b),
      key: pr.a + '+' + pr.b,
      start: pr.start,
      km: pr.km,
      feet: pr.feet,
      p: toMap(pr.pa),
      q: toMap(pr.pb)
    }))
    .filter(pr =>
      pr.a &&
      pr.b &&
      pr.a.status === 'flying' &&
      pr.b.status === 'flying' &&
      !activeConflicts.includes(pr.key)
    );
}

function backendWhatIf(pr, plane) {
  const tests = backendTests[plane.id + '|' + pr.key];

  if (!tests) return null;

  return tests.map(t => ({
    kind: t.kind,
    amount: t.amount,
    label:
      t.kind === 'alt'
        ? (t.amount > 0 ? 'Raise ' : 'Lower ') + plane.id + ' by 1,000 ft'
        : t.kind === 'spd'
          ? 'Slow ' + plane.id + ' by 100 km/h'
          : 'Send ' + plane.id + ' on another route',
    fixes: t.result === -1 ? null : t.result === 1
  }));
}

function showBackendBadge() {
  const badge = $('backendBadge');
  badge.textContent = 'C++ backend: connected';
  badge.className = 'pill green' + (BACKEND ? '' : ' hidden');
}