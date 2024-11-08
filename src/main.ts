import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

// classroom location
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

// gameplay parameters
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;
let playerCoins = 0;

// Flyweight cache for coordinate conversion
const cellCache = new Map<string, { i: number; j: number }>();

// Function to convert latitude and longitude to global grid coordinates anchored at Null Island
function latLngToGridCoords(
  lat: number,
  lng: number,
): { i: number; j: number } {
  const i = Math.floor(lat * 10000);
  const j = Math.floor(lng * 10000);
  return { i, j };
}

// Flyweight pattern implementation: Get or create cell coordinates
function getOrCreateCell(lat: number, lng: number) {
  const key = `${lat},${lng}`;
  if (cellCache.has(key)) {
    console.log(`Reusing existing cell for key: ${key}`);
    return cellCache.get(key)!;
  } else {
    const cell = latLngToGridCoords(lat, lng);
    console.log(`Creating new cell for key: ${key}`);
    cellCache.set(key, cell);
    return cell;
  }
}

// Create Map
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: 19,
  minZoom: 19,
  maxZoom: 19,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Add Player Marker
const playerMarker = leaflet.marker(OAKES_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

// Create and Display Caches at a location
function spawnCache(lat: number, lng: number) {
  const { i, j } = getOrCreateCell(lat, lng);
  console.log(
    `Cache at lat: ${lat}, lng: ${lng} -> Grid cell: {i: ${i}, j: ${j}}`,
  );

  const bounds = leaflet.latLngBounds([
    [lat, lng],
    [lat + TILE_DEGREES, lng + TILE_DEGREES],
  ]);

  // Determine a number of coins per cache
  const numCoins = Math.floor(luck([i, j, "initialValue"].toString()) * 100) +
    1;
  const coins = Array.from({ length: numCoins }, (_, serial) => ({
    i,
    j,
    serial,
  }));

  // Log each coin's unique ID
  coins.forEach((coin) =>
    console.log(`Coin ID: ${coin.i}:${coin.j}#${coin.serial}`)
  );

  // Store cache data (location, coins, bounds)
  const cache = {
    i,
    j,
    coins,
    bounds,
  };

  // Rectangles represent cache
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Popup Content with Deposit and Collect functionality
  const updatePopupContent = () => {
    return `Cache located at cell (${i}, ${j})<br>Coins available: ${cache.coins.length}<br>
            <button id="collect-button-${i}-${j}">Collect</button>`;
  };
  rect.bindPopup(updatePopupContent);

  // Handle Collection Functionality
  rect.on("popupopen", () => {
    const collectButton = document.getElementById(`collect-button-${i}-${j}`);
    if (collectButton) {
      collectButton.addEventListener("click", () => {
        if (cache.coins.length > 0) {
          playerCoins += cache.coins.length;
          cache.coins = [];
          alert(`Collected! You now have ${playerCoins} coins.`);
          rect.setPopupContent(updatePopupContent()); // Refresh the popup with updated coin count
        } else {
          alert("No coins left in this cache.");
        }
      });
    }
  });
}

// Create Potential Cache Locations
function generateCacheLocations() {
  for (let i = -NEIGHBORHOOD_SIZE; i <= NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j <= NEIGHBORHOOD_SIZE; j++) {
      const lat = OAKES_CLASSROOM.lat + i * TILE_DEGREES;
      const lng = OAKES_CLASSROOM.lng + j * TILE_DEGREES;
      // Determine if a cache should be spawned at this grid cell
      if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
        spawnCache(lat, lng);
      }
    }
  }
}

// Generate caches around the player's initial location
generateCacheLocations();
