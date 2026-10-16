
const NO_DATA = { src: 'none', temp: 0, wind: 0, rain: 0, code: 0 };
const weather = cities.map(() => ({ ...NO_DATA }));
let weatherTime = '';
let weatherFailed = false;
let lastStrip = '';
let searchResult = null;
let keptRoutes = [];
let weatherReroutes = 0;

const STATUS_SOURCE = {
  live: '',
  hand: ' · by hand',
  sample: '',
  none: ''
};

const STATUS_NUMBER = {
  flying: 0,
  landed: 1,
  crashed: 2,
  holding: 3,
  scheduled: 4
};

const SEVERE = 3;

const SAMPLE = {
  Delhi: [31, 12, 0, 1],
  Mumbai: [29, 26, 7, 63],
  Bengaluru: [24, 14, 0, 3],
  Chennai: [32, 18, 0, 2],
  Kolkata: [28, 48, 9, 95],
  Hyderabad: [29, 13, 0, 1],
  Ahmedabad: [33, 15, 0, 0],
  Pune: [27, 12, 1, 61],
  Jaipur: [32, 16, 0, 0],
  Lucknow: [30, 10, 0, 2],
  Chandigarh: [27, 9, 0, 1],
  Dehradun: [24, 8, 2, 61],
  Agra: [32, 11, 0, 0],
  Bhopal: [28, 13, 0, 2],
  Indore: [27, 14, 0, 3],
  Nagpur: [30, 12, 0, 1],
  Patna: [31, 20, 3, 80],
  Varanasi: [31, 12, 0, 1],
  Guwahati: [26, 22, 6, 81],
  Bhubaneswar: [29, 28, 4, 80],
  Visakhapatnam: [29, 24, 0, 2],
  Kochi: [27, 20, 8, 63],
  Thiruvananthapuram: [28, 18, 5, 61],
  Goa: [28, 22, 4, 80],
  Srinagar: [14, 5, 0, 45],
  Raipur: [30, 11, 0, 1]
};

const HAND_WEATHER = [
  { temp: 28, wind: 10, rain: 0, code: 0 },
  { temp: 26, wind: 55, rain: 12, code: 95 },
  { temp: 14, wind: 5, rain: 0, code: 45 },
  { temp: 24, wind: 45, rain: 10, code: 65 }
];

function weatherPenalty(i) {
  const w = weather[i];
  if (!w || w.src === 'none') return 0;
  return penaltyFromValues(w.wind, w.rain, w.code);
}

function penaltyFromValues(wind, rain, code) {
  let penalty = 0;

  if (Number(wind) > 40) penalty += 2;
  if (Number(rain) > 5) penalty += 2;
  if (Number(code) === 45 || Number(code) === 48) penalty += 3;
  if (Number(code) >= 95) penalty += 3;

  return penalty;
}

function weatherLook(code) {
  code = Number(code);

  if (code >= 95) return ['⛈️', 'Thunderstorm'];
  if (code >= 80) return ['🌦️', 'Rain showers'];
  if (code >= 61) return ['🌧️', 'Rain'];
  if (code >= 51) return ['🌦️', 'Drizzle'];
  if (code >= 45) return ['🌫️', 'Fog'];
  if (code === 3) return ['☁️', 'Cloudy'];
  if (code >= 1) return ['⛅', 'Partly cloudy'];

  return ['☀️', 'Clear sky'];
}

function weatherLine(i) {
  const w = weather[i];

  if (!w || w.src === 'none') {
    return cities[i].name + ': weather not available';
  }

  const look = weatherLook(w.code);
  const penalty = weatherPenalty(i);

  return look[0] + ' ' + cities[i].name + ': ' + look[1] +
    ', ' + Math.round(w.temp) + '°C, wind ' + Math.round(w.wind) + ' km/h' +
    (penalty ? ' (bad weather, +' + penalty + ')' : '') +
    (w.src === 'hand' ? ' [set by hand]' : '');
}

