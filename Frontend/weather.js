// weather.js : weather on the screen.
// The browser downloads the live weather from Open-Meteo (C++ cannot do secure internet requests without
// extra libraries) and gives the numbers to the C++ backend. The backend decides how bad the weather is
// (the penalty) and uses it for the routes and the storm alerts. This file only shows the results.

let liveRows = null;          // the last live weather, ready to send again ("temp,wind,rain,code;...")
let weatherTime = null;       // when the live weather was downloaded
let weatherFailed = false;

// Download the live weather of all cities (one request) and give it to the C++ backend.
async function loadWeather() {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + cities.map(c => c.lat).join(',') +
              '&longitude=' + cities.map(c => c.lon).join(',') + '&current=temperature_2m,wind_speed_10m,precipitation,weather_code';
  try {
    const data = await (await fetch(url)).json();      // one item per city, in city order
    liveRows = data.map(d => [d.current.temperature_2m, d.current.wind_speed_10m, d.current.precipitation, d.current.weather_code].join(',')).join(';');
    weatherTime = new Date().toLocaleTimeString();
    weatherFailed = false;
    await act('/api/weather', { action: 'live', data: liveRows });
    refreshPlan();
  } catch (error) {
    weatherFailed = true;
  }
}

// Buttons: sample weather, set a city by hand (Clear -> Thunderstorm -> Fog -> Heavy rain), back to live.
async function useSampleWeather() { await act('/api/weather', { action: 'sample' }); refreshPlan(); }
async function cycleWeather(i) { await act('/api/weather', { action: 'hand', city: i }); refreshPlan(); }
async function backToLive() {
  await act('/api/weather', { action: 'clear' });
  if (liveRows) await act('/api/weather', { action: 'live', data: liveRows });
  else loadWeather();
  refreshPlan();
}

const wx = i => S.weather[i];                              // weather of a city, as the backend sees it
const severe = i => wx(i).penalty >= INFO.rules.severe;

function weatherLine(i) {
  const w = wx(i);
  if (w.source === 'none') return cities[i].name + ': weather not available';
  const look = weatherLook(w.code);
  return look[0] + ' ' + cities[i].name + ': ' + look[1] + ', ' + Math.round(w.temp) + '°C, wind ' + Math.round(w.wind) + ' km/h' +
         (w.penalty ? ' (bad weather, +' + w.penalty + ')' : '') + (w.source === 'hand' ? ' [set by hand]' : '');
}
function weatherLineHTML(i) {
  return weatherLine(i).replace(cities[i].name + ':', '<b>' + cities[i].name + '</b>:');
}
function badWeatherCount() { return S.weather.filter(w => w.penalty > 0).length; }

function weatherStatus() {
  if (S.weather.some(w => w.source === 'sample')) return '<b>Sample weather</b> (not real).';
  if (weatherTime) return '<b>Live weather</b> from Open-Meteo, updated <b>' + weatherTime + '</b>';
  if (weatherFailed) return '<b>Live weather unavailable.</b>';
  return 'Loading live weather...';
}
function weatherButtons() {
  const sample = S.weather.some(w => w.source === 'sample');
  const changed = S.weather.some(w => w.source === 'hand' || w.source === 'sample');
  return (!weatherTime && !sample ? ' <button class="mini go" onclick="useSampleWeather()">Use sample weather</button>' : '') +
         (changed ? ' <button class="mini" onclick="backToLive()">Back to live</button>' : '');
}

// The moving strip under the radar (worst weather first).
let lastStrip = '';
function showWeatherStrip() {
  const order = cities.map((c, i) => i).sort((a, b) => wx(b).penalty - wx(a).penalty || cities[a].name.localeCompare(cities[b].name));
  const chips = order.filter(i => wx(i).source !== 'none').map(i => {
    const w = wx(i), look = weatherLook(w.code);
    return '<span class="wchip' + (w.penalty ? ' bad' : '') + '" onclick="cycleWeather(' + i + ')">' + look[0] + ' <b>' + cities[i].name + '</b> ' +
           Math.round(w.temp) + '° · ' + Math.round(w.wind) + ' km/h' + (w.penalty ? ' · +' + w.penalty : '') + SOURCE_TAG[w.source] + '</span>';
  }).join('');
  const html = '<div class="wstatus">' + weatherStatus() + weatherButtons() + '</div>' +
    (chips ? '<div class="ticker"><div class="track">' + chips + chips + '</div></div>' : '<div class="small muted">No weather data yet.</div>');
  if (html !== lastStrip) { $('weatherStrip').innerHTML = html; lastStrip = html; }
}

