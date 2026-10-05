export const runtime='nodejs';
export const dynamic='force-dynamic';
import {json} from '@/lib/server';
export async function GET(){return json({aiConfigured:Boolean(process.env.OPENAI_API_KEY),transcriptionConfigured:Boolean(process.env.MINDLENS_SPEECH_API_URL||process.env.OPENAI_API_KEY),transcriptionProvider:process.env.MINDLENS_SPEECH_API_URL?'proxy':process.env.OPENAI_API_KEY?'openai':'none'});}