function badWeatherCount() {
  return cities.filter((c, i) => weatherPenalty(i) > 0).length;
}

function weatherStatus() {
  const sample = weather.some(w => w.src === 'sample');

  if (sample) return '<b>Sample weather</b> (not real).';

  if (weatherTime) {
    return '<b>Live weather</b> from Open-Meteo, updated <b>' +
      escapeWeatherHTML(weatherTime) + '</b>';
  }

  if (weatherFailed) return '<b>Live weather unavailable.</b>';

  return 'Loading live weather...';
}

function escapeWeatherHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

async function loadWeather() {
  if (!cities.length) {
    weatherFailed = true;
    showWeatherPanels();
    return;
  }

  const lats = cities.map(c => c.lat).join(',');
  const lons = cities.map(c => c.lon).join(',');

  const url =
    'https://api.open-meteo.com/v1/forecast?latitude=' +
    encodeURIComponent(lats) +
    '&longitude=' +
    encodeURIComponent(lons) +
    '&current=temperature_2m,wind_speed_10m,precipitation,weather_code';

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Weather request failed: ' + response.status);
    }

    const data = await response.json();
    const items = Array.isArray(data) ? data : [data];

    if (!items.length || !items.some(item => item && item.current)) {
      throw new Error('Weather data is missing.');
    }

    let updated = 0;

    items.forEach((item, i) => {
      if (i >= weather.length || !item || !item.current) return;
      if (weather[i].src === 'hand') return;

      const current = item.current;

      if (
        current.temperature_2m == null ||
        current.wind_speed_10m == null ||
        current.weather_code == null
      ) {
        return;
      }

      weather[i] = {
        src: 'live',
        temp: Number(current.temperature_2m),
        wind: Number(current.wind_speed_10m),
        rain: Number(current.precipitation ?? 0),
        code: Number(current.weather_code)
      };

      updated++;
    });

    if (!updated) {
      throw new Error('No usable weather readings were returned.');
    }

    weatherTime = new Date().toLocaleTimeString();
    weatherFailed = false;

    if (typeof addLog === 'function') {
      addLog('Live weather updated for ' + updated + ' cities.');
    }
  } catch (error) {
    weatherFailed = true;

    if (typeof addLog === 'function') {
      addLog('Live weather could not be loaded. Check your internet connection.');
    }
  }

  if (typeof plan !== 'undefined' && plan &&
      typeof refreshPlanRoutes === 'function') {
    refreshPlanRoutes();
  }

  showWeatherPanels();
}

function useSampleWeather() {
  cities.forEach((c, i) => {
    if (weather[i].src === 'hand') return;

    const values = SAMPLE[c.name];

    if (!values) {
      weather[i] = { ...NO_DATA };
      return;
    }

    const [temp, wind, rain, code] = values;

    weather[i] = {
      src: 'sample',
      temp,
      wind,
      rain,
      code
    };
  });

  weatherTime = '';
  weatherFailed = false;

  if (typeof addLog === 'function') {
    addLog('Sample weather turned on (not real data).');
  }

  if (typeof plan !== 'undefined' && plan &&
      typeof refreshPlanRoutes === 'function') {
    refreshPlanRoutes();
  }

  showWeatherPanels();
}

function cycleWeather(i) {
  if (!Number.isInteger(i) || i < 0 || i >= cities.length) return;

  const w = weather[i] || NO_DATA;
  const currentIndex = w.src === 'hand'
    ? HAND_WEATHER.findIndex(h => h.code === w.code)
    : -1;

  const next = HAND_WEATHER[(currentIndex + 1) % HAND_WEATHER.length];

  weather[i] = {
    src: 'hand',
    temp: next.temp,
    wind: next.wind,
    rain: next.rain,
    code: next.code
  };

  if (typeof addLog === 'function') {
    addLog(
      cities[i].name + ': weather set by hand to ' +
      weatherLook(next.code)[1] +
      ' (penalty +' + weatherPenalty(i) + ').'
    );
  }

  if (typeof plan !== 'undefined' && plan &&
      typeof refreshPlanRoutes === 'function') {
    refreshPlanRoutes();
  }

  showWeatherPanels();
}

