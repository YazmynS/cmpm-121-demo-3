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

  // Display Coin IDs
  coins.forEach((coin) => console.log(`Coin ID: ${formatCoinID(coin)}`));

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

  // Handle Collection Functionality
  rect.on("popupopen", () => {
    // Collect Button
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

    // Handle Deposit Functionality
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

        //Confirm player can deposit
        if (playerCoins >= depositAmount) {
          playerCoins -= depositAmount;
          for (let serial = 0; serial < depositAmount; serial++) {
            cache.coins.push({ i, j, serial: cache.coins.length });
          }
          alert(
            `Deposited ${depositAmount} coins! You now have ${playerCoins} coins.`,
          );
          rect.setPopupContent(updatePopupContent()); // Refresh the popup with updated coin count
        } else {
          alert("You don't have enough coins to deposit that amount.");
        }

        // Clear the input after
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
      // Determine if a cache should be spawned at this grid cell
      if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
        spawnCache(lat, lng);
      }
    }
  }
}

// Generate caches around the player's location
generateCacheLocations();
