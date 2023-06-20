import GamePage from "./game";

export const NUM_OF_SHIPS = 15;
export const extensionPath = "~/Library/Application Support/Google/Chrome/Profile 2/Extensions/bhhhlbepdkbapadjdnnojkbgioiodbic/1.44.0_0";

// 15 min in milliseconds
export const PLAY_FOR_BEFORE_REFRESH = 15 * 60 * 1000;

const gamePage = new GamePage();
let errorCount = 0;

process.on("uncaughtException", async (err) => {
  console.log("An uncaught exception occurred:", err);
  startGameLoop();
});

process.on("unhandledRejection", async (reason, promise) => {
  console.log("An unhandled promise rejection occurred:", reason);
  startGameLoop();
});

async function startGameLoop() {
  errorCount++;
  await gamePage.initialize(errorCount > 3);
  await gamePage.hardReloadPage();
  errorCount = 0;
  gamePage.runGameLoop();
}

throw new Error("Test error"); // This should trigger the uncaughtException handler
