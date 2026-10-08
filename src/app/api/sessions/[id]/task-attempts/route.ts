export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { api, taskAttemptsPost } from '@/lib/server';
export const POST = api(taskAttemptsPost);
