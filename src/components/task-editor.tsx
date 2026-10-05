'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Plus,Trash2,ArrowUp,ArrowDown,X,MousePointerClick} from 'lucide-react';
import {instrument} from '@/lib/instrument';
import {TASK_LIMITS} from '@/lib/task-rules';
import type {StateCriterion,StudyTask,TaskCriteria,Variant} from '@/lib/types';
import s from './workspace.module.css';

export type TaskDraft={key:number;instruction:string;timeLimitSeconds:number;criteria:{A:TaskCriteria;B:TaskCriteria}};
let nextKey=1;
export const newTaskDraft=():TaskDraft=>({key:nextKey++,instruction:'',timeLimitSeconds:TASK_LIMITS.timeDefault,criteria:{A:{},B:{}}});
export const tasksToDrafts=(tasks:StudyTask[]|undefined):TaskDraft[]=>(tasks||[]).map(t=>({key:nextKey++,instruction:t.instruction,timeLimitSeconds:t.timeLimitSeconds,criteria:{A:{...t.criteria.A},B:{...t.criteria.B}}}));
export const draftsToPayload=(drafts:TaskDraft[])=>drafts.map(d=>({instruction:d.instruction,timeLimitSeconds:d.timeLimitSeconds,criteria:d.criteria}));
const noEnter=(e:React.KeyboardEvent)=>{if(e.key==='Enter')e.preventDefault();};
const small:React.CSSProperties={display:'inline-flex',alignItems:'center',justifyContent:'center',width:28,height:28,border:'1px solid #E5E7EB',borderRadius:8,background:'#fff',color:'#454545',cursor:'pointer'};
const ORANGE='#F18134';
const norm=(v:string)=>v.replace(/\s+/g,'').toLowerCase();

/** 미리보기에서 고른 요소의 현재 속성 값들(상태 기준 후보). 저장되지 않고 설정 화면에서만 쓴다. */
export type StateProps={text:string;value?:string;checked?:string;attrs:Record<string,string>};
export type PickedState={state:StateCriterion;props:StateProps};
type PickMsg={componentPath?:string;component?:string;stateTarget?:{anchor?:string;path:string;label:string;props:StateProps}};
type Option={property:StateCriterion['property'];attr?:string;title:string;current:string};
const optionsOf=(p:StateProps):Option[]=>{const o:Option[]=[{property:'text',title:'텍스트',current:p.text}];if(p.value!==undefined)o.push({property:'value',title:'값',current:p.value});if(p.checked!==undefined)o.push({property:'checked',title:'체크',current:p.checked});for(const[k,v]of Object.entries(p.attrs))if(k!=='value')o.push({property:'attr',attr:k,title:`속성 ${k}`,current:v});return o;};
const currentOf=(p:StateProps|undefined,st:StateCriterion):string|undefined=>{if(!p)return undefined;if(st.property==='text')return p.text;if(st.property==='value')return p.value;if(st.property==='checked')return p.checked;return st.attr?p.attrs[st.attr]:undefined;};
export const stateSummary=(st:StateCriterion)=>`${st.label||st.path||'요소'} · ${st.property==='attr'?st.attr:st.property==='text'?'텍스트':st.property==='value'?'값':'체크'} ${st.match==='contains'?'포함':'='} '${st.expected}'`;

function PickerModal({html,variant,mode,onPick,onClose}:{html:string;variant:Variant;mode:'component'|'state';onPick:(msg:PickMsg)=>void;onClose:()=>void}){
  const iframe=useRef<HTMLIFrameElement>(null),modeRef=useRef(false);const[pickMode,setPickMode]=useState(false);const[srcDoc]=useState(()=>instrument(html));
  const send=(on:boolean)=>iframe.current?.contentWindow?.postMessage({type:'mindlens-mode',comment:on},'*');
  const setMode=(on:boolean)=>{modeRef.current=on;setPickMode(on);send(on);};
  const title=mode==='state'?'목표 상태 선택':'목표 컴포넌트 선택';
  useEffect(()=>{const receive=(e:MessageEvent)=>{if(e.source!==iframe.current?.contentWindow||e.data?.type!=='mindlens-pick')return;const d=e.data as PickMsg;if(mode==='state'?!d.stateTarget:!d.componentPath)return;onPick(d);};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);},[onPick,mode]);
  const tab=(on:boolean):React.CSSProperties=>({padding:'6px 14px',borderRadius:999,border:'1px solid '+(pickMode===on?'#00A4DF':'#E5E7EB'),background:pickMode===on?'#00A4DF':'#fff',color:pickMode===on?'#fff':'#454545',fontSize:13,cursor:'pointer'});
  return createPortal(<div className={s.overlay} role="dialog" aria-label={`버전 ${variant} ${title}`} style={{zIndex:1000}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div className={s.modal} style={{maxWidth:960,width:'94vw',display:'flex',flexDirection:'column',height:'88vh'}}>
      <div className={s.modalHead}><div><p className={s.eyebrow}>VERSION {variant}</p><h2>{title}</h2></div><button type="button" className={s.close} aria-label="닫기" onClick={onClose}><X size={16}/></button></div>
      <div style={{display:'flex',alignItems:'center',gap:8,margin:'4px 0 8px'}}>
        <button type="button" style={tab(false)} onClick={()=>setMode(false)}>탐색 모드</button>
        <button type="button" style={tab(true)} onClick={()=>setMode(true)}>선택 모드</button>
        <span className={s.hint} style={{margin:0}}>{pickMode?(mode==='state'?'값이 바뀔 요소(예: 상태 표시)를 클릭하세요.':'과업 완료로 볼 요소를 클릭하세요.'):'먼저 프로토타입을 자유롭게 탐색(예: 목록에서 항목 열기)한 뒤 선택 모드로 바꾸세요.'}</span>
      </div>
      <iframe ref={iframe} title={`버전 ${variant} 미리보기`} sandbox="allow-scripts" srcDoc={srcDoc} onLoad={()=>send(modeRef.current)} style={{flex:1,minHeight:0,width:'100%',border:'1px solid #E5E7EB',borderRadius:8,background:'#fff'}}/>
    </div>
  </div>,document.body);
}

