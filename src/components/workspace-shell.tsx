'use client';
import Link from 'next/link';
import { ArrowLeft, FlaskConical, LayoutDashboard, LogOut, PanelsTopLeft } from 'lucide-react';
import s from './workspace.module.css';
export default function WorkspaceShell({
  owner,
  children,
  detail = false,
}: {
  owner: string;
  children: React.ReactNode;
  detail?: boolean;
}) {
  return (
    <div className={s.shell}>
      <aside className={s.sidebar}>
        <Link href="/workspace" className={s.brand}>
          <span className={s.mark}>
            <PanelsTopLeft size={20} />
          </span>
          mindlens<span className={s.beta}>BETA</span>
        </Link>
        <div className={s.workspaceLabel}>RESEARCH WORKSPACE</div>
        <Link href="/workspace" className={s.navActive}>
          <LayoutDashboard size={18} /> 내 연구
        </Link>
        <div className={s.sidebarNote}>
          <FlaskConical size={22} />
          <strong>관찰에서 발견으로</strong>
          <p>
            참여자의 행동과 목소리를
            <br />
            하나의 맥락으로 살펴보세요.
          </p>
        </div>
        <div className={s.profile}>
          <div className={s.avatar}>{owner.slice(0, 1) || 'R'}</div>
          <div>
            <strong>{owner || '연구자'}</strong>
            <small>개인 워크스페이스</small>
          </div>
          <Link href="/" title="이름 변경">
            <LogOut size={17} />
          </Link>
        </div>
      </aside>
      <main className={s.main}>
        <header className={s.topbar}>
          <span>
            {detail ? (
              <Link href="/workspace">
                <ArrowLeft size={14} /> 내 연구
              </Link>
            ) : (
              '워크스페이스'
            )}
          </span>
          <span className={s.private}>● 연구자 전용</span>
        </header>
        {children}
      </main>
    </div>
  );
}
