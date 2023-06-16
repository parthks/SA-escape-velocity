import puppeteer, { Page } from "puppeteer";
// import readline from "readline";
import PlayGame from "./play";
import { alertPage, sleep } from "./utils";
import * as fs from "fs";

let FIRST_LOAD = true;
export const NUM_OF_SHIPS = 15;
export let CURRENT_STARTING_POSITION = 1;
export let CURRENT_MOVING_DIRECTION = "down" as "up" | "down";

// reload data from last run
// check if data.json exists
if (fs.existsSync("./data.json")) {
  const data = JSON.parse(fs.readFileSync("./data.json", "utf8"));
  CURRENT_STARTING_POSITION = data.currentPosition;
  CURRENT_MOVING_DIRECTION = data.currentMovingDirection;
}

const extensionPath = "~/Library/Application Support/Google/Chrome/Profile 2/Extensions/bhhhlbepdkbapadjdnnojkbgioiodbic/1.44.0_0";

// 10 min in milliseconds
const PLAY_FOR_BEFORE_REFRESH = 10 * 60 * 1000;

// const rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout,
// });

// const askUser = (question) => {
//   return new Promise((resolve) => {
//     rl.question(question, (answer) => {
//       resolve(answer);
//     });
//   });
// };

// TODO - make sure the solflare wallet is setup and connected to the burner wallet
(async () => {
  // Set the path to your Chrome extension folder

  const browser = await puppeteer.launch({
    headless: false, // Set to false to see the browser in action
    userDataDir: "./user_data",
    defaultViewport: null,
    protocolTimeout: 0,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });

  // somehow have to setup the solflare wallet
  // and connect to the burner wallet and setup auto approve

  // Open a new page and navigate to a website
  const page = await browser.newPage();
  await page.goto("https://sage.staratlas.com");

  const allPages = await browser.pages();
  await allPages[0].close(); // empty tab page
  await allPages[2].close(); // solflare page

  // const secondTab = allPages[1];
  // await secondTab.bringToFront(); // This line is optional, as Puppeteer interacts with the page object regardless of the visual focus

  // put an alert confirm popup
  await alertPage(page, "Setup your wallet and Press Ok");

  await hardReloadPage(page);
  await page.waitForNetworkIdle({ idleTime: 5000, timeout: 60000 });

  const { width, height } = await page.evaluate(() => {
    return {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    };
  });

  // TODO - control the game from command line
  // let answer = "resume" as "resume" | "quit" | "pause";

  while (true) {
    let tryToInitializeCount = 0;
    while (true) {
      await sleep(5000);
      try {
        await initializeGame(page);
        FIRST_LOAD = false;
        break;
      } catch (e) {
        tryToInitializeCount++;
        if (tryToInitializeCount >= 5) {
          console.log("tried to initialize 5 times, but failed");
          throw new Error("tried to initialize 5 times, but failed");
        }
        console.error("failed to initialize game, " + tryToInitializeCount + " times, trying again");
        await hardReloadPage(page);
      }
    }

    // console.log("waiting to start playing the game...");
    // await readyTheGame(page);
    await sleep(1000);
    let start_time = new Date().getTime();

    const playGame = new PlayGame(page, width, height, CURRENT_STARTING_POSITION, CURRENT_MOVING_DIRECTION);

    try {
      while (true) {
        // if been playing for more than 1 hour refresh page
        if (new Date().getTime() - start_time > PLAY_FOR_BEFORE_REFRESH) {
          console.log("!!!TIME TO RELOAD PAGE!!!");
          await sleep(2500); // waiting 2.5s for existing transactions to finish
          await hardReloadPage(page);
          break;
        }
        await playGame.startPlaying();
        // console log time before reload
        console.log("time before reload: ", Math.floor((PLAY_FOR_BEFORE_REFRESH - (new Date().getTime() - start_time)) / 1000), " seconds");
      }
    } catch (e) {
      console.error("UNKNOWN ERROR while playing game, ", e);
      await hardReloadPage(page);
    }

    // read data from file and update the current position and direction for next round
    const data = JSON.parse(fs.readFileSync("./data.json", "utf8"));
    CURRENT_STARTING_POSITION = data.currentPosition;
    CURRENT_MOVING_DIRECTION = data.currentMovingDirection;
  }
})();

// let i = 0
// while (i < 100) {
//   const {x,y} = getRandomOvalCoordinates(300, 150)
//   injectClickDisplay(page, centerX+x, centerY+y)
//   i++
// }

// async function readyTheGame(page: Page) {
//   let pageLoaded = false;

//   while (!pageLoaded) {
//     const answer = (await askUser("Has the page loaded? (y/n) ")) as string;

//     if (answer.toLowerCase() === "y") {
//       pageLoaded = true;
//     } else {
//       console.log("Waiting for 5 seconds...");
//       await new Promise((resolve) => setTimeout(resolve, 5000));
//     }
//   }

//   console.log("Page loaded!");
// }

