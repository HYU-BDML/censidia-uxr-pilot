export const runtime='nodejs';
export const dynamic='force-dynamic';
import {api,json,body,text,number} from '@/lib/server';import {seedDemo} from '@/lib/db';export const POST=api(async(req)=>{const b=await body(req);return json({study:seedDemo(text(b.owner,'이름',80),number(b.durationSeconds??300,'체험 시간',15,1800))},201);});
