import { ParticipantRunner } from '@/components/participant-runner';
export default async function ParticipantPage({ params }: { params: Promise<{ studyId: string }> }) {
  const { studyId } = await params;
  return <ParticipantRunner studyId={studyId} />;
}
