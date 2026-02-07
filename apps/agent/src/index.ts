import { chromium, BrowserContext, Page } from 'playwright';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const JPEG_QUALITY = 60;
const URLS_ENDPOINT =
    process.env.NODE_ENV === 'production'
        ? 'https://kioskz-api.potato0.workers.dev/urls'
        : 'http://localhost:8787/urls';

const CF_ACCOUNT_ID = process.env.D1_ACCOUNT_ID;
const CF_DATABASE_ID = process.env.D1_DATABASE_ID;
const CF_API_TOKEN = process.env.D1_API_TOKEN;

if (!CF_ACCOUNT_ID || !CF_DATABASE_ID || !CF_API_TOKEN) {
    throw new Error('Missing Cloudflare D1 credentials (ACCOUNT_ID, DATABASE_ID, or API_TOKEN)');
}

const D1_API_ENDPOINT = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_DATABASE_ID}/query`;

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


interface UrlEntry {
    url: string;
    lang: string;
}

function getJsCleanup(): string {
    return `
    document.body.classList.remove("didomi-popup-open")

    const advertClasses = [
        "-top-bar-advert-logged-mobile", 
        "-top-bar-advert-unlogged-mobile", 
        "-top-bar-advert-logged-desktop", 
        "-top-bar-advert-unlogged-desktop"
    ];

    document.querySelectorAll('.' + advertClasses.join(', .')).forEach(el => {
        el.classList.remove(...advertClasses);
    });

    document.querySelectorAll('nav').forEach(e => 
        e.classList.remove('navigation')
    )

    document.querySelector('.ue-l-cg.ue-l-cg--no-divider')?.remove()

    document.querySelectorAll(\`
        .ad-slot-module__container__VEdre,
        .container--ads,
        .cmpwrapper
       
    \`).forEach(e => e.remove());
    `;
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


async function executeD1Query(sql: string, params: any[]) {
    const response = await fetch(D1_API_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CF_API_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            sql: sql,
            params: params
        })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`D1 API Error: ${response.status} - ${text}`);
    }

    const result = await response.json();
    // @ts-ignore - Check for D1 specific success flag
    if (!result.success) {
        // @ts-ignore
        throw new Error(`D1 Query Failed: ${JSON.stringify(result.errors)}`);
    }
    return result;
}

async function storeScreenshotJob(
    url: string,
    language: string,
    r2Key: string,
    status: 'completed' | 'failed',
    createdAt: string,
    device: string
) {
    try {
        const id = crypto.randomUUID();

        const sql = `
            INSERT INTO screenshots (id, url, language, device, job_status, r2_key, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            id,
            url,
            language,
            device,
            status,
            r2Key,
            createdAt
        ];

        await executeD1Query(sql, params);

    } catch (err) {
        console.error(`DB Insert exception for ${url} (${device}):`, err);
    }
}

async function processSingleUrl(
    contextsByDevice: Record<string, BrowserContext>,
    urlData: UrlEntry,
    timestampIso: string
) {
    const { url, lang: language } = urlData;
    const targetUrl = `https://${url}`;
    const capturedAt = new Date().toISOString();

    for (const [deviceName, context] of Object.entries(contextsByDevice)) {
        const objectKey = `${url}/${deviceName}/${timestampIso}.jpg`;
        let page: Page | null = null;

        try {
            console.log(`[${new Date().toISOString()}] Capturing ${url} [${language}] [${deviceName}]`);

            page = await context.newPage();

            await page.goto(targetUrl, { timeout: 45000, waitUntil: 'domcontentloaded' });
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
                'completed',
                capturedAt,
                deviceName
            );

        } catch (error) {
            console.error(`Error for ${url} [${deviceName}]:`, error);

            await storeScreenshotJob(
                url,
                language,
                objectKey,
                'failed',
                capturedAt,
                deviceName
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