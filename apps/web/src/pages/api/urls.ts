import type { APIRoute } from 'astro'

const API_BASE = 'http://localhost:8787/urls'

export const GET: APIRoute = async () => {
  try {
    const res = await fetch(API_BASE)
    
    return new Response(await res.text(), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to fetch URLs' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: await request.text(),
    })

    return new Response(await res.text(), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Proxy failed' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}