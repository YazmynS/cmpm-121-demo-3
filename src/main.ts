// Updated Full File
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

// Define interfaces
interface Coin {
  i: number;
  j: number;
  serial: number;
}

interface Cache {
  layer: leaflet.Rectangle;
  bounds: leaflet.LatLngBounds;
  i: number;
  j: number;
  coins: Coin[];
}

interface CacheMemento {
  i: number;
  j: number;
  coins: Coin[];
}

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
function formatCoinID(coin: Coin): string {
  return `${coin.i}:${coin.j}#${coin.serial}`;
}
const cacheMementos = new Map<string, CacheMemento>();
const currentCacheState = new Map<string, CacheMemento>(); // For current state

function saveCacheState(i: number, j: number, coins: Coin[]) {
  const key = `${i}:${j}`;
  currentCacheState.set(key, { i, j, coins: [...coins] });
}

function getCacheState(i: number, j: number): CacheMemento | undefined {
  return currentCacheState.get(`${i}:${j}`);
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
  controlsDiv.style.display = "none"; // Hide by default

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

  // Toggle button to show/hide directional controls
  const toggleButton = document.createElement("button");
  toggleButton.innerText = "Show Controls";
  toggleButton.className = "control-button toggle-controls";
  toggleButton.onclick = () => {
    if (controlsDiv.style.display === "none") {
      controlsDiv.style.display = "block";
      toggleButton.innerText = "Hide Controls";
    } else {
      controlsDiv.style.display = "none";
      toggleButton.innerText = "Show Controls";
    }
  };
  document.body.appendChild(toggleButton);
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
// Reset game state function
function resetGameState() {
  const confirmation = prompt(
    "Type 'yes' reset the game state.",
  );
  if (confirmation === "yes") {
    playerCoins = 0;
    alert(
      "Game state has been reset.",
    );

    caches.forEach((cache) => {
      const originalState = cacheMementos.get(`${cache.i}:${cache.j}`); // Retrieve original state
      if (originalState) {
        cache.coins = [...originalState.coins]; // Reset to original coins
        saveCacheState(cache.i, cache.j, cache.coins); // Update current state with original
      }
      const currentState = getCacheState(cache.i, cache.j); // Access current state for logging or debug
      console.log(`Reset cache (${cache.i}, ${cache.j}):`, currentState);

      cache.layer.setPopupContent(createPopupContent(cache));
    });

    movementHistory.setLatLngs([]); // Clear movement history
  }
}

// Cache Management and Rendering
const caches: Cache[] = [];
function spawnCache(lat: number, lng: number) {
  const { i, j } = getOrCreateCell(lat, lng);
  const bounds = leaflet.latLngBounds([[lat, lng], [
    lat + TILE_DEGREES,
    lng + TILE_DEGREES,
  ]]);
  const key = `${i}:${j}`;
  const coins = cacheMementos.has(key)
    ? cacheMementos.get(key)!.coins
    : Array.from(
      { length: Math.floor(luck([i, j, "initialValue"].toString()) * 100) + 1 },
      (_, serial) => ({ i, j, serial }),
    );

  if (!cacheMementos.has(key)) {
    cacheMementos.set(key, { i, j, coins: [...coins] }); // Store original state
  }
  saveCacheState(i, j, coins); // Save current state

  const cache: Cache = {
    layer: leaflet.rectangle(bounds),
    bounds,
    i,
    j,
    coins,
  };
  cache.layer.addTo(map).bindPopup(createPopupContent(cache));
  cache.layer.on("popupopen", () => setupPopupActions(cache, cache.layer));
  caches.push(cache);
}

function createPopupContent(cache: Cache) {
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

function setupPopupActions(cache: Cache, rect: leaflet.Rectangle) {
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

// Sensor-based movement
function enableSensorMovement() {
  if (globalThis.DeviceOrientationEvent) {
    globalThis.addEventListener("deviceorientation", (event) => {
      const { beta, gamma } = event;
      if (beta && gamma) {
        const tiltThreshold = 10; // Threshold for movement
        let dLat = 0;
        let dLng = 0;

        if (beta > tiltThreshold) dLat = TILE_DEGREES;
        else if (beta < -tiltThreshold) dLat = -TILE_DEGREES;

        if (gamma > tiltThreshold) dLng = TILE_DEGREES;
        else if (gamma < -tiltThreshold) dLng = -TILE_DEGREES;

        if (dLat !== 0 || dLng !== 0) movePlayer(dLat, dLng);
      }
    });
  } else {
    alert("Sensor-based movement is not supported on this device.");
  }
}

// Initialize the Game
function initializeGame() {
  generateCacheLocations();
  updateCacheLayers();
  setupControls();
  enableSensorMovement(); // Enable sensor movement by default
}

// Start the Game
initializeGame();
