'use client';
import {useState} from 'react';
import {Plus,Trash2,ArrowUp,ArrowDown} from 'lucide-react';
import {MAX_CUSTOM_QUESTIONS} from '@/lib/survey-questions';
import s from './workspace.module.css';
type Draft={key:number;type:'choice'|'text';question:string;options:string};
let nextKey=1;
const small:React.CSSProperties={display:'inline-flex',alignItems:'center',justifyContent:'center',width:28,height:28,border:'1px solid #E5E7EB',borderRadius:8,background:'#fff',color:'#454545',cursor:'pointer'};
export default function CustomQuestionsEditor(){
  const[items,setItems]=useState<Draft[]>([]);
  const patch=(key:number,p:Partial<Draft>)=>setItems(a=>a.map(x=>x.key===key?{...x,...p}:x));
  const move=(i:number,d:number)=>setItems(a=>{const j=i+d;if(j<0||j>=a.length)return a;const n=[...a];[n[i],n[j]]=[n[j],n[i]];return n;});
  const serialized=JSON.stringify(items.map(x=>x.type==='choice'?{type:x.type,question:x.question,options:x.options.split('\n').map(o=>o.trim()).filter(Boolean)}:{type:x.type,question:x.question,options:[]}));
  return <div style={{marginTop:20}}>
    <input type="hidden" name="customQuestions" value={serialized}/>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><strong className={s.label}>직접 만든 질문</strong><span className={s.hint}>{items.length} / {MAX_CUSTOM_QUESTIONS}개</span></div>
    <p className={s.hint}>기본 5문항 뒤에 이어서 각 시안의 설문에 함께 표시됩니다. 객관식은 선택지를 한 줄에 하나씩 적어주세요(2~8개).</p>
    {items.map((x,i)=><div key={x.key} style={{border:'1px solid #E5E7EB',borderRadius:12,padding:12,marginTop:10,background:'#fff'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
        <span style={{color:'#00A4DF',fontWeight:600,fontSize:13}}>{String(i+6).padStart(2,'0')}</span>
        <select aria-label={`질문 ${i+1} 유형`} className={s.select} value={x.type} onChange={e=>patch(x.key,{type:e.target.value as Draft['type']})}><option value="choice">객관식</option><option value="text">주관식</option></select>
        <span style={{flex:1}}/>
        <button type="button" aria-label={`질문 ${i+1} 위로`} style={small} disabled={i===0} onClick={()=>move(i,-1)}><ArrowUp size={14}/></button>
        <button type="button" aria-label={`질문 ${i+1} 아래로`} style={small} disabled={i===items.length-1} onClick={()=>move(i,1)}><ArrowDown size={14}/></button>
        <button type="button" aria-label={`질문 ${i+1} 삭제`} style={small} onClick={()=>setItems(a=>a.filter(y=>y.key!==x.key))}><Trash2 size={14}/></button>
      </div>
      <input aria-label={`질문 ${i+1} 내용`} className={s.input} maxLength={200} placeholder="질문을 입력하세요" value={x.question} onChange={e=>patch(x.key,{question:e.target.value})}/>
      {x.type==='choice'&&<textarea aria-label={`질문 ${i+1} 선택지`} className={s.input} rows={3} placeholder={'선택지를 한 줄에 하나씩\n예: 매우 만족\n보통\n불만족'} value={x.options} onChange={e=>patch(x.key,{options:e.target.value})} style={{marginTop:8}}/>}
    </div>)}
    <button type="button" className={s.button} style={{marginTop:10}} disabled={items.length>=MAX_CUSTOM_QUESTIONS} onClick={()=>setItems(a=>[...a,{key:nextKey++,type:'choice',question:'',options:''}])}><Plus size={14}/>질문 추가</button>
  </div>;
}
