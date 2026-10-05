export const runtime='nodejs';
export const dynamic='force-dynamic';
import {api,commentsPost} from '@/lib/server';export const POST=api(commentsPost);
