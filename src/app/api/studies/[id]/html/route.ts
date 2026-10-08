export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { api, variant } from '@/lib/server';
import { getStudyHtml } from '@/lib/db';
export const GET = api(
  async (req, ctx) =>
    new Response(getStudyHtml((await ctx.params).id, variant(new URL(req.url).searchParams.get('variant'))), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "sandbox allow-scripts; frame-ancestors 'self'",
      },
    }),
);
