import StudyResultsView from '@/components/study-results';
export default async function StudyPage({params}:{params:Promise<{studyId:string}>}){const {studyId}=await params;return <StudyResultsView studyId={studyId}/>}
