import type { APIRoute } from 'astro'

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = locals.runtime.env;
    
    const res = await env.API_WORKER.fetch('http://internal/urls', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.API_KEY}`
      },
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