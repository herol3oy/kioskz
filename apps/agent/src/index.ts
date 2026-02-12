import { chromium, BrowserContext } from 'playwright';
import { BROWSER_ARGS, VIEWPORTS } from './config/constants';
import { fetchUrls } from './services/fetchUrls';
import { processSingleUrl } from './core/processor';
import { generateTimestampKey } from './utils/generateTimestampKey';

async function takeScreenshots() {
    console.log(`[${new Date().toISOString()}] Starting Batch Screenshot Job`);

    const urls = await fetchUrls();
    if (!urls.length) {
        console.log("No URLs received from API.");
        return;
    }

    const tsIsoFileName = generateTimestampKey();

    const browser = await chromium.launch({
        headless: true,
        args: BROWSER_ARGS
    });

    const contextsByDevice: Record<string, BrowserContext> = {};

    try {
        for (const [deviceName, config] of Object.entries(VIEWPORTS)) {
            contextsByDevice[deviceName] = await browser.newContext({
                userAgent: config.ua,
                viewport: { width: config.width, height: config.height },
                deviceScaleFactor: 1,
            });
        }

        for (const urlData of urls) {
            await processSingleUrl(contextsByDevice, urlData, tsIsoFileName);
        }

    } finally {
        for (const context of Object.values(contextsByDevice)) {
            try { await context.close(); } catch (e) { }
        }
        await browser.close();
    }

    console.log(`[${new Date().toISOString()}] Batch Job Finished`);
}

async function main() {
    try {
        await takeScreenshots();
        process.exit(0);
    } catch (error) {
        console.error("Fatal error:", error);
        process.exit(1);
    }
}

main();