'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Plus,Trash2,ArrowUp,ArrowDown,X,MousePointerClick} from 'lucide-react';
import {instrument} from '@/lib/instrument';
import {TASK_LIMITS,htmlToText} from '@/lib/task-rules';
import type {StudyTask,TaskCriteria,Variant} from '@/lib/types';
import s from './workspace.module.css';

export type TaskDraft={key:number;instruction:string;timeLimitSeconds:number;criteria:{A:TaskCriteria;B:TaskCriteria}};
let nextKey=1;
export const newTaskDraft=():TaskDraft=>({key:nextKey++,instruction:'',timeLimitSeconds:TASK_LIMITS.timeDefault,criteria:{A:{},B:{}}});
export const tasksToDrafts=(tasks:StudyTask[]|undefined):TaskDraft[]=>(tasks||[]).map(t=>({key:nextKey++,instruction:t.instruction,timeLimitSeconds:t.timeLimitSeconds,criteria:{A:{...t.criteria.A},B:{...t.criteria.B}}}));
export const draftsToPayload=(drafts:TaskDraft[])=>drafts.map(d=>({instruction:d.instruction,timeLimitSeconds:d.timeLimitSeconds,criteria:d.criteria}));
const norm=(v:string)=>v.replace(/\s+/g,'').toLowerCase();
const noEnter=(e:React.KeyboardEvent)=>{if(e.key==='Enter')e.preventDefault();};
/** 참여자 iframe 의 document.body.innerText 에 가깝게: 닫힌 dialog·hidden·template·script·style·aria-hidden·display:none 을 뺀 본문 텍스트. */
function visibleText(html:string):string{try{const doc=new DOMParser().parseFromString(html,'text/html');doc.querySelectorAll('dialog:not([open]),[hidden],template,script,style,[aria-hidden="true"]').forEach(n=>n.remove());doc.querySelectorAll<HTMLElement>('[style]').forEach(n=>{if(/display\s*:\s*none/i.test(n.getAttribute('style')||''))n.remove();});return doc.body?.textContent||'';}catch{return htmlToText(html);}}
const small:React.CSSProperties={display:'inline-flex',alignItems:'center',justifyContent:'center',width:28,height:28,border:'1px solid #E5E7EB',borderRadius:8,background:'#fff',color:'#454545',cursor:'pointer'};
const ORANGE='#F18134';

function PickerModal({html,variant,onPick,onClose}:{html:string;variant:Variant;onPick:(path:string,label:string)=>void;onClose:()=>void}){
  const iframe=useRef<HTMLIFrameElement>(null),modeRef=useRef(false);const[pickMode,setPickMode]=useState(false);const[srcDoc]=useState(()=>instrument(html));
  const send=(on:boolean)=>iframe.current?.contentWindow?.postMessage({type:'mindlens-mode',comment:on},'*');
  const setMode=(on:boolean)=>{modeRef.current=on;setPickMode(on);send(on);};
  useEffect(()=>{const receive=(e:MessageEvent)=>{if(e.source!==iframe.current?.contentWindow||e.data?.type!=='mindlens-pick')return;const d=e.data as {componentPath?:string;component?:string};if(!d.componentPath)return;onPick(d.componentPath,String(d.component||'').slice(0,TASK_LIMITS.labelMax));};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);},[onPick]);
  const tab=(on:boolean):React.CSSProperties=>({padding:'6px 14px',borderRadius:999,border:'1px solid '+(pickMode===on?'#00A4DF':'#E5E7EB'),background:pickMode===on?'#00A4DF':'#fff',color:pickMode===on?'#fff':'#454545',fontSize:13,cursor:'pointer'});
  return createPortal(<div className={s.overlay} role="dialog" aria-label={`버전 ${variant} 목표 컴포넌트 선택`} style={{zIndex:1000}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div className={s.modal} style={{maxWidth:960,width:'94vw',display:'flex',flexDirection:'column',height:'88vh'}}>
      <div className={s.modalHead}><div><p className={s.eyebrow}>VERSION {variant}</p><h2>목표 컴포넌트 선택</h2></div><button type="button" className={s.close} aria-label="닫기" onClick={onClose}><X size={16}/></button></div>
      <div style={{display:'flex',alignItems:'center',gap:8,margin:'4px 0 8px'}}>
        <button type="button" style={tab(false)} onClick={()=>setMode(false)}>탐색 모드</button>
        <button type="button" style={tab(true)} onClick={()=>setMode(true)}>선택 모드</button>
        <span className={s.hint} style={{margin:0}}>{pickMode?'과업 완료로 볼 요소를 클릭하세요.':'먼저 프로토타입을 자유롭게 탐색(예: 대화상자 열기)한 뒤 선택 모드로 바꾸세요.'}</span>
      </div>
      <iframe ref={iframe} title={`버전 ${variant} 미리보기`} sandbox="allow-scripts" srcDoc={srcDoc} onLoad={()=>send(modeRef.current)} style={{flex:1,minHeight:0,width:'100%',border:'1px solid #E5E7EB',borderRadius:8,background:'#fff'}}/>
    </div>
  </div>,document.body);
}

