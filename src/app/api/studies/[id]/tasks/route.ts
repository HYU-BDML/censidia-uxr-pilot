export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { api, studyTasksPatch } from '@/lib/server';
export const PATCH = api(studyTasksPatch);
