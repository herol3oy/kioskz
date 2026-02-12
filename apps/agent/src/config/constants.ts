export const JPEG_QUALITY = 60;

export const BROWSER_ARGS = [
    "--headless",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--hide-scrollbars",
    "--disable-notifications",
];

export const VIEWPORTS: Record<string, DeviceConfig> = {
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

export interface DeviceConfig {
    width: number;
    height: number;
    ua: string;
}