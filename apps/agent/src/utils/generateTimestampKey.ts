export function generateTimestampKey(): string {
    const now = new Date();
    // 2023-10-25T10-30-00Z
    return now.toISOString().split('.')[0].replace(/:/g, '-') + 'Z';
}