// The Weather page: one card per city (click to change its weather for the demo).
function weatherTabHTML() {
  let html = '<p class="small">' + weatherStatus() + weatherButtons() + '</p>' +
             '<p class="small muted">Click a city to change its weather (for the demo).</p><div class="wgrid">';
  cities.map((c, i) => i).sort((a, b) => wx(b).penalty - wx(a).penalty || cities[a].name.localeCompare(cities[b].name)).forEach(i => {
    const w = wx(i), has = w.source !== 'none', look = has ? weatherLook(w.code) : ['—', 'No data'];
    html += '<div class="wcard' + (w.penalty ? ' bad' : '') + (has ? '' : ' dim') + '" onclick="cycleWeather(' + i + ')">' +
            '<div class="wtop"><span>' + look[0] + '</span><b>' + (has ? Math.round(w.temp) + '°' : '') + '</b>' + (w.penalty ? '<i>+' + w.penalty + '</i>' : '') + '</div>' +
            '<div class="wname">' + cities[i].name + '</div>' +
            '<div class="wsub">' + look[1] + (has ? ' · ' + Math.round(w.wind) + ' km/h' : '') + SOURCE_TAG[w.source] + '</div></div>';
  });
  return html + '</div>';
}

// Storms on the route of flying planes (found by the C++ backend).
function weatherAlertsHTML() {
  if (!S.storms.length) return '<div class="okbox">No severe weather on any flight route.</div>';
  return S.storms.map(a => {
    const where = a.cities.map(c => weatherLook(wx(c).code)[0] + ' ' + cities[c].name + ' (' + weatherLook(wx(c).code)[1].toLowerCase() + ', +' + wx(c).penalty + ')').join(', ');
    if (a.atDestination) {
      return '<div class="wxalert"><b>' + a.plane + '</b>: bad weather at its destination ' + where + '. It cannot avoid its destination. ' +
        'Real ATC would make it hold or divert. <button class="mini" onclick="keepRoute(\'' + a.key + '\')">OK</button></div>';
    }
    return '<div class="wxalert"><b>' + a.plane + '</b> will fly through ' + where + '.<br>' +
      (a.canGoAround ? 'Way around: ' + a.newRoute.slice(a.startLeg).map(name).join(' › ') + ' (' + (a.extraKm >= 0 ? '+' : '') + a.extraKm + ' km, ' +
             (a.extraMinutes >= 0 ? '+' : '') + a.extraMinutes + ' min). <button class="mini go" onclick="flyAround(\'' + a.plane + '\')">Fly around it</button>'
           : 'Too late to avoid it (already flying into that city), or no other way. ') +
      '<button class="mini" onclick="keepRoute(\'' + a.key + '\')">Keep route</button></div>';
  }).join('');
}
function flyAround(id) { act('/api/storm', { action: 'fly', plane: id }); }
function keepRoute(key) { act('/api/storm', { action: 'keep', key: key }); }

// ---------- CITY WEATHER SEARCH + THE LAST 5 DAYS ----------
// 1. Find the place: one of our 26 cities, or any city through the Open-Meteo city search.
// 2. Get its weather now and for the last 5 days (+ today) from Open-Meteo.
// 3. Penalty of each day: from the C++ backend (penaltyFor in weather.cpp).
let searchResult = null;

