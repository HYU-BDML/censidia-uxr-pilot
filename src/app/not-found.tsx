import Link from 'next/link';
export default function NotFound(){return <main className="flex min-h-screen flex-col items-center justify-center gap-5"><h1 className="text-2xl font-semibold">페이지를 찾을 수 없습니다.</h1><p className="text-muted">테스트 링크를 확인하거나 시작 화면으로 돌아가 주세요.</p><Link className="btn btn-primary" href="/">시작 화면으로</Link></main>}
