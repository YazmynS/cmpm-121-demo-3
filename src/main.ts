import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

// classroom location
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

// gameplay parameters
const TILE_DEGREES = 1e-4; // 0.0001 degrees, cell size for movement and cache placement
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;
let playerCoins = 0;
let playerPosition = OAKES_CLASSROOM; // Track player position

// Define radius within which caches should be visible (in degrees)
const playerRadius = 0.0003; // Adjust this radius as needed

// Flyweight Implementation
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

// Coin Serialization
function formatCoinID(coin: { i: number; j: number; serial: number }): string {
  return `${coin.i}:${coin.j}#${coin.serial}`;
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

// Add Map Image
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

// Array to store all cache layers
const caches: { layer: leaflet.Rectangle; bounds: leaflet.LatLngBounds }[] = [];

// Function to update player position and marker
function movePlayer(dLat: number, dLng: number) {
  playerPosition = leaflet.latLng(
    playerPosition.lat + dLat,
    playerPosition.lng + dLng,
  );
  playerMarker.setLatLng(playerPosition);
  map.setView(playerPosition);
  updateCacheLayers(); // Update cache visibility based on new position
}

// Create movement buttons dynamically
const controlsDiv = document.createElement("div");
controlsDiv.id = "controlsDiv"; // Assign ID for CSS styling

// Define and add buttons, using TILE_DEGREES to ensure consistent cell-granularity movement
const buttonUp = document.createElement("button");
buttonUp.innerText = "⬆️";
buttonUp.className = "control-button"; // Apply shared button styling
buttonUp.onclick = () => movePlayer(TILE_DEGREES, 0);

const buttonDown = document.createElement("button");
buttonDown.innerText = "⬇️";
buttonDown.className = "control-button";
buttonDown.onclick = () => movePlayer(-TILE_DEGREES, 0);

const buttonLeft = document.createElement("button");
buttonLeft.innerText = "⬅️";
buttonLeft.className = "control-button";
buttonLeft.onclick = () => movePlayer(0, -TILE_DEGREES);

const buttonRight = document.createElement("button");
buttonRight.innerText = "➡️";
buttonRight.className = "control-button";
buttonRight.onclick = () => movePlayer(0, TILE_DEGREES);

// Arrange and append buttons
controlsDiv.appendChild(buttonUp);
controlsDiv.appendChild(buttonLeft);
controlsDiv.appendChild(buttonRight);
controlsDiv.appendChild(buttonDown);

document.body.appendChild(controlsDiv);

// Function to manage cache visibility based on player position
function updateCacheLayers() {
  caches.forEach((cache) => {
    const distance = playerPosition.distanceTo(cache.bounds.getCenter()); // Distance in meters

    if (distance <= playerRadius * 111000) { // Convert degrees to meters
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

  const numCoins = Math.floor(luck([i, j, "initialValue"].toString()) * 100) +
    1;
  const coins = Array.from(
    { length: numCoins },
    (_, serial) => ({ i, j, serial }),
  );
  coins.forEach((coin) => console.log(`Coin ID: ${formatCoinID(coin)}`));

  const cache = { i, j, coins, bounds };
  const rect = leaflet.rectangle(bounds);
  caches.push({ layer: rect, bounds }); // Store cache for visibility control
  rect.addTo(map); // Initially add to map

  // Popup Content
  const updatePopupContent = () => {
    const coinIDs = cache.coins.map((coin) => formatCoinID(coin)).join(", ");
    return `Cache located at cell (${i}, ${j})<br>Coins available: ${cache.coins.length}<br>Coin IDs: ${coinIDs}<br>
            <button id="collect-button-${i}-${j}">Collect</button>
            <br><br>
            <input type="number" id="deposit-amount-${i}-${j}" placeholder="Coins to deposit" min="1">
            <button id="deposit-button-${i}-${j}">Deposit</button>`;
  };
  rect.bindPopup(updatePopupContent);

  rect.on("popupopen", () => {
    const collectButton = document.getElementById(`collect-button-${i}-${j}`);
    if (collectButton) {
      collectButton.addEventListener("click", () => {
        if (cache.coins.length > 0) {
          playerCoins += cache.coins.length;
          cache.coins = [];
          alert(`Collected! You now have ${playerCoins} coins.`);
          rect.setPopupContent(updatePopupContent());
        } else {
          alert("No coins left in this cache.");
        }
      });
    }

    const depositButton = document.getElementById(`deposit-button-${i}-${j}`);
    if (depositButton) {
      depositButton.addEventListener("click", () => {
        const depositInput = document.getElementById(
          `deposit-amount-${i}-${j}`,
        ) as HTMLInputElement;
        const depositAmount = parseInt(depositInput.value, 10);

        if (isNaN(depositAmount) || depositAmount <= 0) {
          alert("Please enter a valid number of coins to deposit.");
          return;
        }

        if (playerCoins >= depositAmount) {
          playerCoins -= depositAmount;
          for (let serial = 0; serial < depositAmount; serial++) {
            cache.coins.push({ i, j, serial: cache.coins.length });
          }
          alert(
            `Deposited ${depositAmount} coins! You now have ${playerCoins} coins.`,
          );
          rect.setPopupContent(updatePopupContent());
        } else {
          alert("You don't have enough coins to deposit that amount.");
        }
        depositInput.value = "";
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
      if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
        spawnCache(lat, lng);
      }
    }
  }
}

// Generate caches around the player's initial location
generateCacheLocations();
updateCacheLayers(); // Initialize cache visibility based on the initial position
