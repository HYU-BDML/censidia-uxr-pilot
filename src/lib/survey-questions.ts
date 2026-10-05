import type { CustomQuestion } from './types';
export const MAX_CUSTOM_QUESTIONS = 10;
const fail = (message: string): never => { throw new Error(message); };
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function parseCustomQuestions(raw: unknown): CustomQuestion[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return fail('직접 만든 질문 형식을 확인해주세요.');
  if (raw.length > MAX_CUSTOM_QUESTIONS) return fail(`직접 만든 질문은 최대 ${MAX_CUSTOM_QUESTIONS}개까지 추가할 수 있습니다.`);
  return raw.map((item, i) => {
    const n = i + 1;
    if (!isRecord(item)) return fail(`${n}번째 질문 형식을 확인해주세요.`);
    if (item.type !== 'choice' && item.type !== 'text') return fail(`${n}번째 질문의 유형을 확인해주세요.`);
    const question = typeof item.question === 'string' ? item.question.trim() : '';
    if (!question || question.length > 200) return fail(`${n}번째 질문은 1~200자로 입력해주세요.`);
    if (item.type === 'text') {
      if (item.options !== undefined && !(Array.isArray(item.options) && item.options.length === 0)) return fail(`${n}번째 주관식 질문에는 선택지를 둘 수 없습니다.`);
      return { id: `c${n}`, type: 'text' as const, question, options: [] };
    }
    if (!Array.isArray(item.options) || item.options.length < 2 || item.options.length > 8) return fail(`${n}번째 객관식 질문은 선택지가 2~8개여야 합니다.`);
    const options = item.options.map(o => (typeof o === 'string' ? o.trim() : ''));
    if (options.some(o => !o || o.length > 100)) return fail(`${n}번째 질문의 선택지는 1~100자로 입력해주세요.`);
    if (new Set(options).size !== options.length) return fail(`${n}번째 질문에 중복된 선택지가 있습니다.`);
    return { id: `c${n}`, type: 'choice' as const, question, options };
  });
}
export function validateCustomAnswer(q: CustomQuestion, answer: { choice?: unknown; otherText?: unknown }): { questionId: string; choice: string; otherText: string } {
  if (q.type === 'text') {
    const t = typeof answer.otherText === 'string' ? answer.otherText.trim() : '';
    if (!t || t.length > 2000) return fail('주관식 질문에 1~2000자로 답변해주세요.');
    return { questionId: q.id, choice: '', otherText: t };
  }
  if (typeof answer.choice !== 'string' || !q.options.includes(answer.choice)) return fail('유효한 선택지를 골라주세요.');
  return { questionId: q.id, choice: answer.choice, otherText: '' };
}
