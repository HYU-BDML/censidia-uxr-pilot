export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { api, sessionsPost } from '@/lib/server';
export const POST = api(sessionsPost);