async function hardReloadPage(page: Page) {
  try {
    await deleteCookiesOnPage(page);
    await page.reload();
    await page.waitForNetworkIdle({ idleTime: 5000, timeout: 60000 });
  } catch (e) {
    console.error("FAILED to reload page");
    await deleteCookiesOnPage(page);
    await page.screenshot({ path: "error.png" });
    await page.reload();
    await page.waitForNetworkIdle({ idleTime: 5000, timeout: 60000 });
  }
  FIRST_LOAD = true;
}

async function deleteCookiesOnPage(page) {
  // Get all cookies

  const client = await page.target().createCDPSession();

  // Clear cache
  await client.send("Network.clearBrowserCache");

  // Clear cookies
  await client.send("Network.clearBrowserCookies");

  // Clear localStorage
  await page.evaluate(() => {
    localStorage.clear();
  });

  // Clear sessionStorage
  await page.evaluate(() => {
    sessionStorage.clear();
  });

  // Clear indexedDB
  // Note: This will only clear databases for the currently active origin.
  await page.evaluate(() => {
    indexedDB.deleteDatabase("_puppeteer_");
    for (let i = 0; i < window.indexedDB.databases.length; i++) {
      indexedDB.deleteDatabase(window.indexedDB.databases[i].name);
    }
  });

  const cookies = await page.cookies();
  // Delete each cookie individually
  for (let cookie of cookies) {
    await page.deleteCookie(cookie);
  }
}

async function initializeGame(page: Page) {
  // Get the dimensions of the viewport
  const { width, height } = await page.evaluate(() => {
    return {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    };
  });

  // Calculate the center coordinates
  const centerX = width / 2;
  const centerY = height / 2;

  // Acknowledge start - only first time
  if (FIRST_LOAD) {
    await page.mouse.click(centerX, centerY + 40);
    await sleep(2000);
  }

  // connect wallet
  await page.mouse.click(centerX, centerY + 0.07 * height);
  await sleep(2000);

  // disclaimer - only first time
  if (FIRST_LOAD) {
    await page.mouse.click(centerX, centerY + 100);
    await sleep(2000);
  }

  // select wallet
  await page.mouse.click(centerX, centerY + 0.035 * height);
  await sleep(5000); // solflare animation on first connect
  // have to approve on solflare wallet

  // first load each call is made twice. During page reload, each call is made once
  // const successfulRequests = {
  //   "https://starcomm.staratlas.com/matchmake/joinOrCreate/Player_Data_Room": 1,
  //   "https://starcomm.staratlas.com/matchmake/joinOrCreate/Galactic_Overview_Room": 1,
  //   "https://starcomm.staratlas.com/matchmake/joinOrCreate/Scavenger_Hunt_Room": 1,
  // };
  // function hasSpecificNetworkCallBeenMade() {
  //   return Object.values(successfulRequests).every((v) => v <= 0);
  // }
  // await page.setRequestInterception(true);

  // const listenFunction = (interceptedRequest) => {
  //   console.log(interceptedRequest.url());
  //   if (successfulRequests[interceptedRequest.url()]) {
  //     successfulRequests[interceptedRequest.url()]--;
  //   }
  //   interceptedRequest.continue();
  // };
  // const requestListener = page.on("request", listenFunction);

  // Function to handle console events
  const logHandler = (msg) => {
    console.log("LOG:", msg.text());
    if (msg.text().includes("caught (in promise) TypeError: Cannot read properties of undefined (reading 'onError')")) {
      throw new Error("FFAAAAAAK what is this shit!!! - delete cookies");
    }
  };
  // Start listening for console events
  const logsListener = page.on("console", logHandler);

  // click Play on Main Menu
  await page.mouse.click(centerX, centerY);

  console.log("waiting for network calls to be made...");
  await page.waitForResponse((response) => {
    return response.url() === "https://starcomm.staratlas.com/matchmake/joinOrCreate/Player_Data_Room";
  });

  // let sleepTime = 0;
  // while (!hasSpecificNetworkCallBeenMade()) {
  //   console.log("sleeping for 1 second");
  //   await sleep(1000);
  //   sleepTime += 1000;
  //   if (sleepTime > 60000) {
  //     console.error("waiting too long for network call to be made");
  //     throw new Error("waiting too long for network call to be made");
  //   }
  // }

  console.log("READY TO START GAME, waiting for all network calls to finish");
  await page.waitForNetworkIdle({ idleTime: 5000, timeout: 60000 });

  // Stop listening for console and request events
  // page.off("request", listenFunction);
  page.off("console", logHandler);
  // requestListener.off("request", listenFunction);
  logsListener.off("console", logHandler);
  // await page.setRequestInterception(false); // doesnt work, always errors out
  console.log("ALL NETWORK CALLS MADE, starting game");
}

/*
// Click on a specific location
await page.mouse.click(x, y);

// Drag the mouse
await page.mouse.move(startX, startY);
await page.mouse.down();
await page.mouse.move(endX, endY);
await page.mouse.up();

// Press a key
await page.keyboard.press('ArrowUp');


You can then analyze the data to understand the game state or detect specific objects.
const pixelData = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return Array.from(imageData.data);
});
*/
