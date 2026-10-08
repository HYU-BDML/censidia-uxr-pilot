/** Session continuity is scoped to the entered participant name and study. */
export function participantSessionKey(studyId: string, name: string): string {
  return `mindlens:participant:${encodeURIComponent(studyId)}:${encodeURIComponent(name.trim())}`;
}
export function canResumeParticipant(
  session: { studyId: string; name: string },
  studyId: string,
  name: string,
): boolean {
  return !!name.trim() && session.studyId === studyId && session.name.trim() === name.trim();
}