function backToLive() {
  weather.forEach((w, i) => {
    if (w.src !== 'live') {
      weather[i] = { ...NO_DATA };
    }
  });

  weatherTime = '';
  weatherFailed = false;

  if (typeof addLog === 'function') {
    addLog('Back to live weather.');
  }

  loadWeather();
}

function weatherButtons() {
  const hasSample = weather.some(w => w.src === 'sample');
  const hasManual = weather.some(w => w.src === 'hand');
  const notLive = !weatherTime || hasSample;

  return (
    (notLive && !hasSample
      ? ' <button class="mini go" onclick="useSampleWeather()">Use sample weather</button>'
      : '') +
    (hasManual || hasSample
      ? ' <button class="mini" onclick="backToLive()">Back to live</button>'
      : '')
  );
}

function showWeatherStrip() {
  const element = typeof $ === 'function' ? $('weatherStrip') : null;
  if (!element) return;

  const order = cities.map((c, i) => i).sort(
    (a, b) =>
      weatherPenalty(b) - weatherPenalty(a) ||
      cities[a].name.localeCompare(cities[b].name)
  );

  const known = order.filter(i => weather[i].src !== 'none');

  const chips = known.map(i => {
    const w = weather[i];
    const look = weatherLook(w.code);
    const penalty = weatherPenalty(i);

    return '<span class="wchip' + (penalty ? ' bad' : '') +
      '" onclick="cycleWeather(' + i + ')">' +
      look[0] + ' <b>' + escapeWeatherHTML(cities[i].name) + '</b> ' +
      Math.round(w.temp) + '° · ' + Math.round(w.wind) + ' km/h' +
      (penalty ? ' · +' + penalty : '') +
      (STATUS_SOURCE[w.src] || '') +
      '</span>';
  }).join('');

  const html =
    '<div class="wstatus">' + weatherStatus() + weatherButtons() + '</div>' +
    (chips
      ? '<div class="ticker"><div class="track">' + chips + chips + '</div></div>'
      : '<div class="small muted">No weather data yet.</div>');

  if (html !== lastStrip) {
    element.innerHTML = html;
    lastStrip = html;
  }
}

function weatherTabHTML() {
  let html =
    '<p class="small">' + weatherStatus() + weatherButtons() + '</p>' +
    '<p class="small muted">Click a city to change its weather (for the demo).</p>' +
    '<div class="wgrid">';

  const order = cities.map((c, i) => i).sort(
    (a, b) =>
      weatherPenalty(b) - weatherPenalty(a) ||
      cities[a].name.localeCompare(cities[b].name)
  );

  order.forEach(i => {
    const w = weather[i];
    const penalty = weatherPenalty(i);
    const has = w.src !== 'none';
    const look = has ? weatherLook(w.code) : ['—', 'No data'];

    html +=
      '<div class="wcard' +
      (penalty ? ' bad' : '') +
      (has ? '' : ' dim') +
      '" onclick="cycleWeather(' + i + ')">' +
      '<div class="wtop"><span>' + look[0] + '</span><b>' +
      (has ? Math.round(w.temp) + '°' : '') +
      '</b>' + (penalty ? '<i>+' + penalty + '</i>' : '') +
      '</div>' +
      '<div class="wname">' + escapeWeatherHTML(cities[i].name) + '</div>' +
      '<div class="wsub">' + look[1] +
      (has ? ' · ' + Math.round(w.wind) + ' km/h' : '') +
      (STATUS_SOURCE[w.src] || '') +
      '</div></div>';
  });

  return html + '</div>';
}

