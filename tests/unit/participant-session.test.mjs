import assert from 'node:assert/strict';
import { participantSessionKey, canResumeParticipant } from '../../src/lib/participant-session.ts';
const original = { studyId: 'study-1', name: 'Vini' };
assert.equal(
  canResumeParticipant(original, 'study-1', 'Other'),
  false,
  'different participant must not inherit progress',
);
assert.equal(canResumeParticipant(original, 'study-2', 'Vini'), false, 'different study must not inherit progress');
assert.equal(canResumeParticipant(original, 'study-1', ''), false, 'unknown participant must enter their name');
assert.equal(canResumeParticipant(original, 'study-1', ' Vini '), true, 'same participant can resume');
assert.notEqual(participantSessionKey('study-1', 'Vini'), participantSessionKey('study-1', 'Other'));
assert.equal(participantSessionKey('study-1', ' Vini '), participantSessionKey('study-1', 'Vini'));
console.log('6 participant session isolation checks passed');
