const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs-extra");
const minimal_args = require("../data/minimalArgs");
const sharp = require("sharp");

module.exports = async function recordDisplayAd({
  url,
  outputPathImg,
  maxSizeBytes = 40 * 1024,
}) {

  let browser = null;
  let page = null;
  
  // console.log(
  //   `getting backup image ${outputPathImg} with max filesize ${Math.round(
  //     maxSizeBytes / 1024
  //   )}KB`
  // );
  return new Promise(async (resolve, reject) => {
    const browser = await chromium.launch({
      headless: true, // headless to false for testing
      args: minimal_args,
    }).catch(err => {
      console.error('[Error] Browser launch failed:', err);
      return reject(err);
    });

    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    await page.exposeFunction("onMessageReceivedEvent", async (e) => {
      switch (e.data.name) {
        case "animation-ready":
          await handleAnimationInfoReceived(e.data);
          break;

        case "current-frame":
          await recordFrame();
          break;
      }
    });

    async function handleAnimationInfoReceived(animationInfo) {
      await page.setViewportSize({
        width: animationInfo.width,
        height: animationInfo.height,
      });

      await dispatchEventToPage(page, {
        name: "request-goto-frame",
        frame: animationInfo.duration * 1000,
      });
    }

    async function recordFrame() {
      await page.screenshot({
        path: outputPathImg,
        type: "jpeg",
        quality: 100,
      });

      await optimizeImageToFilesize({
        path: outputPathImg,
      });

      await browser.close();

      resolve();
    }

    async function optimizeImageToFilesize({ path, quality = 100 }) {
      const output = await sharp(path)
        .jpeg({ quality })
        .toBuffer({ resolveWithObject: true });

      if (output.info.size > maxSizeBytes && quality > 1) {
        await optimizeImageToFilesize({
          path,
          maxSizeBytes,
          quality: quality - 1,
        });
      } else {
        // console.log(
        //   `saving image ${outputPathImg} weighing ${Math.round(
        //     output.info.size / 1024
        //   )}KB at quality level ${quality}`
        // );
        fs.writeFileSync(outputPathImg, output.data);
      }
    }

    async function dispatchEventToPage(page, data) {
      await page.evaluate(function (data) {
        window.postMessage(data);
      }, data);
    }

    function listenFor(page, type) {
      return page.addInitScript((type) => {
        window.addEventListener(type, (e) => {
          window.onMessageReceivedEvent({ type, data: e.data });
        });
      }, type);
    }

    await listenFor(page, "message"); // Listen for "message" custom event on page load.

    await page.goto(url);
  });
};
