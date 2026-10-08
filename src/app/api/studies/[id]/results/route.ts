export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { api, json } from '@/lib/server';
import { results } from '@/lib/db';
export const GET = api(async (_, ctx) => json(results((await ctx.params).id)));
