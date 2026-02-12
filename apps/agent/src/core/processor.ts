import { BrowserContext, Page } from 'playwright';
import { UrlEntry } from '../../../../libs/shared/src/types';
import { getJsCleanup } from '../utils/getJsCleanup';
import { getUrlKey } from '../utils/getUrlKey';
import { JPEG_QUALITY } from '../config/constants';
import { uploadScreenshot } from '../services/uploadScreenshot';

export async function processSingleUrl(
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

            await uploadScreenshot(buffer, {
                url,
                language,
                objectKey,
                deviceName,
                capturedAt
            });

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