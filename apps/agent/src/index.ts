import { chromium, BrowserContext, Page } from 'playwright';
import dotenv from 'dotenv';
import { UrlEntry } from '../../../libs/shared/src/types';
import { getJsCleanup } from './getJsCleanup';

dotenv.config({ quiet: true });

const JPEG_QUALITY = 60;
const API_BASE_URL = process.env.API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error('API_BASE_URL is missing!');
}
const URLS_ENDPOINT = `${API_BASE_URL}/urls`;
const UPLOAD_ENDPOINT = `${API_BASE_URL}/upload_to_r2_bucket`;

const BROWSER_ARGS = [
    "--headless",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--hide-scrollbars",
    "--disable-notifications",
];

interface DeviceConfig {
    width: number;
    height: number;
    ua: string;
}

const VIEWPORTS: Record<string, DeviceConfig> = {
    desktop: {
        width: 1920,
        height: 1080,
        ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    mobile: {
        width: 390,
        height: 844,
        ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    },
};


function getUrlKey(rawUrl: string): string {
    try {
        const parsed = new URL(rawUrl);
        return parsed.hostname;
    } catch {
        return rawUrl.replace(/^https?:\/\//, '').split('/')[0];
    }
}

async function fetchUrls(): Promise<UrlEntry[]> {
    try {
        const response = await fetch(URLS_ENDPOINT);
        if (!response.ok) {
            throw new Error(`Failed to fetch URLs: ${response.status} ${response.statusText}`);
        }
        return await response.json() as UrlEntry[];
    } catch (error) {
        console.error("Error fetching URLs from source:", error);
        return [];
    }
}

async function processSingleUrl(
    contextsByDevice: Record<string, BrowserContext>,
    urlData: UrlEntry,
    timestampIso: string
) {
    const { url, language } = urlData;
    const capturedAt = new Date().toISOString();
    const urlKey = getUrlKey(url);

    for (const [deviceName, context] of Object.entries(contextsByDevice)) {
        const objectKey = `${urlKey}/${deviceName}/${timestampIso}.jpg`;
        let page: Page | null = null;

        try {
            console.log(`[${new Date().toISOString()}] Capturing ${url} [${language}] [${deviceName}]`);

            page = await context.newPage();
            await page.goto(url, { timeout: 45000, waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2500);
            await page.evaluate(getJsCleanup());

            const buffer = await page.screenshot({
                type: 'jpeg',
                quality: JPEG_QUALITY
            });

            console.log(`[${new Date().toISOString()}] Sending ${url} [${deviceName}] to API`);

            const formData = new FormData();

            const fileBlob = new Blob([new Uint8Array(buffer)], { type: 'image/jpeg' });

            formData.append('image', fileBlob, 'screenshot.jpg');
            formData.append('url', url);
            formData.append('language', language);
            formData.append('objectKey', objectKey);
            formData.append('deviceName', deviceName);
            formData.append('capturedAt', capturedAt);

            const response = await fetch(UPLOAD_ENDPOINT, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Upload failed: ${response.status} - ${errorText}`);
            }

            console.log(`[${new Date().toISOString()}] Upload successful for ${objectKey}`);

        } catch (error) {
            console.error(`Error for ${url} [${deviceName}]:`, error);

        } finally {
            if (page) {
                await page.close();
            }
        }
    }
}

async function takeScreenshots() {
    console.log(`[${new Date().toISOString()}] Starting Batch Screenshot Job`);

    const urls = await fetchUrls();

    if (urls.length === 0) {
        console.log("No URLs received from API.");
        return;
    }

    const now = new Date();
    const tsIsoFileName = now.toISOString().split('.')[0].replace(/:/g, '-') + 'Z';

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