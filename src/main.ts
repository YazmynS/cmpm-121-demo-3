import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

//classroom location
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

//gamplay parameters
//const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;
let playerCoins = 0;

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
function spawnCache(i: number, j: number) {
  const origin = OAKES_CLASSROOM;
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);

  // Determine a number of coins per cache
  const numCoins = Math.floor(luck([i, j, "initialValue"].toString()) * 100) +
    1;

  // Store cache data (location, coins, bounds)
  const cache = {
    i,
    j,
    coins: numCoins,
    bounds,
  };

  // Rectangles represent cache
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Popup Content with Deposit and Collect functionality
  const updatePopupContent = () => {
    return `Cache located at cell (${i}, ${j})<br>Coins available: ${cache.coins}<br>
            <button id="collect-button-${i}-${j}">Collect</button>
            <br><br>
            <input type="number" id="deposit-amount-${i}-${j}" placeholder="Coins to deposit" min="1">
            <button id="deposit-button-${i}-${j}">Deposit</button>`;
  };
  rect.bindPopup(updatePopupContent);

  // Handle Collection Functionality
  rect.on("popupopen", () => {
    const collectButton = document.getElementById(`collect-button-${i}-${j}`);
    if (collectButton) {
      collectButton.addEventListener("click", () => {
        if (cache.coins > 0) {
          playerCoins += cache.coins;
          cache.coins = 0;
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

        if (playerCoins >= depositAmount) {
          // Deduct from player coins and add to cache
          playerCoins -= depositAmount;
          cache.coins += depositAmount;
          alert(
            `Deposited ${depositAmount} coins! You now have ${playerCoins} coins.`,
          );
          rect.setPopupContent(updatePopupContent()); // Refresh the popup with updated coin count
        } else {
          alert("You don't have enough coins to deposit that amount.");
        }

        // Clear the input after the deposit
        depositInput.value = "";
      });
    }
  });
}

// Create Potential Cache Locations
function generateCacheLocations() {
  for (let i = -NEIGHBORHOOD_SIZE; i <= NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j <= NEIGHBORHOOD_SIZE; j++) {
      // Determine if a cache should be spawned at this grid cell
      if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
        spawnCache(i, j);
      }
    }
  }
}

// Generate caches around the player's initial location
generateCacheLocations();
