export type DeviceType = 'desktop' | 'mobile'

export type JobStatus = 'ok' | 'failed'

export type UrlEntry = {
    id: string
    url: string
    language: string
}

export type ScreenshotEntry = {
    id: string
    url: string
    language: string
    device: DeviceType
    job_status: JobStatus
    r2_key: string
    created_at: string
}
