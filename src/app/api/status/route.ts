export const runtime='nodejs';
export const dynamic='force-dynamic';
import {json} from '@/lib/server';
import {kimiConfigured} from '@/lib/kimi';
export async function GET(){return json({aiConfigured:kimiConfigured(),aiProvider:kimiConfigured()?'kimi':'none',transcriptionConfigured:Boolean(process.env.MINDLENS_SPEECH_API_URL||process.env.OPENAI_API_KEY),transcriptionProvider:process.env.MINDLENS_SPEECH_API_URL?'proxy':process.env.OPENAI_API_KEY?'openai':'none'});}
