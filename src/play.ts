// each ship warps randomly around the screen

import * as fs from "fs";
import { Page } from "puppeteer";
import { NUM_OF_SHIPS } from "./sa";
import { clearDisplayInjections, getRandomOvalCoordinates, injectClickDisplay, positionOffset, sleep } from "./utils";
export default class PlayGame {
  page: Page;
  width: number;
  height: number;
  centerX: number;
  centerY: number;

  firstNavShipX: number;
  firstNavShipY: number;

  currentNavBarShipX: number;
  currentNavBarShipY: number;

  warpButtonX: number;
  warpButtonY: number;
  scanButtonX: number;
  scanButtonY: number;

  warpType: "random" | "up_and_down";
  warpingDirection: "up" | "down";
  warpStep: number;
  currentAction: "scan" | "warp";

  constructor(page: Page, width: number, height: number, CURRENT_STARTING_POSITION: number, CURRENT_MOVING_DIRECTION: "up" | "down") {
    this.page = page;
    this.width = width;
    this.height = height;

    // Calculate the center coordinates
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;

    this.firstNavShipX = this.width - 150;
    this.firstNavShipY = this.centerY - 140;

    this.warpButtonX = this.centerX + 25;
    this.warpButtonY = this.centerY - 25;

    this.scanButtonX = this.centerX + 50;
    this.scanButtonY = this.centerY;

    this.warpType = "up_and_down";
    this.warpingDirection = CURRENT_MOVING_DIRECTION;
    this.warpStep = CURRENT_STARTING_POSITION;
    this.currentAction = "scan";
  }

  async measureNetworkRequests() {
    this.page.on("request", (interceptedRequest) => {
      console.log("playing requests", interceptedRequest.url());
      interceptedRequest.continue();
    });
  }

  async startPlaying() {
    this.currentNavBarShipX = this.firstNavShipX;
    this.currentNavBarShipY = this.firstNavShipY;
    // loop over NUM_OF_SHIPS to scan
    for (let i = NUM_OF_SHIPS > 7 ? 1 : 0; i < NUM_OF_SHIPS; i++) {
      if (i > 7) {
        await this.scrollDownOneShipTheNavBar(this.page);
      } else {
        // get ready to click next ship
        this.currentNavBarShipY += 36;
      }
      this.currentNavBarShipY += positionOffset(i);
      await this.clickOnShipInNavBar(this.page);

      if (i == 1 && NUM_OF_SHIPS > 7) {
        // time to zoom back to first ship
        await sleep(500);
      }

      // scan or warp
      if (this.currentAction === "scan") {
        await this.scan(this.page);
        if (i < 7) await sleep(250); // give some time between the scans
      } else await this.warp(this.page);

      // close warning popup if it shows up
      await this.page.mouse.click(this.centerX, this.centerY + 50);

      // close observe screen if it shows up
      await this.page.mouse.click(50, 35);
    }

    if (NUM_OF_SHIPS > 7) {
      // for last ship in nav bar when scrolling down
      await this.scrollDownOneShipTheNavBar(this.page);
      this.currentNavBarShipY += 23;
      await this.clickOnShipInNavBar(this.page);
      if (this.currentAction === "scan") await this.scan(this.page);
      else await this.warp(this.page);
      await this.scrollAllTheWayUpTheNavBar(this.page);
    }

    // oscillate between scan and warp every loop
    if (this.currentAction === "scan") this.currentAction = "warp";
    else {
      // warping all the ships, 1 round of warp is done
      this.currentAction = "scan";
      this.warpStep++;

      // console.info("warp step", this.warpStep);

      if (this.warpStep >= 110) {
        // >100 to allow ships to align together for next round
        this.warpStep = 1;
        if (this.warpingDirection === "up") this.warpingDirection = "down";
        else if (this.warpingDirection === "down") this.warpingDirection = "up";
      }

      // write warpStep and warpingDirection as json to file
      const writeData = { currentPosition: this.warpStep, currentMovingDirection: this.warpingDirection };
      const f = await fs.promises.open("data.json", "w");
      await f.writeFile(JSON.stringify(writeData));
      await f.close();
    }
  }

  private async clickOnShipInNavBar(page: Page) {
    // click on ship in nav bar
    // console.info("clicked on ship in nav bar");
    await injectClickDisplay(page, this.currentNavBarShipX, this.currentNavBarShipY);
    await page.mouse.click(this.currentNavBarShipX, this.currentNavBarShipY);

    // sleep for the animation to move to the ship and buttons to show up
    await sleep(600);
    await clearDisplayInjections(page);
  }

