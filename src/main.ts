import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

// Define constants for gameplay parameters and starting location
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;
const PLAYER_RADIUS = 0.0003;
let playerCoins = 0;
let playerPosition = OAKES_CLASSROOM;

// Flyweight Implementation for Cell Caching
const cellCache = new Map<string, { i: number; j: number }>();
function latLngToGridCoords(
  lat: number,
  lng: number,
): { i: number; j: number } {
  const i = Math.floor(lat * 10000);
  const j = Math.floor(lng * 10000);
  return { i, j };
}
function getOrCreateCell(lat: number, lng: number) {
  const key = `${lat},${lng}`;
  if (!cellCache.has(key)) {
    const cell = latLngToGridCoords(lat, lng);
    cellCache.set(key, cell);
  }
  return cellCache.get(key)!;
}

// Coin Serialization and Cache State Management
function formatCoinID(coin: { i: number; j: number; serial: number }): string {
  return `${coin.i}:${coin.j}#${coin.serial}`;
}
class CacheMemento {
  constructor(
    public i: number,
    public j: number,
    public coins: { i: number; j: number; serial: number }[],
  ) {}
}
const cacheMementos = new Map<string, CacheMemento>();
function saveCacheState(
  i: number,
  j: number,
  coins: { i: number; j: number; serial: number }[],
) {
  const key = `${i}:${j}`;
  cacheMementos.set(key, new CacheMemento(i, j, [...coins]));
}
function getCacheState(i: number, j: number): CacheMemento | undefined {
  return cacheMementos.get(`${i}:${j}`);
}

// Initialize Map and UI
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: 19,
  minZoom: 19,
  maxZoom: 19,
  zoomControl: false,
  scrollWheelZoom: false,
});
leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const playerMarker = leaflet.marker(OAKES_CLASSROOM).bindTooltip("That's you!");
playerMarker.addTo(map);
const movementHistory = leaflet.polyline([], { color: "blue" }).addTo(map);

// Create UI controls for movement and geolocation
function setupControls() {
  const controlsDiv = document.createElement("div");
  controlsDiv.id = "controlsDiv";

  const buttonUp = createButton("⬆️", () => movePlayer(TILE_DEGREES, 0));
  const buttonDown = createButton("⬇️", () => movePlayer(-TILE_DEGREES, 0));
  const buttonLeft = createButton("⬅️", () => movePlayer(0, -TILE_DEGREES));
  const buttonRight = createButton("➡️", () => movePlayer(0, TILE_DEGREES));
  const geolocationButton = createButton("🌐", enableGeolocation);
  const resetButton = createButton("🚮", resetGameState);
  resetButton.title = "Reset Game State"; // Tooltip text

  [
    buttonUp,
    buttonLeft,
    buttonRight,
    buttonDown,
    geolocationButton,
    resetButton,
  ].forEach((btn) => controlsDiv.appendChild(btn));
  document.body.appendChild(controlsDiv);
}

function createButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.innerText = label;
  button.className = "control-button";
  button.onclick = onClick;
  return button;
}

// Move Player and Update Position
function movePlayer(dLat: number, dLng: number) {
  playerPosition = leaflet.latLng(
    playerPosition.lat + dLat,
    playerPosition.lng + dLng,
  );
  playerMarker.setLatLng(playerPosition);
  map.setView(playerPosition);
  movementHistory.addLatLng(playerPosition);
  updateCacheLayers();
}

// Enable Geolocation for Player
function enableGeolocation() {
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      (position) => {
        playerPosition = leaflet.latLng(
          position.coords.latitude,
          position.coords.longitude,
        );
        playerMarker.setLatLng(playerPosition);
        map.setView(playerPosition);
        movementHistory.addLatLng(playerPosition);
        updateCacheLayers();
      },
      (error) => alert("Geolocation error: " + error.message),
    );
  } else {
    alert("Geolocation is not supported by your browser.");
  }
}

// Reset game state function
function resetGameState() {
  const confirmation = prompt(
    "Are you sure you want to reset the game state? Type 'yes' to confirm.",
  );
  if (confirmation === "yes") {
    // Reset player coins
    playerCoins = 0;
    alert(
      "Game state has been reset. All coins have been returned to their original caches.",
    );

    // Restore each cache to its initial saved state
    caches.forEach((cache) => {
      const savedState = getCacheState(cache.i, cache.j);
      if (savedState) {
        cache.coins = [...savedState.coins]; // Restore original coins
      }
      cache.layer.setPopupContent(createPopupContent(cache)); // Update the popup content to reflect reset
    });

    // Clear the movement history polyline
    movementHistory.setLatLngs([]);
  }
}

