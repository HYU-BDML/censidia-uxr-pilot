import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCustomQuestions, validateCustomAnswer, MAX_CUSTOM_QUESTIONS } from '../../src/lib/survey-questions.ts';

test('빈 입력은 빈 배열', () => {
  assert.deepEqual(parseCustomQuestions(undefined), []);
  assert.deepEqual(parseCustomQuestions([]), []);
});

test('id는 서버가 c1..cN으로 부여하고 클라이언트 id는 무시한다', () => {
  const r = parseCustomQuestions([
    { id: 'x', type: 'text', question: ' 의견? ' },
    { id: 'c1', type: 'choice', question: '고르세요', options: [' 가 ', '나'] },
  ]);
  assert.deepEqual(
    r.map((q) => q.id),
    ['c1', 'c2'],
  );
  assert.equal(r[0].question, '의견?');
  assert.deepEqual(r[0].options, []);
  assert.deepEqual(r[1].options, ['가', '나']);
});

test('개수 한도', () => {
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ type: 'text', question: `q${i}` }));
  assert.equal(parseCustomQuestions(mk(MAX_CUSTOM_QUESTIONS)).length, 10);
  assert.throws(() => parseCustomQuestions(mk(11)), /10/);
});

test('질문 길이와 형식 검증', () => {
  assert.throws(() => parseCustomQuestions([{ type: 'text', question: '   ' }]));
  assert.throws(() => parseCustomQuestions([{ type: 'text', question: 'a'.repeat(201) }]));
  assert.equal(parseCustomQuestions([{ type: 'text', question: 'a'.repeat(200) }]).length, 1);
  assert.throws(() => parseCustomQuestions([{ type: 'radio', question: 'q' }]));
  assert.throws(() => parseCustomQuestions('x'));
  assert.throws(() => parseCustomQuestions([null]));
});

test('객관식 옵션 규칙', () => {
  assert.throws(() => parseCustomQuestions([{ type: 'choice', question: 'q', options: ['a'] }]));
  assert.throws(() =>
    parseCustomQuestions([{ type: 'choice', question: 'q', options: Array.from({ length: 9 }, (_, i) => `o${i}`) }]),
  );
  assert.equal(
    parseCustomQuestions([{ type: 'choice', question: 'q', options: Array.from({ length: 8 }, (_, i) => `o${i}`) }])[0]
      .options.length,
    8,
  );
  assert.throws(() => parseCustomQuestions([{ type: 'choice', question: 'q', options: ['a', ' a '] }]), /중복/);
  assert.throws(() => parseCustomQuestions([{ type: 'choice', question: 'q', options: ['a', ''] }]));
  assert.throws(() => parseCustomQuestions([{ type: 'choice', question: 'q', options: ['a', 'b'.repeat(101)] }]));
  assert.throws(() => parseCustomQuestions([{ type: 'choice', question: 'q' }]));
});

test('주관식에 옵션을 주면 거절', () => {
  assert.throws(() => parseCustomQuestions([{ type: 'text', question: 'q', options: ['a'] }]));
});

const choiceQ = { id: 'c1', type: 'choice', question: 'q', options: ['가', '나'] };
const textQ = { id: 'c2', type: 'text', question: 'q', options: [] };

test('객관식 답변은 옵션 중 하나', () => {
  assert.deepEqual(validateCustomAnswer(choiceQ, { choice: '가' }), { questionId: 'c1', choice: '가', otherText: '' });
  assert.throws(() => validateCustomAnswer(choiceQ, { choice: '다' }));
  assert.throws(() => validateCustomAnswer(choiceQ, { choice: '기타', otherText: 'x' }));
  assert.throws(() => validateCustomAnswer(choiceQ, { choice: 5 }));
});

test('주관식 답변은 otherText 1~2000자 trim', () => {
  assert.deepEqual(validateCustomAnswer(textQ, { otherText: '  좋음 ' }), {
    questionId: 'c2',
    choice: '',
    otherText: '좋음',
  });
  assert.throws(() => validateCustomAnswer(textQ, { otherText: '   ' }));
  assert.throws(() => validateCustomAnswer(textQ, { otherText: 'a'.repeat(2001) }));
  assert.throws(() => validateCustomAnswer(textQ, {}));
  assert.equal(validateCustomAnswer(textQ, { otherText: 'a'.repeat(2000) }).otherText.length, 2000);
});