  private async scan(page: Page) {
    // click scan button
    // console.info("clicked scan button");
    await injectClickDisplay(page, this.scanButtonX, this.scanButtonY);
    await sleep(200);
    // console.info("waiting for request to start", new Date());
    // page.waitForRequest((request) => request.url().includes("https://solana-api.syndica.io/access-token")),
    await Promise.all([page.mouse.click(this.scanButtonX, this.scanButtonY)]);
    // console.info("scan request made", new Date());
    await clearDisplayInjections(page);
  }

  private async warp(page: Page) {
    if (this.warpType === "random") await this.warpRandom(this.page);
    else if (this.warpType === "up_and_down") {
      // warp up and down in the same column 100 times in each direction
      if (this.warpingDirection === "up") await this.warpUp(this.page);
      else if (this.warpingDirection === "down") await this.warpDown(this.page);
    }
  }

  private async warpRandom(page: Page) {
    // click warp button
    // console.info("clicked warp button");
    await injectClickDisplay(page, this.warpButtonX, this.warpButtonY);
    await page.mouse.click(this.warpButtonX, this.warpButtonY);

    // select random spot to warp to
    const warpToX = this.centerX + getRandomOvalCoordinates().x;
    const warpToY = this.centerY + getRandomOvalCoordinates().y;
    await sleep(500);
    // console.info("warping to random spot", warpToX, warpToY);
    await injectClickDisplay(page, warpToX, warpToY);
    await page.mouse.click(warpToX, warpToY);
    await sleep(1000);
    await clearDisplayInjections(page);
  }

  private async warpUp(page: Page) {
    // click warp button
    // console.info("clicked warp button");
    await injectClickDisplay(page, this.warpButtonX, this.warpButtonY);
    await sleep(200);
    await page.mouse.click(this.warpButtonX, this.warpButtonY);

    // select random spot to warp to
    const warpToX = this.centerX;
    const warpToY = this.centerY - 40;
    await sleep(400); // for the green boxes to appear after clicking warp
    // console.info("warping up one spot", warpToX, warpToY);
    await injectClickDisplay(page, warpToX, warpToY);
    // console.info("waiting for request to start", new Date());
    // page.waitForRequest((request) => request.url().includes("https://solana-api.syndica.io/access-token")),
    await Promise.all([page.mouse.click(warpToX, warpToY)]);
    // console.info("warp request made", new Date());
    await sleep(200);
    await clearDisplayInjections(page);
  }

  private async warpDown(page: Page) {
    // click warp button
    // console.info("clicked warp button");
    await injectClickDisplay(page, this.warpButtonX, this.warpButtonY);
    await sleep(200);
    await page.mouse.click(this.warpButtonX, this.warpButtonY);

    // select random spot to warp to
    const warpToX = this.centerX;
    const warpToY = this.centerY + 40;
    await sleep(400); // for the green boxes to appear after clicking warp
    // console.info("warping down one spot", warpToX, warpToY);
    await injectClickDisplay(page, warpToX, warpToY);
    // console.info("waiting for request to start", new Date());
    // page.waitForRequest((request) => request.url().includes("https://solana-api.syndica.io/access-token")),
    await Promise.all([page.mouse.click(warpToX, warpToY)]);
    // console.info("warp request made", new Date());
    await sleep(200);
    await clearDisplayInjections(page);
  }

  private async scrollDownOneShipTheNavBar(page: Page) {
    // console.info("scrolling down one ship");
    const topClickShipY = this.firstNavShipY + 36;
    await page.mouse.move(this.firstNavShipX, topClickShipY);
    await page.mouse.down();
    await page.mouse.move(this.firstNavShipX, topClickShipY - 38);
    await page.mouse.up();
    await sleep(200);
    // console.info("scrolled down one ship");
  }
  private async scrollAllTheWayUpTheNavBar(page: Page) {
    // console.info("scrolling up in the nav bar");
    const topClickShipY = this.firstNavShipY + 36;
    await page.mouse.move(this.firstNavShipX, topClickShipY);
    await page.mouse.down();
    await page.mouse.move(this.firstNavShipX, topClickShipY + 500);
    await page.mouse.up();
    await sleep(200);
    // console.info("scrolled up in the nav bar");
  }
}
