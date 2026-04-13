const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs-extra");
const minimal_args = require("../data/minimalArgs");

function sanitizeLabelName(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

module.exports = async function captureKeyframes({
  url,
  outputDir,
  adName,
  format = "png",
  timeout = 60000,
}) {
  const launchOptions = {
    headless: true,
    args: [
      ...minimal_args,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-web-security",
    ],
    ignoreHTTPSErrors: true,
    defaultViewport: null,
    protocolTimeout: 30000,
  };

  return new Promise(async (resolve, reject) => {
    let browser;
    let isClosing = false;
    let timeoutId;
    let lastActivity = Date.now();

    function resetTimeout() {
      lastActivity = Date.now();
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        const elapsed = Date.now() - lastActivity;
        console.error(
          `\n[Error] Keyframe capture timed out for "${adName}" ` +
            `after ${Math.round(elapsed / 1000)}s of inactivity ` +
            `(captured ${capturedFiles.length}/${labels.length} labels)`
        );
        if (!isClosing) {
          isClosing = true;
          try { await browser.close(); } catch (e) { /* ignore */ }
        }
        resolve(capturedFiles); // resolve with whatever we got, don't block the batch
      }, timeout);
    }

    async function cleanup() {
      if (timeoutId) clearTimeout(timeoutId);
      if (!isClosing) {
        isClosing = true;
        try { await browser.close(); } catch (e) { /* ignore */ }
      }
    }

    try {
      browser = await puppeteer.launch(launchOptions);
    } catch (err) {
      console.error("[Error] Browser launch failed:", err);
      return reject(err);
    }

    const page = await browser.newPage();

    let labels = [];
    let currentLabelIndex = 0;
    const capturedFiles = [];

    page.on("error", async (err) => {
      console.error(`[Error] Page crashed for "${adName}":`, err);
      await cleanup();
      reject(err);
    });

    page.on("close", () => {
      if (!isClosing) {
        console.error(`\n[Error] Page unexpectedly closed for "${adName}"`);
        cleanup();
        resolve(capturedFiles);
      }
    });

    browser.on("disconnected", () => {
      if (!isClosing) {
        console.error(`\n[Error] Browser disconnected for "${adName}"`);
        if (timeoutId) clearTimeout(timeoutId);
        resolve(capturedFiles);
      }
    });

    await page.exposeFunction("onMessageReceivedEvent", async (e) => {
      resetTimeout();
      switch (e.data.name) {
        case "animation-ready":
          await handleAnimationReady(e.data);
          break;

        case "current-frame":
          await captureCurrentLabel();
          break;
      }
    });

    function parseLabels(raw) {
      if (!raw) return [];
      let parsed = [];
      // Handle object format: { "start": 0, "frame1": 3, ... }
      if (!Array.isArray(raw) && typeof raw === "object") {
        parsed = Object.entries(raw).map(([name, time]) => ({ name, time }));
      }
      // Handle array format: [{ name: "start", time: 0 }, ...]
      else if (Array.isArray(raw)) {
        parsed = raw;
      }
      return sortAndFilterLabels(parsed);
    }

    function sortAndFilterLabels(labels) {
      if (!labels.length) return labels;

      // Sort by time so labels are in timeline order
      labels.sort((a, b) => a.time - b.time);

      // Skip any label at time 0 — the animation hasn't built
      // the first frame yet at t=0, so it would be an empty image.
      // The first meaningful keyframe is the label where the first
      // frame finishes constructing (e.g. "frame1" at t=3).
      labels = labels.filter((label) => label.time > 0);

      return labels;
    }

    async function getLabelsFromPage() {
      return page.evaluate(() => {
        if (typeof gsap === "undefined") return null;

        // Walk GSAP's global timeline tree to find timelines with labels
        function findLabels(tl) {
          if (tl.labels && Object.keys(tl.labels).length > 0) {
            return tl.labels;
          }
          const children = tl.getChildren
            ? tl.getChildren(false, false, true)
            : [];
          for (const child of children) {
            const found = findLabels(child);
            if (found) return found;
          }
          return null;
        }

        return findLabels(gsap.globalTimeline);
      });
    }

    async function handleAnimationReady(animationInfo) {
      // Try labels from message first, fallback to querying GSAP on the page
      labels = parseLabels(animationInfo.labels);

      if (!labels.length) {
        const pageLabels = await getLabelsFromPage();
        labels = parseLabels(pageLabels);
      }

      if (!labels.length) {
        console.warn(
          `\n[Warning] No GSAP timeline labels found for "${adName}". ` +
            "Make sure the ad has a GSAP timeline with labels (e.g. 'start', 'frame1', etc.)."
        );
        await cleanup();
        return resolve(capturedFiles);
      }

      const deviceScaleFactor = await page.evaluate("window.devicePixelRatio");

      await page.setViewport({
        width: animationInfo.width,
        height: animationInfo.height,
        deviceScaleFactor,
      });

      console.log(
        `\nCapturing ${labels.length} keyframe(s) for "${adName}": ${labels.map((l) => l.name).join(", ")}`
      );

      // Request the first label's frame
      await dispatchEventToPage(page, {
        name: "request-goto-frame",
        frame: labels[0].time * 1000,
      });
    }

    async function captureCurrentLabel() {
      try {
        const label = labels[currentLabelIndex];
        const sanitizedName = sanitizeLabelName(label.name);
        const ext = format === "jpg" ? "jpg" : "png";
        const filename = `${adName}_${sanitizedName}.${ext}`;
        const outputPath = path.join(outputDir, filename);

        const screenshotOptions =
          format === "jpg"
            ? { path: outputPath, type: "jpeg", quality: 100 }
            : { path: outputPath, type: "png" };

        await page.screenshot(screenshotOptions);
        capturedFiles.push(outputPath);

        currentLabelIndex++;
        process.stdout.write(
          `\r  [${adName}] ${currentLabelIndex}/${labels.length} keyframes captured`
        );

        if (currentLabelIndex < labels.length) {
          await dispatchEventToPage(page, {
            name: "request-goto-frame",
            frame: labels[currentLabelIndex].time * 1000,
          });
        } else {
          process.stdout.write("\n");
          await cleanup();
          resolve(capturedFiles);
        }
      } catch (error) {
        console.error(`\n[Error] Failed to capture keyframe for "${adName}":`, error);
        await cleanup();
        reject(error);
      }
    }

    async function dispatchEventToPage(page, data) {
      await page.evaluate(function (data) {
        window.postMessage(data);
      }, data);
    }

    function listenFor(page, type) {
      return page.evaluateOnNewDocument((type) => {
        window.addEventListener(type, (e) => {
          window.onMessageReceivedEvent({ type, data: e.data });
        });
      }, type);
    }

    await listenFor(page, "message");

    resetTimeout(); // start the inactivity timer
    await page.goto(url);
  });
};
