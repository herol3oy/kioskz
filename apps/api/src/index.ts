import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { screenshotsTable, urlsTable } from './db/schema'

export interface Env {
  D1: D1Database;
  R2_BUCKET: R2Bucket;
}

const app = new Hono<{ Bindings: Env }>()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/:key{.+$}', async (c) => {
  const key = c.req.param('key')

  const object = await c.env.R2_BUCKET.get(key)

  if (!object) {
    return c.text('Image not found', 404)
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)

  return new Response(object.body, {
    headers,
  })
})


app.get('/urls', async (c) => {
  const db = drizzle(c.env.D1)
  const rows = await db.select().from(urlsTable).all()
  return c.json(rows)
})

app.post('/urls', async (c) => {
  const db = drizzle(c.env.D1)
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
  const db = drizzle(c.env.D1)
  const rows = await db.select().from(screenshotsTable).all()
  return c.json(rows)
})

app.post('/screenshots', async (c) => {
  const db = drizzle(c.env.D1)
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

app.post('/upload_to_r2_bucket', async (c) => {
  try {
    const body = await c.req.parseBody()

    const imageFile = body['image']
    const url = body['url'] as string | undefined
    const language = body['language'] as string | undefined
    const objectKey = body['objectKey'] as string | undefined
    const deviceName = body['deviceName'] as string | undefined
    const capturedAt = body['capturedAt'] as string | undefined

    if (!imageFile || !(imageFile instanceof File)) {
      return c.json({ error: 'No image file provided' }, 400)
    }

    if (!url || !language || !objectKey || !deviceName || !capturedAt) {
      return c.json(
        {
          error:
            'url, language, objectKey, deviceName, and capturedAt are required',
        },
        400
      )
    }

    if (deviceName !== 'desktop' && deviceName !== 'mobile') {
      return c.json({ error: 'deviceName must be desktop or mobile' }, 400)
    }

    await c.env.R2_BUCKET.put(objectKey, await imageFile.arrayBuffer(), {
      httpMetadata: {
        contentType: imageFile.type || 'image/jpeg',
      },
    })

    const db = drizzle(c.env.D1)

    await db
      .insert(screenshotsTable)
      .values({
        id: crypto.randomUUID(),
        url,
        language,
        device: deviceName,
        job_status: 'ok',
        r2_key: objectKey,
        created_at: capturedAt,
      })
      .run()

    console.log(`Successfully uploaded and saved: ${objectKey}`)

    return c.json({ success: true, key: objectKey })

  } catch (error) {
    console.error('Upload failed:', error)
    return c.json({ success: false, error: String(error) }, 500)
  }
})

export default app
