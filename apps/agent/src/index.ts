import { chromium, BrowserContext, Page } from 'playwright';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import dotenv from 'dotenv';
import 'dotenv/config';
import { DeviceType, JobStatus, UrlEntry } from '../../../libs/shared/src/types';
import { getJsCleanup } from './getJsCleanup';

dotenv.config({ quiet: true });

const JPEG_QUALITY = 60;
const URLS_ENDPOINT =
    process.env.NODE_ENV === 'production'
        ? 'https://kioskz-api.potato0.workers.dev/urls'
        : 'http://localhost:8787/urls';
const SCREENSHOTS_ENDPOINT =
    process.env.NODE_ENV === 'production'
        ? 'https://kioskz-api.potato0.workers.dev/screenshots'
        : 'http://localhost:8787/screenshots';

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

const R2_ENDPOINT_URL = process.env.R2_ENDPOINT_URL;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET;
if (!R2_ENDPOINT_URL || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error('Missing R2 environment variables');
}

const s3Client = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT_URL,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
});


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


async function storeScreenshotJob(
    url: string,
    language: string,
    r2Key: string,
    status: JobStatus,
    createdAt: string,
    device: DeviceType
) {
    try {
        const response = await fetch(SCREENSHOTS_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url,
                language,
                device,
                job_status: status,
                r2_key: r2Key,
                created_at: createdAt,
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Screenshot POST failed: ${response.status} - ${text}`);
        }
    } catch (err) {
        console.error(`Screenshot POST exception for ${url} (${device}):`, err);
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

            console.log(`[${new Date().toISOString()}] Uploading ${url} [${deviceName}] to R2`);

            const buffer = await page.screenshot({
                type: 'jpeg',
                quality: JPEG_QUALITY
            });

            const upload = new Upload({
                client: s3Client,
                params: {
                    Bucket: R2_BUCKET,
                    Key: objectKey,
                    Body: buffer,
                    ContentType: 'image/jpeg',
                },
            });

            await upload.done();

            await storeScreenshotJob(
                url,
                language,
                objectKey,
                'ok',
                capturedAt,
                deviceName as DeviceType
            );

        } catch (error) {
            console.error(`Error for ${url} [${deviceName}]:`, error);

            await storeScreenshotJob(
                url,
                language,
                objectKey,
                'failed',
                capturedAt,
                deviceName as DeviceType
            );
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