function weatherAlerts() {
  const list = [];
  if (typeof flights === 'undefined' || !Array.isArray(flights)) return list;

  flights.forEach(f => {
    if (f.status !== 'flying' || !Array.isArray(f.route) || !f.route.length) {
      return;
    }

    const dest = f.route[f.route.length - 1];
    const ahead = f.route.slice(f.leg + 1, -1);
    const storms = ahead.filter(c => weatherPenalty(c) >= SEVERE);

    if (storms.length) {
      const key = f.id + '@' + storms.join(',');

      if (!keptRoutes.includes(key)) {
        list.push({
          plane: f,
          key,
          kind: 'route',
          cities: storms,
          fix: stormReroute(f, storms)
        });
      }
    } else if (weatherPenalty(dest) >= SEVERE) {
      const key = f.id + '@dest' + dest;

      if (!keptRoutes.includes(key)) {
        list.push({
          plane: f,
          key,
          kind: 'dest',
          cities: [dest],
          fix: null
        });
      }
    }
  });

  return list;
}

function stormReroute(plane, storms) {
  if (
    typeof dijkstra !== 'function' ||
    typeof routeKm !== 'function' ||
    !Array.isArray(plane.route) ||
    plane.route.length < 2
  ) {
    return null;
  }

  let startLeg;

  if (plane.progress < 0.3) {
    startLeg = plane.leg;
  } else if (!storms.includes(plane.route[plane.leg + 1])) {
    startLeg = plane.leg + 1;
  } else {
    return null;
  }

  if (
    startLeg < 0 ||
    startLeg >= plane.route.length ||
    plane.route[startLeg] == null
  ) {
    return null;
  }

  const dest = plane.route[plane.route.length - 1];
  const answer = dijkstra(plane.route[startLeg], dest, null, storms);

  if (!answer || !Array.isArray(answer.path) || !answer.path.length) {
    return null;
  }

  const route = plane.route.slice(0, startLeg).concat(answer.path);

  return {
    route,
    startLeg,
    extraKm: routeKm(route) - routeKm(plane.route)
  };
}

function applyStormReroute(id) {
  const alert = weatherAlerts().find(a => a.plane.id === id);
  if (!alert || !alert.fix) return;

  const plane = alert.plane;

  if (alert.fix.startLeg === plane.leg && plane.progress > 0) {
    plane.progress = 0;
    plane.trail = [];
  }

  plane.route = alert.fix.route;
  weatherReroutes++;

  if (typeof addLog === 'function') {
    addLog(
      'You flew ' + id + ' around bad weather at ' +
      alert.cities.map(c => cities[c].name).join(', ') + ': ' +
      plane.route.map(c => cities[c].name).join(' › ') + '.'
    );
  }

  if (typeof checkConflicts === 'function') checkConflicts();
  showWeatherPanels();
}

function keepRoute(key) {
  if (!keptRoutes.includes(key)) keptRoutes.push(key);

  if (typeof addLog === 'function') {
    addLog('You kept the route of ' + key.split('@')[0] + ' through the bad weather.');
  }

  showWeatherPanels();
}

function weatherAlertsHTML(list) {
  if (!list || !list.length) {
    return '<div class="okbox">No severe weather on any flight route.</div>';
  }

  return list.map(a => {
    const where = a.cities.map(c => {
      const look = weatherLook(weather[c].code);

      return look[0] + ' ' + escapeWeatherHTML(cities[c].name) +
        ' (' + look[1].toLowerCase() + ', +' + weatherPenalty(c) + ')';
    }).join(', ');

    const safeId = escapeWeatherHTML(a.plane.id);
    const safeKey = escapeWeatherHTML(a.key);

    if (a.kind === 'dest') {
      return '<div class="wxalert"><b>' + safeId +
        '</b>: bad weather at its destination ' + where +
        '. It cannot avoid its destination. Real ATC would make it hold or divert. ' +
        '<button class="mini" onclick="keepRoute(\'' + safeKey + '\')">OK</button></div>';
    }

    const fix = a.fix;

    const suggestion = fix
      ? 'Way around: ' +
        fix.route.slice(fix.startLeg).map(c => escapeWeatherHTML(cities[c].name)).join(' › ') +
        ' (' + (fix.extraKm >= 0 ? '+' : '') + Math.round(fix.extraKm) +
        ' km, ' + (fix.extraKm >= 0 ? '+' : '') +
        Math.round(fix.extraKm / Math.max(Number(a.plane.speed) || 1, 1) * 60) +
        ' min). ' +
        '<button class="mini go" onclick="applyStormReroute(\'' +
        safeId + '\')">Fly around it</button>'
      : 'Too late to avoid it, or no alternative route is available. ';

    return '<div class="wxalert"><b>' + safeId +
      '</b> will fly through ' + where + '.<br>' + suggestion +
      '<button class="mini" onclick="keepRoute(\'' +
      safeKey + '\')">Keep route</button></div>';
  }).join('');
}

