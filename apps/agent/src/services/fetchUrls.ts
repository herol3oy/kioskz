import { UrlEntry } from '../../../../libs/shared/src/types';
import { ENV } from '../config/env';

export async function fetchUrls(): Promise<UrlEntry[]> {
    try {
        const response = await fetch(ENV.URLS_ENDPOINT);
        if (!response.ok) {
            throw new Error(`Failed to fetch URLs: ${response.status} ${response.statusText}`);
        }
        return await response.json() as UrlEntry[];
    } catch (error) {
        console.error("Error fetching URLs from source:", error);
        return [];
    }
}