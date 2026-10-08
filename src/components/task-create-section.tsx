'use client';
import { useEffect, useRef, useState } from 'react';
import TaskEditor, { draftsToPayload, type TaskDraft } from './task-editor';

/** 연구 생성 폼 안의 「과업」 섹션. 같은 폼의 HTML 파일 입력을 읽어 편집기에 넘기고, 과업을 hidden input 으로 직렬화한다. */
export default function TaskCreateSection() {
  const anchor = useRef<HTMLDivElement>(null);
  const [htmlA, setHtmlA] = useState<string | null>(null);
  const [htmlB, setHtmlB] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskDraft[]>([]);
  useEffect(() => {
    const form = anchor.current?.closest('form');
    if (!form) return;
    const read = (name: 'htmlA' | 'htmlB', set: (v: string | null) => void) => {
      const input = form.elements.namedItem(name) as HTMLInputElement | null;
      const file = input?.files?.[0];
      if (!file) {
        set(null);
        return;
      }
      file
        .text()
        .then(set)
        .catch(() => set(null));
    };
    const onChange = (e: Event) => {
      const name = (e.target as HTMLInputElement)?.name;
      if (name === 'htmlA') read('htmlA', setHtmlA);
      if (name === 'htmlB') read('htmlB', setHtmlB);
    };
    form.addEventListener('change', onChange);
    return () => form.removeEventListener('change', onChange);
  }, []);
  return (
    <div ref={anchor}>
      <input type="hidden" name="tasks" value={JSON.stringify(draftsToPayload(tasks))} />
      <TaskEditor htmlA={htmlA} htmlB={htmlB} value={tasks} onChange={setTasks} />
    </div>
  );
}
