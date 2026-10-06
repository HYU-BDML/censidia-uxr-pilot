/**
 * Kimi(Moonshot) 채팅 호출 — OpenAI 호환 API.
 *
 * - 키: KIMI_API_KEY. 국제판 키는 https://api.moonshot.ai/v1 에서만 인증된다(중국판 .cn 은 401).
 * - 모델: KIMI_INTERVIEW_MODEL (기본 kimi-k3).
 * - 생각하기(thinking): 기본으로 끈다. 켜 두면 짧은 max_tokens 를 추론에 다 써서 빈 답이 온다(실측).
 *   끌 수 없는 모델(예: kimi-k2.7-code-highspeed)은 400 을 주므로 그때는 thinking 필드 없이 한 번 더 보낸다.
 */
export type KimiMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export function kimiConfigured(): boolean {
  return Boolean(process.env.KIMI_API_KEY);
}

export async function kimiChat(messages: KimiMessage[], options: { maxTokens: number; temperature?: number; timeoutMs: number }): Promise<string> {
  const key = process.env.KIMI_API_KEY;
  if (!key) throw new Error('KIMI_API_KEY missing');
  const base = (process.env.KIMI_BASE_URL || 'https://api.moonshot.ai/v1').replace(/\/+$/, '');
  const model = process.env.KIMI_INTERVIEW_MODEL || 'kimi-k3';
  const thinking = process.env.KIMI_THINKING === 'enabled' ? undefined : { type: 'disabled' };
  const send = (withThinking: boolean) =>
    fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: options.maxTokens, temperature: options.temperature, ...(withThinking && thinking ? { thinking } : {}) }),
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  let response = await send(true);
  if (response.status === 400 && thinking) {
    const failure = await response.clone().json().catch(() => ({}));
    if (/thinking/i.test(String(failure.error?.message || ''))) response = await send(false);
  }
  if (!response.ok) {
    const failure = await response.json().catch(() => ({}));
    console.warn('[MindLens] Kimi provider error', response.status, String(failure.error?.code || failure.error?.type || 'unknown'));
    throw new Error(`Provider ${response.status}`);
  }
  const result = await response.json();
  const output = result.choices?.[0]?.message?.content;
  if (typeof output !== 'string' || !output.trim()) throw new Error('Empty response');
  return output.trim();
}
