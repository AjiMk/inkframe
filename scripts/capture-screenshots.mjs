import { chromium } from "playwright";
import path from "path";
import fs from "fs";

async function main() {
  const outputDir = path.resolve("public/screenshots");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log("Launching browser to capture app screenshots...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // 1. Library View
  console.log("Capturing Library View...");
  await page.goto("http://localhost:8080/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outputDir, "library-view.png") });

  // 2. Studio Editor View
  console.log("Capturing Studio Editor View...");
  await page.goto("http://localhost:8080/studio/demo-night-bus-42", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(outputDir, "studio-editor.png") });

  // 3. Comic Reader View
  console.log("Capturing Comic Reader View...");
  await page.goto("http://localhost:8080/read/demo-night-bus-42", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(outputDir, "comic-reader.png") });

  await browser.close();
  console.log("Screenshots captured successfully in public/screenshots/");
}

main().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
