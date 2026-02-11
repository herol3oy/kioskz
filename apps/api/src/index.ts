import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { screenshotsTable, urlsTable } from './db/schema'

export interface Env {
  kiosk24: D1Database;
}

const app = new Hono<{ Bindings: Env }>()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/urls', async (c) => {
  const db = drizzle(c.env.kiosk24)
  const rows = await db.select().from(urlsTable).all()
  return c.json(rows)
})

app.post('/urls', async (c) => {
  const db = drizzle(c.env.kiosk24)
  const body = await c.req.json<{
    id?: string
    url: string
    language: string
  }>()

  if (!body?.url || !body?.language) {
    return c.json({ error: 'url and language are required' }, 400)
  }

  const id = body.id ?? crypto.randomUUID()

  await db
    .insert(urlsTable)
    .values({ id, url: body.url, language: body.language })
    .run()

  return c.json({ id, url: body.url, language: body.language }, 201)
})

app.get('/screenshots', async (c) => {
  const db = drizzle(c.env.kiosk24)
  const rows = await db.select().from(screenshotsTable).all()
  return c.json(rows)
})

app.post('/screenshots', async (c) => {
  const db = drizzle(c.env.kiosk24)
  const body = await c.req.json<{
    id?: string
    url: string
    language: string
    device: 'desktop' | 'mobile'
    job_status: 'ok' | 'failed'
    r2_key: string
    created_at: string
  }>()

  if (
    !body?.url ||
    !body?.language ||
    !body?.device ||
    !body?.job_status ||
    !body?.r2_key ||
    !body?.created_at
  ) {
    return c.json(
      {
        error:
          'url, language, device, job_status, r2_key, and created_at are required',
      },
      400
    )
  }

  const id = body.id ?? crypto.randomUUID()

  await db
    .insert(screenshotsTable)
    .values({
      id,
      url: body.url,
      language: body.language,
      device: body.device,
      job_status: body.job_status,
      r2_key: body.r2_key,
      created_at: body.created_at,
    })
    .run()

  return c.json(
    {
      id,
      url: body.url,
      language: body.language,
      device: body.device,
      job_status: body.job_status,
      r2_key: body.r2_key,
      created_at: body.created_at,
    },
    201
  )
})

export default app
