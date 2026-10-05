export const runtime='nodejs';
export const dynamic='force-dynamic';
import {api,recordingsPost} from '@/lib/server';export const POST=api(recordingsPost);
