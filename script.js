'use strict';
/* =====================================================================
   Real-Time Weather Forecast & Climate Telemetry App
   Data source: OpenWeatherMap REST API (fetch + async/await + try/catch)
   SETUP: register free at https://openweathermap.org/api, then paste
   your key below. New keys can take up to ~2 hours to activate.
   ===================================================================== */
const API_KEY = 'a7656eafdfe7c88ca97dfd86987ce3be';
const BASE_URL = 'https://api.openweathermap.org';
const KEY_MISSING = !API_KEY || API_KEY === 'a7656eafdfe7c88ca97dfd86987ce3be';

const $ = id => document.getElementById(id);
const state = { data: null, place: null, busy: false, fahrenheit: false };
class AppError extends Error {}

/* ---------------------- 1. API LAYER ---------------------- */
async function getJSON(path, params) {
  if (KEY_MISSING) throw new AppError('API key missing. Open script.js and paste your OpenWeatherMap key into API_KEY.');
  const url = `${BASE_URL}${path}?${new URLSearchParams({ ...params, appid: API_KEY })}`;
  let res;
  try { res = await fetch(url); }
  catch { throw new AppError('Network connection failed. Check your internet and try again.'); }
  let body = null;
  try { body = await res.json(); } catch { /* handled below */ }
  if (res.status === 401) throw new AppError('Invalid API key. Check API_KEY in script.js (new keys can take up to 2 hours to activate).');
  if (res.status === 404) throw new AppError('Location not found. Please check the city name.');
  if (res.status === 429) throw new AppError('API rate limit reached. Please wait a minute and try again.');
  if (!res.ok) throw new AppError(body && body.message ? `Weather service error: ${body.message}` : `Weather service error (${res.status}).`);
  if (!body) throw new AppError('The weather service returned an unreadable response.');
  return body;
}

async function geocode(query) {
  const results = await getJSON('/geo/1.0/direct', { q: query, limit: 5 });
  if (!Array.isArray(results) || !results.length) throw new AppError(`City “${query}” was not found. Check the spelling and try again.`);
  return results.map(p => ({ name: p.name, state: p.state, country: p.country, lat: p.lat, lon: p.lon }));
}

async function fetchWeather(place) {
  const q = { lat: place.lat, lon: place.lon, units: 'metric' };
  const [cur, fc, air] = await Promise.allSettled([
    getJSON('/data/2.5/weather', q),
    getJSON('/data/2.5/forecast', q),
    getJSON('/data/2.5/air_pollution', { lat: place.lat, lon: place.lon })
  ]);
  if (cur.status === 'rejected') throw cur.reason;
  if (fc.status === 'rejected') throw fc.reason;
  return { current: cur.value, forecast: fc.value, air: air.status === 'fulfilled' ? (air.value.list || [])[0] || null : null };
}

/* ---------------------- 2. DATA PROCESSING ---------------------- */
const condition = (id, isDay) => {
  if (id < 300) return { t: 'Stormy', e: '⛈️', th: 'storm' };
  if (id < 400) return { t: 'Drizzle', e: '🌦️', th: 'rain' };
  if (id < 600) return { t: 'Rainy', e: '🌧️', th: 'rain' };
  if (id < 700) return { t: 'Snow', e: '❄️', th: 'snow' };
  if (id < 800) return { t: 'Misty', e: '🌫️', th: 'fog' };
  if (id === 800) return isDay ? { t: 'Sunny', e: '☀️', th: 'clear-day' } : { t: 'Clear night', e: '🌙', th: 'clear-night' };
  if (id <= 802) return { t: 'Partly cloudy', e: isDay ? '⛅' : '☁️', th: 'cloud' };
  return { t: 'Cloudy', e: '☁️', th: 'cloud' };
};
// OpenWeatherMap gives UTC timestamps + a timezone offset; shifting lets us read city-local time via getUTC*.
const shift = (unix, tz) => new Date((unix + tz) * 1000);
const dayKey = (unix, tz) => shift(unix, tz).toISOString().slice(0, 10);
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

