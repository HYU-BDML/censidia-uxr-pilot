export const runtime='nodejs';
export const dynamic='force-dynamic';
import {api,transcribePost} from '@/lib/server';export const POST=api(transcribePost);
