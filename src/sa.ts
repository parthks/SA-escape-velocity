import GamePage from "./game";
import { sleep } from "./utils";

export const NUM_OF_SHIPS = 15;
export const extensionPath = "~/Library/Application Support/Google/Chrome/Profile 2/Extensions/bhhhlbepdkbapadjdnnojkbgioiodbic/1.44.0_0";

// 15 min in milliseconds
export const PLAY_FOR_BEFORE_REFRESH = 15 * 60 * 1000;

const gamePage = new GamePage();
const errorCount = {} as Record<string, number>;

process.on("uncaughtException", async (err) => {
  console.log("An uncaught exception occurred:", err);
  errorCount[new Date().getTime()] = Date.now();
  checkErrorCount();
  await sleep(3000);
  startGameLoop();
});

process.on("unhandledRejection", async (reason, promise) => {
  console.log("An unhandled promise rejection occurred:", reason);
  errorCount[new Date().getTime()] = Date.now();
  checkErrorCount();
  await sleep(3000);
  startGameLoop();
});

// check if you have 5 errors in the last 2 minute, then STOP
const MAX_ERROR_COUNT = 5;
function checkErrorCount() {
  console.log("Checking error count");
  const now = Date.now();
  for (const [key, value] of Object.entries(errorCount)) {
    if (now - value > 120 * 1000) {
      delete errorCount[key];
    }
  }
  if (Object.keys(errorCount).length > MAX_ERROR_COUNT) {
    console.log("Too many errors, exiting");
    process.exit(1);
  }
}

async function startGameLoop() {
  await gamePage.initialize();
  await gamePage.hardReloadPage();
  gamePage.runGameLoop();
}

throw new Error("Test error"); // This should trigger the uncaughtException handler