function processWeather(raw) {
  const c = raw.current, f = raw.forecast;
  if (!c || !c.main || !Array.isArray(c.weather) || !c.weather[0] || !f || !Array.isArray(f.list) || !f.list.length)
    throw new AppError('Weather data is currently unavailable for this location.');
  const tz = c.timezone || 0, w = c.weather[0], isDay = String(w.icon).endsWith('d');
  const today = dayKey(c.dt, tz);
  const todayTemps = [c.main.temp, ...f.list.filter(i => dayKey(i.dt, tz) === today).map(i => i.main.temp)];

  const mkHour = (i, label) => ({ label, temp: i.main.temp, rain: typeof i.pop === 'number' ? Math.round(i.pop * 100) : null,
    info: condition(i.weather[0].id, String(i.weather[0].icon).endsWith('d')) });
  const hours = [
    { label: 'Now', temp: c.main.temp, rain: typeof f.list[0].pop === 'number' ? Math.round(f.list[0].pop * 100) : null, info: condition(w.id, isDay) },
    ...f.list.filter(i => i.dt > c.dt).slice(0, 7).map(i => mkHour(i, h12(shift(i.dt, tz).getUTCHours())))
  ];

  const groups = f.list.reduce((m, i) => { (m[dayKey(i.dt, tz)] ||= []).push(i); return m; }, {});
  const all = Object.keys(groups).sort(), upcoming = all.filter(k => k > today);
  const days = (upcoming.length >= 5 ? upcoming.slice(0, 5) : all.slice(-5)).map(k => {
    const items = groups[k];
    const mid = items.reduce((a, b) => Math.abs(shift(b.dt, tz).getUTCHours() - 12) < Math.abs(shift(a.dt, tz).getUTCHours() - 12) ? b : a);
    return { date: k, max: Math.max(...items.map(i => i.main.temp_max)), min: Math.min(...items.map(i => i.main.temp_min)), info: condition(mid.weather[0].id, true) };
  });

  return {
    tz, unix: c.dt, info: condition(w.id, isDay), desc: cap(w.description),
    temp: c.main.temp, feels: c.main.feels_like, humidity: c.main.humidity, pressure: c.main.pressure,
    windKmh: (c.wind?.speed ?? 0) * 3.6, windDeg: c.wind?.deg ?? 0,
    visibility: typeof c.visibility === 'number' ? c.visibility / 1000 : null,
    max: Math.max(...todayTemps), min: Math.min(...todayTemps),
    sunrise: c.sys?.sunrise ?? null, sunset: c.sys?.sunset ?? null,
    aqi: raw.air?.main?.aqi ?? null, pm25: raw.air?.components?.pm2_5 ?? null,
    hours, days
  };
}