async function searchWeather() {
  const input = typeof $ === 'function' ? $('weatherSearch') : null;
  const text = input ? input.value.trim() : '';

  if (!text) return;

  searchResult = { loading: true, name: text };
  showSearchResult();

  try {
    let place;

    const ours = cities.findIndex(
      c => c.name.toLowerCase() === text.toLowerCase()
    );

    if (ours >= 0) {
      place = {
        name: cities[ours].name,
        lat: cities[ours].lat,
        lon: cities[ours].lon,
        where: typeof cityType === 'function' ? cityType(ours) : '',
        inNetwork: true
      };
    } else {
      const geoResponse = await fetch(
        'https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=' +
        encodeURIComponent(text)
      );

      if (!geoResponse.ok) {
        throw new Error('Geocoding request failed.');
      }

      const geo = await geoResponse.json();

      if (!geo.results || !geo.results.length) {
        searchResult = {
          error: 'No place called "' + text + '" was found. Check the spelling.'
        };
        showSearchResult();
        return;
      }

      const r = geo.results[0];

      place = {
        name: r.name,
        lat: r.latitude,
        lon: r.longitude,
        where: [r.admin1, r.country].filter(Boolean).join(', '),
        inNetwork: false
      };
    }

    const url =
      'https://api.open-meteo.com/v1/forecast?latitude=' + place.lat +
      '&longitude=' + place.lon +
      '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max' +
      '&past_days=5&forecast_days=1&timezone=auto';

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Forecast request failed.');
    }

    const data = await response.json();

    if (!data.daily || !Array.isArray(data.daily.time)) {
      throw new Error('Daily weather data is unavailable.');
    }

    const d = data.daily;

    const days = d.time.map((date, k) => ({
      date,
      code: d.weather_code?.[k] ?? null,
      max: d.temperature_2m_max?.[k] ?? null,
      min: d.temperature_2m_min?.[k] ?? null,
      rain: d.precipitation_sum?.[k] ?? null,
      wind: d.wind_speed_10m_max?.[k] ?? null
    }));

    const penalties = await dayPenalties(days);

    days.forEach((day, k) => {
      day.penalty = Number(penalties[k] ?? 0);
    });

    searchResult = {
      ...place,
      current: data.current || {},
      days
    };
  } catch (error) {
    searchResult = {
      error: 'Weather search failed. Check your internet connection and try again.'
    };
  }

  showSearchResult();
}

async function dayPenalties(days) {
  if (typeof BACKEND !== 'undefined' && BACKEND) {
    try {
      const answer = await askBackend('/api/penalty', {
        rows: days.map(d =>
          [d.wind ?? 0, d.rain ?? 0, d.code ?? 0].join(',')
        ).join(';')
      });

      if (
        Array.isArray(answer.penalties) &&
        answer.penalties.length === days.length
      ) {
        return answer.penalties;
      }
    } catch (error) {
    }
  }

  return days.map(d =>
    penaltyFromValues(d.wind ?? 0, d.rain ?? 0, d.code ?? 0)
  );
}

function showSearchResult() {
  if (typeof setHTML === 'function') {
    setHTML('weatherSearchResult', searchResultHTML());
    return;
  }

  const element = typeof $ === 'function' ? $('weatherSearchResult') : null;

  if (element) element.innerHTML = searchResultHTML();
}