async function searchWeather() {
  const text = $('weatherSearch').value.trim();
  if (!text) return;
  searchResult = { loading: true, name: text };
  showSearchResult();
  try {
    let place;
    const ours = cities.findIndex(c => c.name.toLowerCase() === text.toLowerCase());
    if (ours >= 0) {
      place = { name: cities[ours].name, lat: cities[ours].lat, lon: cities[ours].lon, where: cityType(ours), inNetwork: true };
    } else {
      const geo = await (await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=' + encodeURIComponent(text))).json();
      if (!geo.results || !geo.results.length) {
        searchResult = { error: 'No place called "' + text + '" was found. Check the spelling.' };
        showSearchResult();
        return;
      }
      const r = geo.results[0];
      place = { name: r.name, lat: r.latitude, lon: r.longitude, where: [r.admin1, r.country].filter(Boolean).join(', '), inNetwork: false };
    }

    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + place.lat + '&longitude=' + place.lon +
      '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max' +
      '&past_days=5&forecast_days=1&timezone=auto';
    const data = await (await fetch(url)).json();
    const d = data.daily;
    const days = d.time.map((date, k) => ({
      date: date, code: d.weather_code[k], max: d.temperature_2m_max[k], min: d.temperature_2m_min[k],
      rain: d.precipitation_sum[k], wind: d.wind_speed_10m_max[k],
    }));
    const penalties = await dayPenalties(days);
    days.forEach((day, k) => { day.penalty = penalties[k]; });
    searchResult = { ...place, current: data.current, days: days };
  } catch (error) {
    searchResult = { error: 'Weather search needs internet. Open-Meteo could not be reached.' };
  }
  showSearchResult();
}

// The penalty of each day is worked out by the C++ backend (penaltyFor in weather.cpp).
async function dayPenalties(days) {
  const answer = await ask('/api/penalty', { rows: days.map(d => [d.wind || 0, d.rain || 0, d.code || 0].join(',')).join(';') });
  return answer.penalties;
}

function showSearchResult() {
  setHTML('weatherSearchResult', searchResultHTML());
}

function searchResultHTML() {
  const r = searchResult;
  if (!r) return '';
  if (r.loading) return '<p class="muted">Searching ' + r.name + '...</p>';
  if (r.error) return '<div class="waitbox">' + escapeHTML(r.error) + '</div>';

  const value = (v, unit) => (v === null || v === undefined) ? '-' : Math.round(v) + unit;
  const dayName = (date, k) => k === r.days.length - 1 ? 'Today' :
    new Date(date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const past = r.days.slice(0, -1);                      // the last 5 days (without today)
  const known = list => list.filter(v => v !== null && v !== undefined);
  const average = list => known(list).length ? known(list).reduce((a, b) => a + b, 0) / known(list).length : null;
  const total = list => known(list).reduce((a, b) => a + b, 0);
  const now = r.current || {};
  const look = weatherLook(now.weather_code || 0);

  let html = '<div class="card searchCard">' +
    '<h3>' + escapeHTML(r.name) + '</h3><p class="small muted">' + escapeHTML(r.where) + (r.inNetwork ? '' : ' · not in the AeroGuard network') + '</p>' +
    '<p class="nowLine">' + look[0] + ' <b>' + value(now.temperature_2m, '°C') + '</b> ' + look[1] +
      ' · humidity ' + value(now.relative_humidity_2m, '%') + ' · wind ' + value(now.wind_speed_10m, ' km/h') +
      ' · rain ' + (now.precipitation ?? '-') + ' mm</p>' +
    '<div class="score five">' +
      '<div><b>' + value(average(past.map(d => d.max)), '°') + '</b><span>Average high</span></div>' +
      '<div><b>' + value(average(past.map(d => d.min)), '°') + '</b><span>Average low</span></div>' +
      '<div><b>' + total(past.map(d => d.rain)).toFixed(1) + ' mm</b><span>Total rain</span></div>' +
      '<div><b>' + value(Math.max(...known(past.map(d => d.wind)), 0), ' km/h') + '</b><span>Strongest wind</span></div>' +
      '<div class="' + (past.some(d => d.penalty > 0) ? 'bad' : '') + '"><b>' + past.filter(d => d.penalty > 0).length + ' of 5</b><span>Bad-weather days</span></div>' +
    '</div>' + weatherChart(r.days, dayName) +
    '<div class="tableWrap"><table class="ptable days"><tr><th>Day</th><th>Weather</th><th>High</th><th>Low</th><th>Rain</th><th>Max wind</th><th>Penalty</th></tr>';
  r.days.forEach((d, k) => {
    const l = weatherLook(d.code || 0);
    html += '<tr' + (k === r.days.length - 1 ? ' class="today"' : '') + '><td>' + dayName(d.date, k) + '</td><td>' + l[0] + ' ' + l[1] + '</td><td>' +
      value(d.max, '°') + '</td><td>' + value(d.min, '°') + '</td><td>' + (d.rain ?? '-') + ' mm</td><td>' + value(d.wind, ' km/h') +
      '</td><td><span class="pen' + (d.penalty >= 3 ? ' severe' : d.penalty > 0 ? ' bad' : '') + '">+' + d.penalty + '</span></td></tr>';
  });
  return html + '</table></div><p class="small muted">Penalty: the AeroGuard rule on each day: strongest wind over 40 km/h +2, rain over 5 mm +2, fog +3, thunderstorm +3. 3 or more is severe. Data: Open-Meteo.</p></div>';
}

// A small chart: rain as blue bars, highest and lowest temperature as lines.
function weatherChart(days, dayName) {
  // top part: the 2 temperature lines. Bottom strip (50 px): the rain bars. So they never cover each other.
  const W = 640, H = 230, left = 36, right = 36, top = 22, bottom = 30, rainStrip = 50;
  const step = (W - left - right) / days.length;
  const temps = days.flatMap(d => [d.max, d.min]).filter(v => v !== null && v !== undefined);
  const tMin = Math.floor(Math.min(...temps) / 5) * 5 - 5, tMax = Math.ceil(Math.max(...temps) / 5) * 5;
  const rMax = Math.max(5, ...days.map(d => d.rain || 0));
  const x = k => left + step * k + step / 2;
  const tempBottom = H - bottom - rainStrip - 18;                       // lowest point of the temperature lines
  const yT = t => top + (tempBottom - top) * (1 - (t - tMin) / (tMax - tMin));
  const yR = r => H - bottom - (rainStrip - 12) * (r / rMax);
  const line = key => days.map((d, k) => (d[key] === null || d[key] === undefined) ? '' : (k ? 'L' : 'M') + x(k) + ' ' + yT(d[key])).join(' ').replace(/^ *L/, 'M');

  let svg = '<svg class="wchart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Rain and temperature, last 5 days and today">';
  svg += '<line x1="' + left + '" x2="' + (W - right) + '" y1="' + (H - bottom) + '" y2="' + (H - bottom) + '" class="cBase"/>';
  days.forEach((d, k) => {
    const h = (H - bottom) - yR(d.rain || 0);
    svg += '<rect x="' + (x(k) - step * 0.22) + '" y="' + yR(d.rain || 0) + '" width="' + step * 0.44 + '" height="' + h + '" class="rainBar"/>' +
           '<text x="' + x(k) + '" y="' + (H - 10) + '" class="cLabel">' + dayName(d.date, k) + '</text>' +
           ((d.rain || 0) > 0 ? '<text x="' + x(k) + '" y="' + (yR(d.rain) - 4) + '" class="cRain">' + d.rain + ' mm</text>' : '');
  });
  svg += '<path d="' + line('max') + '" class="tMaxLine"/><path d="' + line('min') + '" class="tMinLine"/>';
  days.forEach((d, k) => {
    if (d.max !== null && d.max !== undefined) svg += '<circle cx="' + x(k) + '" cy="' + yT(d.max) + '" r="3.5" class="tMaxDot"/><text x="' + x(k) + '" y="' + (yT(d.max) - 8) + '" class="cMax">' + Math.round(d.max) + '°</text>';
    if (d.min !== null && d.min !== undefined) svg += '<circle cx="' + x(k) + '" cy="' + yT(d.min) + '" r="3.5" class="tMinDot"/><text x="' + x(k) + '" y="' + (yT(d.min) + 16) + '" class="cMin">' + Math.round(d.min) + '°</text>';
  });
  return svg + '</svg><p class="small muted chartKey"><span class="k1"></span> highest temperature <span class="k2"></span> lowest temperature <span class="k3"></span> rain (mm)</p>';
}

// Text from the internet (place names) or typed by the user is shown as plain text, never as page code.
// (The same idea as escapeWeatherHTML in the Phase 2 version.)
function escapeHTML(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
