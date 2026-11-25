# Real-Time Weather Forecast & Climate Telemetry App

A responsive, dark glassmorphism weather dashboard that retrieves live data from the [OpenWeatherMap](https://openweathermap.org/api) REST API using asynchronous JavaScript. Search any city in the world and the whole dashboard updates dynamically.

## Features

- **City search:** any global city, triggered with Enter or the search button; empty searches are blocked.
- **Same-name cities:** "Other matches" buttons let you switch (e.g. London, GB vs London, CA). You can also type `Paris,TX,US`.
- **Current weather:** temperature, feels-like, today's high/low, condition, description and a dynamic icon.
- **Live metrics:** humidity, wind speed (km/h), pressure (hPa) and visibility (km).
- **Hourly forecast:** horizontally scrollable, in 3-hour steps with rain probability.
- **5-day forecast:** cards generated with `Array.map()` (day, date, icon, condition, max/min).
- **Additional info:** wind direction compass, sunrise/sunset and air quality index.
- **Dynamic UI:** background gradient changes for sunny, night, cloudy, rainy, stormy, snow and fog.
- **°C / °F toggle** via the settings icon.
- **Loading and error handling:** spinner during requests, repeat searches blocked while loading, and friendly messages for:
  - invalid city / city not found
  - network failure
  - invalid or missing API key (401)
  - rate limit reached (429)
  - other API errors and missing data
- **Responsive:** Flexbox and Grid; sidebar becomes a bottom navigation bar on mobile; no horizontal page overflow.

## Tech Stack

HTML5, CSS3, JavaScript (ES6+), Fetch API, async/await, try/catch. No libraries or frameworks.

## Project Structure

```
weather-app/
├── index.html   # markup
├── style.css    # styling, themes, responsive rules
├── script.js    # API layer, data processing, rendering, controllers
└── README.md
```

`script.js` is organised into labelled sections: API layer, data processing, formatting, UI rendering, controllers, and events/init.

## Setup

1. Create a free account at <https://openweathermap.org/api> and copy your API key.
2. Open `script.js` and replace the placeholder on the first config line:
   ```js
   const API_KEY = 'YOUR_API_KEY_HERE';
   ```
3. Open `index.html` in a browser (or use a local server such as VS Code Live Server).

> New OpenWeatherMap keys can take up to about 2 hours to activate. Until then the app shows an "Invalid API key" message.

## API Endpoints Used

| Purpose | Endpoint |
|---|---|
| City lookup (geocoding) | `/geo/1.0/direct` |
| Current weather | `/data/2.5/weather` |
| 5-day / 3-hour forecast | `/data/2.5/forecast` |
| Air quality | `/data/2.5/air_pollution` |

## Notes and Limitations

- The free plan provides forecasts in 3-hour steps, so the hourly strip shows 3-hour intervals.
- UV index and weather alerts are not shown because they are not available on the free endpoints.
- The API key is stored in client-side code, which is fine for a learning project. A production app should proxy requests through a server to keep the key private.
- The last searched city is remembered using `localStorage`.
