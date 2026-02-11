import { int, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const urlsTable = sqliteTable('urls_table', {
    id: text('id').primaryKey().notNull(),
    url: text('url').notNull(),
    language: text('language').notNull(),
})

export const screenshotsTable = sqliteTable('screenshots_table', {
    id: text('id').primaryKey().notNull(),
    url: text('url').notNull(),
    language: text('language').notNull(),
    device: text('device', { enum: ['desktop', 'mobile'] }).notNull(),
    job_status: text('job_status', { enum: ['ok', 'failed'] }).notNull(),
    r2_key: text('r2_key').notNull().unique(),
    created_at: text('created_at').notNull(),
})

