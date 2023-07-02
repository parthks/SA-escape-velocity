import GamePage from "./game";
import { sleep } from "./utils";

export const NUM_OF_SHIPS = 15;
export const extensionPath = "~/Library/Application Support/Google/Chrome/Profile 2/Extensions/bhhhlbepdkbapadjdnnojkbgioiodbic/1.45.0_0";

const gamePage = new GamePage();
const errorCount = {} as Record<string, number>;

// random int from 300 to 600
const randomTime = () => Math.floor(Math.random() * 300) + 300;

process.on("uncaughtException", async (err) => {
  console.log("An uncaught exception occurred:", err);
  errorCount[new Date().getTime()] = Date.now();
  checkErrorCount();
  await sleep(randomTime());
  startGameLoop();
});

process.on("unhandledRejection", async (reason, promise) => {
  console.log("An unhandled promise rejection occurred:", reason);
  errorCount[new Date().getTime()] = Date.now();
  checkErrorCount();
  await sleep(randomTime());
  startGameLoop();
});

// check if you have 5 errors in the last 1 minute, then STOP
const MAX_ERROR_COUNT = 5;
function checkErrorCount() {
  console.log("Checking error count");
  const now = Date.now();
  for (const [key, value] of Object.entries(errorCount)) {
    if (now - value > 60 * 1000) {
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
