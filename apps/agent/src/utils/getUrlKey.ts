export function getUrlKey(rawUrl: string): string {
    try {
        const parsed = new URL(rawUrl);
        return parsed.hostname;
    } catch {
        return rawUrl.replace(/^https?:\/\//, '').split('/')[0];
    }
}

