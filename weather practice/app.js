// ── State ────────────────────────────────────────────────
let useFahrenheit = false;
let currentData   = null;
 
// ── WMO Weather Code Lookup ───────────────────────────────
const WMO = {
  0:  ["Clear sky",      "☀️"],
  1:  ["Mainly clear",   "🌤️"],
  2:  ["Partly cloudy",  "⛅"],
  3:  ["Overcast",       "☁️"],
  45: ["Fog",            "🌫️"],
  48: ["Icy fog",        "🌫️"],
  51: ["Light drizzle",  "🌦️"],
  53: ["Drizzle",        "🌦️"],
  55: ["Heavy drizzle",  "🌧️"],
  61: ["Light rain",     "🌧️"],
  63: ["Rain",           "🌧️"],
  65: ["Heavy rain",     "🌧️"],
  71: ["Light snow",     "🌨️"],
  73: ["Snow",           "❄️"],
  75: ["Heavy snow",     "❄️"],
  80: ["Rain showers",   "🌦️"],
  81: ["Showers",        "🌦️"],
  82: ["Heavy showers",  "⛈️"],
  95: ["Thunderstorm",   "⛈️"],
  96: ["Thunder + hail", "⛈️"],
  99: ["Heavy thunder",  "⛈️"],
};
 
function wmo(code) {
  return WMO[code] || ["Unknown", "🌡️"];
}
 
// ── Temperature Helpers ───────────────────────────────────
function toF(c)    { return Math.round(c * 9 / 5 + 32); }
function fmt(c)    { return useFahrenheit ? toF(c) + "°F" : Math.round(c) + "°C"; }
function fmtBig(c) { return useFahrenheit ? toF(c) : Math.round(c); }
function unit()    { return useFahrenheit ? "°F" : "°C"; }
 
// ── DOM Utilities ─────────────────────────────────────────
function container()  { return document.getElementById("weather-container"); }
function showLoading() { container().innerHTML = '<div class="loading">Fetching weather…</div>'; }
function showError(msg){ container().innerHTML = `<div class="error-msg">${msg}</div>`; }
 
// ── Geocoding (Nominatim) ─────────────────────────────────
async function searchCity() {
  const q = document.getElementById("city-input").value.trim();
  if (!q) return;
  showLoading();
  try {
    const geo = await fetch(
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(q)}&format=json&limit=1`,
      { headers: { "Accept-Language": "en", "User-Agent": "WeatherApp/1.0" } }
    ).then(r => r.json());
    if (!geo.length) { showError("City not found. Try a different name."); return; }
    const { lat, lon, display_name } = geo[0];
    const parts   = display_name.split(",");
    const city    = parts[0].trim();
    const country = parts[parts.length - 1].trim();
    await fetchWeather(parseFloat(lat), parseFloat(lon), city, country);
  } catch (e) {
    showError("Could not fetch location data. Check your connection.");
  }
}
 
// ── Weather API (Open-Meteo) ──────────────────────────────
async function fetchWeather(lat, lon, city, country) {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,` +
      `relative_humidity_2m,wind_speed_10m,weather_code,is_day` +
      `&hourly=temperature_2m,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
      `&timezone=auto&forecast_days=7&wind_speed_unit=kmh`;
    const data = await fetch(url).then(r => r.json());
    currentData = { data, city, country };
    renderWeather();
  } catch (e) {
    showError("Could not fetch weather data. Please try again.");
  }
}
 
// ── Render ────────────────────────────────────────────────
function renderWeather() {
  if (!currentData) return;
  const { data, city, country } = currentData;
  const c      = data.current;
  const daily  = data.daily;
  const hourly = data.hourly;
 
  const now     = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString([],  { weekday: "long", month: "short", day: "numeric" });
  const [desc, icon] = wmo(c.weather_code);
 
  const currentHour = new Date().getHours();
  let nowIdx = 0;
  for (let i = 0; i < hourly.time.length; i++) {
    if (new Date(hourly.time[i]).getHours() === currentHour) { nowIdx = i; break; }
  }
 
  const hourSlice = hourly.time.slice(nowIdx, nowIdx + 12);
  const hourTemps = hourly.temperature_2m.slice(nowIdx, nowIdx + 12);
  const hourCodes = hourly.weather_code.slice(nowIdx, nowIdx + 12);
 
  const hoursHTML = hourSlice.map((t, i) => {
    const label = i === 0 ? "Now"
      : new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
    const [, hIcon] = wmo(hourCodes[i]);
    return `<div class="hour-chip ${i === 0 ? "now" : ""}">
      <div class="hour-time">${label}</div>
      <div class="hour-icon">${hIcon}</div>
      <div class="hour-temp">${fmt(hourTemps[i])}</div>
    </div>`;
  }).join("");
 
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const forecastHTML = daily.time.map((d, i) => {
    const dName = i === 0 ? "Today" : days[new Date(d).getDay()];
    const [, dIcon] = wmo(daily.weather_code[i]);
    return `<div class="day-card">
      <div class="day-name">${dName}</div>
      <div class="day-icon">${dIcon}</div>
      <span class="day-hi">${fmt(daily.temperature_2m_max[i])}</span>
      <span class="day-lo">${fmt(daily.temperature_2m_min[i])}</span>
    </div>`;
  }).join("");
 
  container().innerHTML = `
    <button class="toggle-unit" onclick="toggleUnit()">
      Switch to ${useFahrenheit ? "°C" : "°F"}</button>
    <div class="main-card">
      <div class="location-row">
        <div>
          <div class="location-name">${city}</div>
          <div class="location-country">${country}</div>
        </div>
        <div class="local-time">
          <div>${timeStr}</div>
          <div style="margin-top:0.2rem;font-size:0.65rem">${dateStr}</div>
        </div>
      </div>
      <div class="temp-row">
        <div class="temp-big">${fmtBig(c.temperature_2m)}<sup>${unit()}</sup></div>
        <div class="condition-block">
          <div class="condition-desc">${icon} ${desc}</div>
          <div class="feels-like">Feels like ${fmt(c.apparent_temperature)}</div>
        </div>
      </div>
      <hr class="divider">
      <div class="stats-grid">
        <div class="stat"><span class="stat-label">Humidity</span>
          <span class="stat-value">${c.relative_humidity_2m}%</span></div>
        <div class="stat"><span class="stat-label">Wind</span>
          <span class="stat-value">${Math.round(c.wind_speed_10m)} km/h</span></div>
        <div class="stat"><span class="stat-label">High today</span>
          <span class="stat-value">${fmt(daily.temperature_2m_max[0])}</span></div>
        <div class="stat"><span class="stat-label">Low today</span>
          <span class="stat-value">${fmt(daily.temperature_2m_min[0])}</span></div>
      </div>
      <div class="hourly-scroll">${hoursHTML}</div>
    </div>
    <div class="forecast-grid">${forecastHTML}</div>`;
}
 
// ── Unit Toggle ───────────────────────────────────────────
function toggleUnit() {
  useFahrenheit = !useFahrenheit;
  renderWeather();
}
 
// ── Keyboard Listener ─────────────────────────────────────
document.getElementById("city-input").addEventListener("keydown", e => {
  if (e.key === "Enter") searchCity();
});
 
// ── Auto-load on page open ────────────────────────────────
(async () => {
  document.getElementById("city-input").value = "London";
  await searchCity();
})();
