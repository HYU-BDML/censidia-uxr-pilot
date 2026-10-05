export const runtime='nodejs';
export const dynamic='force-dynamic';
import {api,studiesGet,studiesPost} from '@/lib/server';
export const GET=api(studiesGet);export const POST=api(studiesPost);
