import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'MindLens — 경험을 이해하는 리서치',description:'HTML A/B 체험, 음성 인터뷰, 설문과 행동 분석을 하나의 워크스페이스에서.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>}
