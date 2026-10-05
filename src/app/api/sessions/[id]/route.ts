export const runtime='nodejs';
export const dynamic='force-dynamic';
import {api,json,sessionPatch} from '@/lib/server';import {detail} from '@/lib/db';
export const GET=api(async(_,ctx)=>json(detail((await ctx.params).id)));export const PATCH=api(sessionPatch);