// Cache Management and Rendering
const caches: {
  layer: leaflet.Rectangle;
  bounds: leaflet.LatLngBounds;
  i: number;
  j: number;
  coins: { i: number; j: number; serial: number }[];
}[] = [];
function spawnCache(lat: number, lng: number) {
  const { i, j } = getOrCreateCell(lat, lng);
  const bounds = leaflet.latLngBounds([
    [lat, lng],
    [lat + TILE_DEGREES, lng + TILE_DEGREES],
  ]);

  // Get coins either from saved state or create a new array of coins
  const savedState = getCacheState(i, j);
  const coins = savedState?.coins || Array.from(
    { length: Math.floor(luck([i, j, "initialValue"].toString()) * 100) + 1 },
    (_, serial) => ({ i, j, serial }),
  );

  // Save initial state if new coins were created
  if (!savedState) {
    saveCacheState(i, j, coins);
  }

  // Create the cache object with the `coins` property
  const cache = { layer: leaflet.rectangle(bounds), bounds, i, j, coins };

  // Add cache layer to the map and bind the popup content
  cache.layer.addTo(map).bindPopup(createPopupContent(cache));
  cache.layer.on("popupopen", () => setupPopupActions(cache, cache.layer));

  // Add the cache object to `caches` array
  caches.push(cache);
}

function createPopupContent(
  cache: {
    i: number;
    j: number;
    coins: { i: number; j: number; serial: number }[];
  },
) {
  const coinIDs = cache.coins.map((coin) =>
    `<span class="coin-id" data-i="${coin.i}" data-j="${coin.j}" data-serial="${coin.serial}">${
      formatCoinID(coin)
    }</span>`
  ).join(", ");
  return `Cache located at cell (${cache.i}, ${cache.j})<br>Coins available: ${cache.coins.length}<br>Coin IDs: ${coinIDs}<br>
          <button id="collect-button-${cache.i}-${cache.j}">Collect</button><br>
          <input type="number" id="deposit-amount-${cache.i}-${cache.j}" placeholder="Coins to deposit" min="1">
          <button id="deposit-button-${cache.i}-${cache.j}">Deposit</button>`;
}

function setupPopupActions(
  cache: {
    i: number;
    j: number;
    coins: { i: number; j: number; serial: number }[];
  },
  rect: leaflet.Rectangle,
) {
  document.querySelectorAll(".coin-id").forEach((element) => {
    element.addEventListener(
      "click",
      () =>
        map.setView(
          leaflet.latLng(
            parseInt(element.getAttribute("data-i")!) / 10000,
            parseInt(element.getAttribute("data-j")!) / 10000,
          ),
          map.getZoom(),
        ),
    );
  });

  document.getElementById(`collect-button-${cache.i}-${cache.j}`)
    ?.addEventListener("click", () => {
      if (cache.coins.length) {
        playerCoins += cache.coins.length;
        cache.coins = [];
        rect.setPopupContent(createPopupContent(cache));
        saveCacheState(cache.i, cache.j, cache.coins);
        alert(`Collected! You now have ${playerCoins} coins.`);
      } else alert("No coins left in this cache.");
    });

  document.getElementById(`deposit-button-${cache.i}-${cache.j}`)
    ?.addEventListener("click", () => {
      const depositInput = document.getElementById(
        `deposit-amount-${cache.i}-${cache.j}`,
      ) as HTMLInputElement;
      const depositAmount = parseInt(depositInput.value, 10);
      if (isNaN(depositAmount) || depositAmount <= 0) {
        alert("Please enter a valid number of coins to deposit.");
        return;
      }
      if (playerCoins >= depositAmount) {
        playerCoins -= depositAmount;
        for (let serial = 0; serial < depositAmount; serial++) {
          cache.coins.push({
            i: cache.i,
            j: cache.j,
            serial: cache.coins.length,
          });
        }
        rect.setPopupContent(createPopupContent(cache));
        saveCacheState(cache.i, cache.j, cache.coins);
        alert(
          `Deposited ${depositAmount} coins! You now have ${playerCoins} coins.`,
        );
      } else alert("You don't have enough coins to deposit that amount.");
      depositInput.value = "";
    });
}

// Update Cache Visibility Based on Player Position
function updateCacheLayers() {
  caches.forEach((cache) => {
    const distance = playerPosition.distanceTo(cache.bounds.getCenter());
    if (distance <= PLAYER_RADIUS * 111000) { // Convert degrees to meters
      if (!map.hasLayer(cache.layer)) {
        map.addLayer(cache.layer); // Add to map if in range
      }
    } else {
      if (map.hasLayer(cache.layer)) {
        map.removeLayer(cache.layer); // Remove from map if out of range
      }
    }
  });
}

// Generate Cache Locations Around the Player
function generateCacheLocations() {
  for (let i = -NEIGHBORHOOD_SIZE; i <= NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j <= NEIGHBORHOOD_SIZE; j++) {
      const lat = OAKES_CLASSROOM.lat + i * TILE_DEGREES;
      const lng = OAKES_CLASSROOM.lng + j * TILE_DEGREES;
      if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
        spawnCache(lat, lng);
      }
    }
  }
}

// Initialize the Game
function initializeGame() {
  generateCacheLocations();
  updateCacheLayers();
  setupControls();
}

// Start the Game
initializeGame();
