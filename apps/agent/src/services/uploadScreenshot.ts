import { ENV } from '../config/env';

export async function uploadScreenshot(
    buffer: Buffer, 
    metadata: { url: string; language: string; objectKey: string; deviceName: string; capturedAt: string }
) {
    const formData = new FormData();
    const fileBlob = new Blob([new Uint8Array(buffer)], { type: 'image/jpeg' });

    formData.append('image', fileBlob, 'screenshot.jpg');
    formData.append('url', metadata.url);
    formData.append('language', metadata.language);
    formData.append('objectKey', metadata.objectKey);
    formData.append('deviceName', metadata.deviceName);
    formData.append('capturedAt', metadata.capturedAt);

    const response = await fetch(ENV.UPLOAD_ENDPOINT, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Upload failed: ${response.status} - ${errorText}`);
    }
}