/* ---------------------- 3. FORMATTING ---------------------- */
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const T = c => (c === null || c === undefined) ? '—' : Math.round(state.fahrenheit ? c * 9 / 5 + 32 : c) + '°';
const h12 = h => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
const clock = (unix, tz) => { if (unix === null) return '—'; const d = shift(unix, tz); const m = String(d.getUTCMinutes()).padStart(2, '0'); const h = d.getUTCHours(); return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`; };
const dayFmt = (key, opts) => new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'UTC' }).format(new Date(key + 'T00:00:00Z'));
const compass = d => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(d / 45) % 8];
const AQI_LABELS = ['Good', 'Fair', 'Moderate', 'Poor', 'Very poor'];
const countryName = code => { try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code); } catch { return code; } };

/* ---------------------- 4. UI RENDERING ---------------------- */
const statCard = (label, icon, val, pct) =>
  `<div class="glass stat"><span>${icon} ${label}</span><b>${val}</b>${pct === null ? '' : `<div class="bar"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`}</div>`;

const renderHero = (d, p) => `<section class="glass hero"><div>
  <div class="temp">${T(d.temp)}</div>
  <div class="cond">${d.info.t}</div><p class="desc">${esc(d.desc)}</p>
  <p class="sub">${esc(p.name)} · Feels like <b>${T(d.feels)}</b> · H <b>${T(d.max)}</b> L <b>${T(d.min)}</b></p>
  </div><div class="bigicon" aria-hidden="true">${d.info.e}</div></section>`;

const renderStats = d => `<section class="stats" id="stats">
  ${statCard('Humidity', '💧', Math.round(d.humidity) + '%', d.humidity)}
  ${statCard('Wind speed', '🌬️', Math.round(d.windKmh) + ' km/h', d.windKmh * 2)}
  ${statCard('Pressure', '🧭', Math.round(d.pressure) + ' hPa', d.pressure - 950)}
  ${statCard('Visibility', '👁️', d.visibility === null ? '—' : d.visibility.toFixed(1) + ' km', d.visibility === null ? null : d.visibility * 10)}
  </section>`;

const renderHourly = d => `<section class="glass panel" id="hourly"><h2>Hourly forecast (3-hour steps)</h2><div class="hourly">${
  d.hours.map((h, i) => `<div class="hr ${i === 0 ? 'now' : ''}"><div>${h.label}</div><div class="e" title="${h.info.t}">${h.info.e}</div><strong>${T(h.temp)}</strong><small>${h.rain === null ? '' : '💧 ' + h.rain + '%'}</small></div>`).join('')
}</div></section>`;

const renderDays = d => `<section class="glass panel" id="days"><h2>5-day forecast</h2><div class="days">${
  d.days.map(x => `<div class="day"><strong>${dayFmt(x.date, { weekday: 'short' })}</strong><small>${dayFmt(x.date, { month: 'short', day: 'numeric' })}</small><div class="e">${x.info.e}</div><small>${x.info.t}</small><div class="t">${T(x.max)} <span>${T(x.min)}</span></div></div>`).join('')
}</div></section>`;

const renderExtra = d => `<section class="glass panel"><h2>Additional information</h2><div class="extra">
  <div class="ex"><div class="compass"><i style="transform:rotate(${d.windDeg}deg)"></i></div><b>${compass(d.windDeg)} · ${Math.round(d.windKmh)} km/h</b><p>Wind direction</p></div>
  <div class="ex"><span style="font-size:2rem">🌅</span><b>${clock(d.sunrise, d.tz)}</b><p>Sunrise</p><b>${clock(d.sunset, d.tz)}</b><p>Sunset</p></div>
  <div class="ex"><span style="font-size:2rem">🍃</span><b>${d.aqi === null ? 'Unavailable' : d.aqi + ' · ' + AQI_LABELS[d.aqi - 1]}</b><p>Air quality index (1–5)${d.pm25 === null ? '' : ' · PM2.5 ' + d.pm25.toFixed(1)}</p></div>
  </div></section>`;

function render() {
  const { data: d, place: p } = state;
  if (!d) return;
  document.body.className = d.info.th;
  $('place').textContent = [p.name, p.state, countryName(p.country)].filter(Boolean).join(', ');
  $('date').textContent = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(shift(Math.floor(Date.now() / 1000), d.tz));
  $('view').innerHTML = `<div class="grid">${renderHero(d, p)}${renderStats(d)}</div>${renderHourly(d)}${renderDays(d)}${renderExtra(d)}`;
}

const emptyState = msg => { $('view').innerHTML = `<div class="glass empty">${msg}</div>`; };
const setBusy = b => { state.busy = b; $('view').classList.toggle('loading', b); $('spin').classList.toggle('on', b); $('go').disabled = b; };
const showError = m => { $('msgText').textContent = m; $('msg').classList.add('show'); };
const clearError = () => $('msg').classList.remove('show');

function renderAlternatives(list, current) {
  const others = list.filter(p => p !== current);
  $('alts').innerHTML = others.length ? '<span style="color:var(--mu);font-size:.8rem;align-self:center">Other matches:</span>' : '';
  others.forEach(p => {
    const b = document.createElement('button');
    b.textContent = [p.name, p.state, p.country].filter(Boolean).join(', ');
    b.onclick = () => loadPlace(p, list);
    $('alts').appendChild(b);
  });
}

/* ---------------------- 5. CONTROLLERS ---------------------- */
async function loadPlace(place, list = []) {
  if (state.busy) return;
  setBusy(true); clearError();
  try {
    state.data = processWeather(await fetchWeather(place));
    state.place = place;
    render(); renderAlternatives(list, place);
    try { localStorage.setItem('wx-last', JSON.stringify(place)); } catch { /* storage unavailable */ }
  } catch (e) {
    showError(e instanceof AppError ? e.message : 'Something went wrong. Please try again.');
    if (!state.data) emptyState('No weather data to show yet. Try searching for a city above.');
  } finally { setBusy(false); }
}

async function handleSearch(query) {
  query = query.trim();
  if (!query) return showError('Please enter a city name to search.');
  if (state.busy) return;
  setBusy(true); clearError();
  let results;
  try { results = await geocode(query); }
  catch (e) { showError(e instanceof AppError ? e.message : 'Something went wrong. Please try again.'); return; }
  finally { setBusy(false); }
  await loadPlace(results[0], results);
}

/* ---------------------- 6. EVENTS & INIT ---------------------- */
$('form').addEventListener('submit', e => { e.preventDefault(); handleSearch($('q').value); });
$('msgX').onclick = clearError;
$('unitBtn').onclick = () => { state.fahrenheit = !state.fahrenheit; $('unitBtn').title = state.fahrenheit ? 'Switch to °C' : 'Switch to °F'; render(); };
document.querySelectorAll('nav [data-nav]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('nav [data-nav]').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  const t = b.dataset.nav;
  if (t === 'search') $('q').focus(); else $(t)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}));

(function init() {
  if (KEY_MISSING) {
    showError('API key missing. Open script.js and paste your OpenWeatherMap key into API_KEY.');
    return emptyState('Add your free OpenWeatherMap API key in <code>script.js</code>, then reload this page.');
  }
  let last = null;
  try { last = JSON.parse(localStorage.getItem('wx-last')); } catch { /* ignore */ }
  if (last && typeof last.lat === 'number') loadPlace(last); else handleSearch('London');
})();