export default function TaskEditor({htmlA,htmlB,value,onChange}:{htmlA:string|null;htmlB:string|null;value:TaskDraft[];onChange:(next:TaskDraft[])=>void}){
  const[tabs,setTabs]=useState<Record<number,Variant>>({});const[picking,setPicking]=useState<{key:number;variant:Variant}|null>(null);
  const html={A:htmlA,B:htmlB};
  const patch=(key:number,p:Partial<TaskDraft>)=>onChange(value.map(x=>x.key===key?{...x,...p}:x));
  const setCriteria=(key:number,v:Variant,p:Partial<TaskCriteria>)=>onChange(value.map(x=>x.key===key?{...x,criteria:{...x.criteria,[v]:{...x.criteria[v],...p}}}:x));
  const move=(i:number,d:number)=>{const j=i+d;if(j<0||j>=value.length)return;const n=[...value];[n[i],n[j]]=[n[j],n[i]];onChange(n);};
  const pickedTask=picking?value.find(x=>x.key===picking.key):undefined;
  return <div style={{marginTop:20}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><strong className={s.label}>과업</strong><span className={s.hint}>{value.length} / {TASK_LIMITS.maxTasks}개</span></div>
    <p className={s.hint}>참여자는 자유 탐색 뒤 과업을 순서대로 수행합니다. 시안마다 완료 기준(목표 컴포넌트 또는 목표 문구)을 하나 이상 정해주세요. 둘 다 정하면 하나만 맞아도 성공입니다.</p>
    {value.map((x,i)=>{const v=tabs[x.key]||'A';const c=x.criteria[v];const text=html[v];
      const dup=!!(c.text&&c.text.trim()&&text&&norm(visibleText(text)).indexOf(norm(c.text))>=0);
      const none=!c.componentPath&&!(c.text&&c.text.trim());
      return <div key={x.key} style={{border:'1px solid #E5E7EB',borderRadius:12,padding:12,marginTop:10,background:'#fff'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <span style={{color:'#00A4DF',fontWeight:600,fontSize:13}}>과업 {i+1}</span><span style={{flex:1}}/>
          <button type="button" aria-label={`과업 ${i+1} 위로`} style={small} disabled={i===0} onClick={()=>move(i,-1)}><ArrowUp size={14}/></button>
          <button type="button" aria-label={`과업 ${i+1} 아래로`} style={small} disabled={i===value.length-1} onClick={()=>move(i,1)}><ArrowDown size={14}/></button>
          <button type="button" aria-label={`과업 ${i+1} 삭제`} style={small} onClick={()=>onChange(value.filter(y=>y.key!==x.key))}><Trash2 size={14}/></button>
        </div>
        <textarea aria-label={`과업 ${i+1} 지시문`} className={s.input} rows={2} maxLength={TASK_LIMITS.instructionMax} placeholder="참여자에게 보여줄 지시문 (예: 새 프로젝트를 만들어보세요)" value={x.instruction} onChange={e=>patch(x.key,{instruction:e.target.value})}/>
        <label style={{display:'flex',alignItems:'center',gap:8,marginTop:8,fontSize:13,color:'#454545'}}>제한 시간
          <input aria-label={`과업 ${i+1} 제한 시간(초)`} type="number" min={TASK_LIMITS.timeMin} max={TASK_LIMITS.timeMax} className={s.input} style={{width:90,margin:0}} value={Number.isFinite(x.timeLimitSeconds)?x.timeLimitSeconds:''} onKeyDown={noEnter} onChange={e=>patch(x.key,{timeLimitSeconds:e.target.value===''?NaN:Number(e.target.value)})} onBlur={()=>{const n=x.timeLimitSeconds;patch(x.key,{timeLimitSeconds:Number.isFinite(n)?Math.min(TASK_LIMITS.timeMax,Math.max(TASK_LIMITS.timeMin,Math.round(n))):TASK_LIMITS.timeDefault});}}/>초 ({TASK_LIMITS.timeMin}~{TASK_LIMITS.timeMax})</label>
        <div style={{display:'flex',gap:6,marginTop:10}}>{(['A','B']as const).map(t=>{const set=!!(x.criteria[t].componentPath||(x.criteria[t].text&&x.criteria[t].text!.trim()));return <button key={t} type="button" onClick={()=>setTabs(o=>({...o,[x.key]:t}))} style={{padding:'5px 14px',borderRadius:999,border:'1px solid '+(v===t?'#00A4DF':'#E5E7EB'),background:v===t?'#E6F6FC':'#fff',color:v===t?'#0080b3':'#454545',fontSize:13,fontWeight:600,cursor:'pointer'}}>버전 {t}{set?' ✓':''}</button>})}</div>
        <div style={{marginTop:8,padding:10,borderRadius:8,background:'#F8FAFB'}}>
          <strong style={{fontSize:13}}>목표 컴포넌트</strong>
          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6,flexWrap:'wrap'}}>
            <button type="button" className={s.button} disabled={!text} onClick={()=>setPicking({key:x.key,variant:v})}><MousePointerClick size={14}/>미리보기에서 선택</button>
            {!text&&<span className={s.hint} style={{margin:0}}>먼저 HTML 파일을 선택하세요</span>}
            {c.componentPath&&<><span style={{fontSize:13,color:'#0D0D0D'}}>선택됨: <strong>{c.componentLabel||c.componentPath}</strong></span><button type="button" className={s.button} onClick={()=>setCriteria(x.key,v,{componentPath:undefined,componentLabel:undefined})}>지우기</button></>}
          </div>
          <label style={{display:'block',marginTop:10,fontSize:13,fontWeight:600}} htmlFor={`task-${x.key}-text`}>목표 문구</label>
          <input id={`task-${x.key}-text`} className={s.input} maxLength={TASK_LIMITS.textMax} onKeyDown={noEnter} placeholder="이 문구가 화면에 나타나면 성공 (선택)" value={c.text||''} onChange={e=>setCriteria(x.key,v,{text:e.target.value})}/>
          {dup&&<p role="status" style={{margin:'6px 0 0',fontSize:12,color:ORANGE}}>첫 화면에 이미 있는 문구라 첫 클릭 직후 성공으로 처리될 수 있어요.</p>}
          {none&&<p style={{margin:'6px 0 0',fontSize:12,color:ORANGE}}>버전 {v}의 완료 기준(목표 컴포넌트 또는 목표 문구)을 하나 이상 지정해주세요.</p>}
        </div>
      </div>;})}
    <button type="button" className={s.button} style={{marginTop:10}} disabled={value.length>=TASK_LIMITS.maxTasks} onClick={()=>onChange([...value,newTaskDraft()])}><Plus size={14}/>과업 추가</button>
    {picking&&pickedTask&&html[picking.variant]&&<PickerModal html={html[picking.variant] as string} variant={picking.variant} onClose={()=>setPicking(null)} onPick={(path,label)=>{setCriteria(picking.key,picking.variant,{componentPath:path,componentLabel:label});setPicking(null);}}/>}
  </div>;
}