function searchResultHTML() {
  const r = searchResult;

  if (!r) return '';

  if (r.loading) {
    return '<p class="muted">Searching ' + escapeWeatherHTML(r.name) + '...</p>';
  }

  if (r.error) {
    return '<div class="waitbox">' + escapeWeatherHTML(r.error) + '</div>';
  }

  const value = (v, unit) =>
    v === null || v === undefined || !Number.isFinite(Number(v))
      ? '-'
      : Math.round(Number(v)) + unit;

  const dayName = (date, k) =>
    k === r.days.length - 1
      ? 'Today'
      : new Date(date + 'T00:00').toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short'
        });

  const past = r.days.slice(0, -1);
  const known = list => list.filter(v => v !== null && v !== undefined && Number.isFinite(Number(v)));
  const average = list => {
    const values = known(list).map(Number);
    return values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null;
  };
  const total = list => known(list).reduce((a, b) => a + Number(b), 0);

  const now = r.current || {};
  const look = weatherLook(now.weather_code ?? 0);

  let html =
    '<div class="card searchCard">' +
    '<h3>' + escapeWeatherHTML(r.name) + '</h3>' +
    '<p class="small muted">' + escapeWeatherHTML(r.where || '') +
    (r.inNetwork ? '' : ' · not in the AeroGuard network') + '</p>' +
    '<p class="nowLine">' + look[0] + ' <b>' +
    value(now.temperature_2m, '°C') + '</b> ' + look[1] +
    ' · humidity ' + value(now.relative_humidity_2m, '%') +
    ' · wind ' + value(now.wind_speed_10m, ' km/h') +
    ' · rain ' + value(now.precipitation, ' mm') + '</p>' +
    '<div class="score five">' +
    '<div><b>' + value(average(past.map(d => d.max)), '°') +
    '</b><span>Average high</span></div>' +
    '<div><b>' + value(average(past.map(d => d.min)), '°') +
    '</b><span>Average low</span></div>' +
    '<div><b>' + total(past.map(d => d.rain)).toFixed(1) +
    ' mm</b><span>Total rain</span></div>' +
    '<div><b>' + value(Math.max(0, ...known(past.map(d => d.wind)).map(Number)), ' km/h') +
    '</b><span>Strongest wind</span></div>' +
    '<div class="' + (past.some(d => d.penalty > 0) ? 'bad' : '') +
    '"><b>' + past.filter(d => d.penalty > 0).length +
    ' of ' + past.length + '</b><span>Bad-weather days</span></div>' +
    '</div>' + weatherChart(r.days, dayName) +
    '<div class="tableWrap"><table class="ptable days">' +
    '<tr><th>Day</th><th>Weather</th><th>High</th><th>Low</th>' +
    '<th>Rain</th><th>Max wind</th><th>Penalty</th></tr>';

  r.days.forEach((d, k) => {
    const l = weatherLook(d.code ?? 0);

    html +=
      '<tr' + (k === r.days.length - 1 ? ' class="today"' : '') +
      '><td>' + dayName(d.date, k) + '</td><td>' + l[0] + ' ' + l[1] +
      '</td><td>' + value(d.max, '°') +
      '</td><td>' + value(d.min, '°') +
      '</td><td>' + value(d.rain, ' mm') +
      '</td><td>' + value(d.wind, ' km/h') +
      '</td><td><span class="pen' +
      (d.penalty >= 3 ? ' severe' : d.penalty > 0 ? ' bad' : '') +
      '">+' + d.penalty + '</span></td></tr>';
  });

  return html +
    '</table></div><p class="small muted">Penalty rule: wind over 40 km/h +2, rain over 5 mm +2, fog +3, thunderstorm +3. A penalty of 3 or more is severe. Data: Open-Meteo.</p></div>';
}

