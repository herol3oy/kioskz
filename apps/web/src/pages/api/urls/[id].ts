import type { APIRoute } from 'astro'

export const DELETE: APIRoute = async ({ locals, params }) => {
  try {
    const env = locals.runtime.env
    const { id } = params

    if (!id) {
      return new Response(JSON.stringify({ error: 'ID is required' }), {
        status: 400,
      })
    }

    const res = await env.API_WORKER.fetch(`http://internal/urls/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.API_KEY}` 
      },
    })

    return new Response(await res.text(), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}