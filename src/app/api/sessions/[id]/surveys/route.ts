export const runtime='nodejs';
export const dynamic='force-dynamic';
import {api,surveysPost} from '@/lib/server';export const POST=api(surveysPost);