function weatherChart(days, dayName) {
  if (!Array.isArray(days) || !days.length) return '';

  const W = 640;
  const H = 230;
  const left = 36;
  const right = 36;
  const top = 22;
  const bottom = 30;
  const rainStrip = 50;
  const step = (W - left - right) / days.length;

  const temps = days.flatMap(d => [d.max, d.min])
    .filter(v => v !== null && v !== undefined && Number.isFinite(Number(v)))
    .map(Number);

  const tMin = temps.length
    ? Math.floor(Math.min(...temps) / 5) * 5 - 5
    : 0;

  const rawMax = temps.length
    ? Math.ceil(Math.max(...temps) / 5) * 5
    : 10;

  const tMax = rawMax <= tMin ? tMin + 10 : rawMax;

  const rainValues = days.map(d => Number(d.rain) || 0);
  const rMax = Math.max(5, ...rainValues);
  const x = k => left + step * k + step / 2;
  const tempBottom = H - bottom - rainStrip - 18;

  const yT = t =>
    top + (tempBottom - top) * (1 - (Number(t) - tMin) / (tMax - tMin));

  const yR = r =>
    H - bottom - (rainStrip - 12) * ((Number(r) || 0) / rMax);

  const makePath = key => {
    let path = '';
    let started = false;

    days.forEach((d, k) => {
      const value = d[key];

      if (value === null || value === undefined || !Number.isFinite(Number(value))) {
        started = false;
        return;
      }

      path += (started ? 'L' : 'M') + x(k) + ' ' + yT(value) + ' ';
      started = true;
    });

    return path.trim();
  };

  let svg =
    '<svg class="wchart" viewBox="0 0 ' + W + ' ' + H +
    '" role="img" aria-label="Rain and temperature history">' +
    '<line x1="' + left + '" x2="' + (W - right) +
    '" y1="' + (H - bottom) + '" y2="' + (H - bottom) +
    '" class="cBase"/>';

  days.forEach((d, k) => {
    const rain = Number(d.rain) || 0;
    const barY = yR(rain);
    const height = Math.max(0, H - bottom - barY);

    svg +=
      '<rect x="' + (x(k) - step * 0.22) +
      '" y="' + barY +
      '" width="' + Math.max(1, step * 0.44) +
      '" height="' + height + '" class="rainBar"/>' +
      '<text x="' + x(k) + '" y="' + (H - 10) +
      '" class="cLabel">' + escapeWeatherHTML(dayName(d.date, k)) +
      '</text>';

    if (rain > 0) {
      svg += '<text x="' + x(k) + '" y="' + Math.max(top + 10, barY - 4) +
        '" class="cRain">' + rain + ' mm</text>';
    }
  });

  svg +=
    '<path d="' + makePath('max') + '" class="tMaxLine"/>' +
    '<path d="' + makePath('min') + '" class="tMinLine"/>';

  days.forEach((d, k) => {
    if (d.max !== null && d.max !== undefined && Number.isFinite(Number(d.max))) {
      svg +=
        '<circle cx="' + x(k) + '" cy="' + yT(d.max) +
        '" r="3.5" class="tMaxDot"/>' +
        '<text x="' + x(k) + '" y="' + Math.max(top + 10, yT(d.max) - 8) +
        '" class="cMax">' + Math.round(d.max) + '°</text>';
    }

    if (d.min !== null && d.min !== undefined && Number.isFinite(Number(d.min))) {
      svg +=
        '<circle cx="' + x(k) + '" cy="' + yT(d.min) +
        '" r="3.5" class="tMinDot"/>' +
        '<text x="' + x(k) + '" y="' + Math.min(tempBottom + 18, yT(d.min) + 16) +
        '" class="cMin">' + Math.round(d.min) + '°</text>';
    }
  });

  return svg +
    '</svg><p class="small muted chartKey">' +
    '<span class="k1"></span> highest temperature ' +
    '<span class="k2"></span> lowest temperature ' +
    '<span class="k3"></span> rain (mm)</p>';
}

function showWeatherPanels() {
  if (typeof showWeatherStrip === 'function') {
    showWeatherStrip();
  }

  if (typeof showPanels === 'function') {
    showPanels();
  }
}
