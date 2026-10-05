export const runtime='nodejs';
export const dynamic='force-dynamic';
import {api,recordingGet} from '@/lib/server';export const GET=api(recordingGet);
