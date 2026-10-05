export const runtime='nodejs';
export const dynamic='force-dynamic';
import {api,json} from '@/lib/server';import {getStudy} from '@/lib/db';
export const GET=api(async(_,ctx)=>json({study:getStudy((await ctx.params).id)}));
