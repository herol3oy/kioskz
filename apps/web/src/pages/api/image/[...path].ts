import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, locals }) => {
  const env = locals.runtime.env;

  const path = params.path;
  const res = await env.API_WORKER.fetch(`http://internal/${path}`);

  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  });
};