export default function TaskEditor({htmlA,htmlB,value,onChange}:{htmlA:string|null;htmlB:string|null;value:TaskDraft[];onChange:(next:TaskDraft[])=>void}){
  const[tabs,setTabs]=useState<Record<number,Variant>>({});const[picking,setPicking]=useState<{key:number;variant:Variant;mode:'component'|'state'}|null>(null);const[infos,setInfos]=useState<Record<string,StateProps>>({});
  const html={A:htmlA,B:htmlB};
  const patch=(key:number,p:Partial<TaskDraft>)=>onChange(value.map(x=>x.key===key?{...x,...p}:x));
  const setCriteria=(key:number,v:Variant,p:Partial<TaskCriteria>)=>onChange(value.map(x=>x.key===key?{...x,criteria:{...x.criteria,[v]:{...x.criteria[v],...p}}}:x));
  const patchState=(key:number,v:Variant,cur:StateCriterion,p:Partial<StateCriterion>)=>{const next:StateCriterion={...cur,...p};if(next.property!=='attr')delete next.attr;setCriteria(key,v,{state:next});};
  const move=(i:number,d:number)=>{const j=i+d;if(j<0||j>=value.length)return;const n=[...value];[n[i],n[j]]=[n[j],n[i]];onChange(n);};
  const pickedTask=picking?value.find(x=>x.key===picking.key):undefined;
  return <div style={{marginTop:20}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><strong className={s.label}>과업</strong><span className={s.hint}>{value.length} / {TASK_LIMITS.maxTasks}개</span></div>
    <p className={s.hint}>참여자는 자유 탐색 뒤 과업을 순서대로 수행합니다. 시안마다 완료 기준(목표 컴포넌트 또는 목표 상태)을 하나 이상 정해주세요. 둘 다 정하면 하나만 맞아도 성공입니다. 목표 상태는 특정 요소의 값이 원하는 값으로 바뀌는 것입니다(예: 프로젝트 상태가 &lsquo;주의&rsquo;가 됨).</p>
    {value.map((x,i)=>{const v=tabs[x.key]||'A';const c=x.criteria[v];const text=html[v];const st=c.state;const info=infos[`${x.key}:${v}`];
      const stReady=!!(st&&st.expected.trim());const none=!c.componentPath&&!stReady;
      const cur=st?currentOf(info,st):undefined;const same=!!(st&&stReady&&cur!==undefined&&(st.match==='contains'?norm(cur).indexOf(norm(st.expected))>=0:norm(cur)===norm(st.expected)));
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
        <div style={{display:'flex',gap:6,marginTop:10}}>{(['A','B']as const).map(t=>{const set=!!(x.criteria[t].componentPath||(x.criteria[t].state&&x.criteria[t].state!.expected.trim()));return <button key={t} type="button" onClick={()=>setTabs(o=>({...o,[x.key]:t}))} style={{padding:'5px 14px',borderRadius:999,border:'1px solid '+(v===t?'#00A4DF':'#E5E7EB'),background:v===t?'#E6F6FC':'#fff',color:v===t?'#0080b3':'#454545',fontSize:13,fontWeight:600,cursor:'pointer'}}>버전 {t}{set?' ✓':''}</button>})}</div>
        <div style={{marginTop:8,padding:10,borderRadius:8,background:'#F8FAFB'}}>
          <strong style={{fontSize:13}}>목표 컴포넌트</strong>
          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6,flexWrap:'wrap'}}>
            <button type="button" className={s.button} disabled={!text} onClick={()=>setPicking({key:x.key,variant:v,mode:'component'})}><MousePointerClick size={14}/>미리보기에서 선택</button>
            {!text&&<span className={s.hint} style={{margin:0}}>먼저 HTML 파일을 선택하세요</span>}
            {c.componentPath&&<><span style={{fontSize:13,color:'#0D0D0D'}}>선택됨: <strong>{c.componentLabel||c.componentPath}</strong></span><button type="button" className={s.button} onClick={()=>setCriteria(x.key,v,{componentPath:undefined,componentLabel:undefined})}>지우기</button></>}
          </div>
          <strong style={{fontSize:13,display:'block',marginTop:12}}>목표 상태</strong>
          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6,flexWrap:'wrap'}}>
            <button type="button" className={s.button} disabled={!text} onClick={()=>setPicking({key:x.key,variant:v,mode:'state'})}><MousePointerClick size={14}/>미리보기에서 상태 요소 선택</button>
            {st&&<><span style={{fontSize:13,color:'#0D0D0D'}}>선택됨: <strong>{st.label||st.path||'요소'}</strong></span><button type="button" className={s.button} onClick={()=>{setCriteria(x.key,v,{state:undefined});setInfos(o=>{const n={...o};delete n[`${x.key}:${v}`];return n;});}}>지우기</button></>}
          </div>
          {st&&<div role="group" aria-label="목표 상태 설정" style={{marginTop:8}}>
            {info?<fieldset style={{border:0,padding:0,margin:0}}><legend className={s.hint} style={{margin:'0 0 4px'}}>읽을 값을 고르세요</legend>{optionsOf(info).map(o=>{const on=st.property===o.property&&(o.property!=='attr'||st.attr===o.attr);return <label key={o.title} style={{display:'flex',gap:8,alignItems:'baseline',fontSize:13,padding:'2px 0'}}><input type="radio" name={`state-prop-${x.key}-${v}`} checked={on} onChange={()=>patchState(x.key,v,st,{property:o.property,attr:o.attr})}/><span>{o.title}</span><code style={{color:'#454545',overflowWrap:'anywhere'}}>&lsquo;{o.current}&rsquo;</code></label>;})}</fieldset>:<p className={s.hint} style={{margin:0}}>읽는 값: <strong>{st.property==='attr'?`속성 ${st.attr}`:st.property==='text'?'텍스트':st.property==='value'?'값':'체크'}</strong> (다른 값으로 바꾸려면 요소를 다시 선택하세요)</p>}
            <div style={{display:'flex',alignItems:'center',gap:8,marginTop:8,flexWrap:'wrap'}}>
              <label htmlFor={`task-${x.key}-${v}-expected`} style={{fontSize:13,fontWeight:600}}>목표 값</label>
              <input id={`task-${x.key}-${v}-expected`} className={s.input} style={{width:200,margin:0}} maxLength={TASK_LIMITS.expectedMax} onKeyDown={noEnter} placeholder="예: 주의" value={st.expected} onChange={e=>patchState(x.key,v,st,{expected:e.target.value})}/>
              <select aria-label="일치 방식" className={s.input} style={{width:90,margin:0}} value={st.match} onChange={e=>patchState(x.key,v,st,{match:e.target.value==='contains'?'contains':'equals'})}><option value="equals">일치</option><option value="contains">포함</option></select>
              {cur!==undefined&&<span className={s.hint} style={{margin:0}}>지금 값: &lsquo;{cur}&rsquo;</span>}
            </div>
            {same&&<p role="status" style={{margin:'6px 0 0',fontSize:12,color:ORANGE}}>지금 값과 같아서 첫 동작 직후 성공으로 처리될 수 있어요.</p>}
            {!stReady&&<p style={{margin:'6px 0 0',fontSize:12,color:ORANGE}}>목표 값을 입력해주세요.</p>}
          </div>}
          {none&&<p style={{margin:'6px 0 0',fontSize:12,color:ORANGE}}>버전 {v}의 완료 기준(목표 컴포넌트 또는 목표 상태)을 하나 이상 지정해주세요.</p>}
        </div>
      </div>;})}
    <button type="button" className={s.button} style={{marginTop:10}} disabled={value.length>=TASK_LIMITS.maxTasks} onClick={()=>onChange([...value,newTaskDraft()])}><Plus size={14}/>과업 추가</button>
    {picking&&pickedTask&&html[picking.variant]&&<PickerModal html={html[picking.variant] as string} variant={picking.variant} mode={picking.mode} onClose={()=>setPicking(null)} onPick={(d)=>{if(picking.mode==='state'&&d.stateTarget){const t=d.stateTarget;setCriteria(picking.key,picking.variant,{state:{...(t.anchor?{anchor:t.anchor}:{}),path:t.path,property:'text',expected:'',match:'equals',...(t.label?{label:t.label}:{})}});setInfos(o=>({...o,[`${picking.key}:${picking.variant}`]:t.props}));}else if(d.componentPath)setCriteria(picking.key,picking.variant,{componentPath:d.componentPath,componentLabel:String(d.component||'').slice(0,TASK_LIMITS.labelMax)});setPicking(null);}}/>}
  </div>;
}
