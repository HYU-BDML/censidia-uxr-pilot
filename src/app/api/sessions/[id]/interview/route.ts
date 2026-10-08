export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { api, interviewPost } from '@/lib/server';
export const POST = api(interviewPost);
