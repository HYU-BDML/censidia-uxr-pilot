'use client';
export type CommentPick = { label: string };

/** 참여자 「의견 남기기」 패널 — 체험·과업 화면 사이드바가 같이 쓴다. 상태는 부모가 들고 있다. */
export default function CommentPanel({
  pick,
  commentText,
  onText,
  onSave,
  onCancel,
  mode,
  onToggle,
  count,
  disabled,
}: {
  pick: CommentPick | null;
  commentText: string;
  onText: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  mode: boolean;
  onToggle: () => void;
  count: number;
  disabled?: boolean;
}) {
  return (
    <>
      {pick ? (
        <div className="space-y-2 rounded-xl border border-[#00a4df] bg-[#edf7fc] p-3">
          <p className="text-xs font-semibold text-[#25353f]">선택한 요소: {pick.label}</p>
          <textarea
            aria-label="컴포넌트 의견"
            value={commentText}
            maxLength={1000}
            onChange={(e) => onText(e.target.value)}
            className="field min-h-[60px] w-full resize-none text-sm"
            placeholder="이 요소에 대한 의견을 적어 주세요."
          />
          <div className="flex gap-2">
            <button disabled={!commentText.trim()} onClick={onSave} className="btn btn-primary flex-1">
              의견 저장
            </button>
            <button onClick={onCancel} className="btn btn-secondary flex-1">
              취소
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onToggle}
            aria-pressed={mode}
            disabled={disabled}
            className={mode ? 'btn btn-primary flex-1' : 'btn btn-secondary flex-1'}
          >
            {mode ? '의견 모드 끄기' : '의견 남기기'}
          </button>
          {count > 0 && <span className="text-[11px] text-[#454545]">남긴 의견 {count}개</span>}
        </div>
      )}
      {mode && !pick && <p className="text-[11px] text-[#454545]">화면에서 의견을 남길 요소를 눌러 주세요.</p>}
    </>
  );
}
