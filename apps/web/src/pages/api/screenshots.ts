import type { APIRoute } from 'astro'

export const GET: APIRoute = async ({ locals }) => {
  try {
    const env = locals.runtime.env;

    const res = await env.API_WORKER.fetch('http://internal/screenshots');

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: 'Proxy failed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
