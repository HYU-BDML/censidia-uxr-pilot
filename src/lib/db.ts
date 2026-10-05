import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { screenId } from './screen-hash';
import { SURVEY_QUESTIONS, type Study, type Session, type SessionDetail, type StudyResults, type Variant, type ClickEvent, type StoredAnswer, type InterviewTurn, type Recording, type SurveyAnswer, type ParticipantComment, type TaskAttempt } from './types';

const dataDir = path.resolve(/* turbopackIgnore: true */ process.env.MINDLENS_DATA_DIR || path.join(process.cwd(), 'data'));
export const recordingDir = path.join(dataDir, 'recordings');
let singleton: DatabaseSync | undefined;
export function db() {
  if (!singleton) {
    mkdirSync(recordingDir, {recursive:true});
    singleton = new DatabaseSync(path.join(dataDir, 'mindlens.sqlite'));
    singleton.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS studies (id TEXT PRIMARY KEY, owner TEXT NOT NULL, payload TEXT NOT NULL, htmlA TEXT NOT NULL, htmlB TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, studyId TEXT NOT NULL REFERENCES studies(id), payload TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS sessions_study ON sessions(studyId);
      CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, sessionId TEXT NOT NULL REFERENCES sessions(id), payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS answers (id INTEGER PRIMARY KEY AUTOINCREMENT, sessionId TEXT NOT NULL REFERENCES sessions(id), variant TEXT NOT NULL, questionId TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(sessionId,variant,questionId));
      CREATE TABLE IF NOT EXISTS turns (id INTEGER PRIMARY KEY AUTOINCREMENT, sessionId TEXT NOT NULL REFERENCES sessions(id), payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS recordings (id TEXT PRIMARY KEY, sessionId TEXT NOT NULL REFERENCES sessions(id), payload TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS events_session ON events(sessionId);
      CREATE INDEX IF NOT EXISTS turns_session ON turns(sessionId);
      CREATE TABLE IF NOT EXISTS screens (id TEXT PRIMARY KEY, studyId TEXT NOT NULL REFERENCES studies(id), variant TEXT NOT NULL, hash TEXT NOT NULL, html TEXT NOT NULL, createdAt TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS screens_study ON screens(studyId, variant);
      CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, sessionId TEXT NOT NULL REFERENCES sessions(id), payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS task_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, sessionId TEXT NOT NULL REFERENCES sessions(id), taskId TEXT NOT NULL, variant TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(sessionId,taskId,variant));
      CREATE INDEX IF NOT EXISTS comments_session ON comments(sessionId);`);
  }
  return singleton;
}
export function transaction<T>(fn:()=>T):T {const d=db();d.exec('BEGIN IMMEDIATE');try {const value=fn();d.exec('COMMIT');return value;}catch(e){d.exec('ROLLBACK');throw e;}}
type Row = {payload:string;id:string|number};
function parse<T>(row:unknown):T|undefined {return row ? JSON.parse((row as Row).payload) as T : undefined;}
function list<T>(table:'sessions'|'events'|'answers'|'turns'|'recordings'|'comments'|'task_attempts',sessionIds:string[]):T[] {
  if(!sessionIds.length)return [];
  return db().prepare(`SELECT id,payload FROM ${table} WHERE ${table==='sessions'?'id':'sessionId'} IN (${sessionIds.map(()=>'?').join(',')}) ORDER BY rowid`).all(...sessionIds).map(r=>({...JSON.parse((r as Row).payload),id:(r as Row).id})) as T[];
}
export class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
export function required<T>(value:T|undefined|null,message='데이터를 찾을 수 없습니다.'):T {if(value==null)throw new HttpError(404,message);return value;}
export function getStudy(id:string):Study {return required(parse<Study>(db().prepare('SELECT payload FROM studies WHERE id=?').get(id)));}
export function getStudyHtml(id:string,variant:Variant):string {const row=required(db().prepare(`SELECT ${variant==='A'?'htmlA':'htmlB'} AS html FROM studies WHERE id=?`).get(id));return row.html as string;}
export function allStudies(owner:string):Study[] {return db().prepare('SELECT payload FROM studies WHERE owner=? ORDER BY rowid DESC').all(owner).map(row=>{const study=parse<Study>(row)!;const sessions=studySessions(study.id);return {...study,sessionCount:sessions.length,completedCount:sessions.filter(s=>s.status==='completed').length};});}
export function createStudy(input:Omit<Study,'id'|'createdAt'>,htmlA:string,htmlB:string):Study {const study:Study={...input,id:randomUUID(),createdAt:new Date().toISOString()};db().prepare('INSERT INTO studies VALUES (?,?,?,?,?)').run(study.id,study.owner,JSON.stringify(study),htmlA,htmlB);return study;}
export function studySessions(studyId:string):Session[] {return db().prepare('SELECT payload FROM sessions WHERE studyId=? ORDER BY rowid DESC').all(studyId).map(r=>parse<Session>(r)!);}
export function getSession(id:string):Session {return required(parse<Session>(db().prepare('SELECT payload FROM sessions WHERE id=?').get(id)));}
export function saveSession(s:Session):Session {db().prepare('UPDATE sessions SET payload=? WHERE id=?').run(JSON.stringify(s),s.id);return s;}
export function createSession(studyId:string,name:string):Session {return transaction(()=>{const study=getStudy(studyId);const order:Variant[]=studySessions(studyId).length%2?['B','A']:['A','B'];const session:Session={id:randomUUID(),studyId,name,status:'active',currentVariant:order[0],order,startedAt:new Date().toISOString(),completedAt:null,elapsedA:0,elapsedB:0,preference:null,preferenceReason:'',isDemo:false};db().prepare('INSERT INTO sessions VALUES (?,?,?)').run(session.id,studyId,JSON.stringify(session));return session;});}
export function detail(id:string):SessionDetail {const session=getSession(id);return {session,study:getStudy(session.studyId),events:list<ClickEvent>('events',[id]),answers:list<StoredAnswer>('answers',[id]),interviewTurns:list<InterviewTurn>('turns',[id]),recordings:list<Recording>('recordings',[id]),taskAttempts:list<TaskAttempt>('task_attempts',[id])};}
export function results(id:string):StudyResults {const study=getStudy(id),sessions=studySessions(id),ids=sessions.map(s=>s.id),events=list<ClickEvent>('events',ids);const completed=sessions.filter(s=>s.status==='completed');return {study,sessions,events,answers:list<StoredAnswer>('answers',ids),interviewTurns:list<InterviewTurn>('turns',ids),recordings:list<Recording>('recordings',ids),comments:list<ParticipantComment>('comments',ids),taskAttempts:list<TaskAttempt>('task_attempts',ids),summary:{total:sessions.length,completed:completed.length,preferenceA:completed.filter(s=>s.preference==='A').length,preferenceB:completed.filter(s=>s.preference==='B').length,preferenceTie:completed.filter(s=>s.preference==='tie').length,totalClicks:events.length,avgDurationSeconds:completed.length?Math.round(completed.reduce((a,s)=>a+s.elapsedA+s.elapsedB,0)/completed.length):0}};}
export function addEvents(sessionId:string,events:ClickEvent[]) {return transaction(()=>{const statement=db().prepare('INSERT INTO events(sessionId,payload) VALUES (?,?)');for(const event of events)statement.run(sessionId,JSON.stringify({...event,sessionId,createdAt:new Date().toISOString()}));return events.length;});}
export function saveAnswers(sessionId:string,variant:Variant,answers:SurveyAnswer[]) {return transaction(()=>{for(const answer of answers)db().prepare('INSERT INTO answers(sessionId,variant,questionId,payload) VALUES (?,?,?,?) ON CONFLICT(sessionId,variant,questionId) DO UPDATE SET payload=excluded.payload').run(sessionId,variant,answer.questionId,JSON.stringify({...answer,sessionId,variant,createdAt:new Date().toISOString()}));return answers.length;});}
export function addTurn(sessionId:string,variant:Variant,role:'user'|'assistant',text:string,elapsedSeconds:number,mode:'ai'|'demo') {const turn={sessionId,variant,role,text,elapsedSeconds,mode,createdAt:new Date().toISOString()};const insert=db().prepare('INSERT INTO turns(sessionId,payload) VALUES (?,?)').run(sessionId,JSON.stringify(turn));return {...turn,id:Number(insert.lastInsertRowid)};}
export async function addRecording(sessionId:string,variant:Variant,file:File,durationSeconds:number):Promise<Recording>{const recording:Recording={id:randomUUID(),sessionId,variant,mimeType:file.type||'audio/webm',durationSeconds,createdAt:new Date().toISOString()};writeFileSync(path.join(recordingDir,recording.id),Buffer.from(await file.arrayBuffer()));db().prepare('INSERT INTO recordings VALUES (?,?,?)').run(recording.id,sessionId,JSON.stringify(recording));return recording;}
export function saveScreen(studyId:string,variant:Variant,hash:string,html:string):{id:string;created:boolean}{const id=screenId(studyId,variant,hash);const result=db().prepare('INSERT INTO screens(id,studyId,variant,hash,html,createdAt) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').run(id,studyId,variant,hash,html,new Date().toISOString());return {id,created:Number(result.changes)>0};}
export function countScreens(studyId:string,variant:Variant):number{return Number((db().prepare('SELECT COUNT(*) AS n FROM screens WHERE studyId=? AND variant=?').get(studyId,variant) as {n:number}).n);}
export function screenExists(id:string):boolean{return !!db().prepare('SELECT 1 FROM screens WHERE id=?').get(id);}
export function getScreenHtml(id:string):string{return (required(db().prepare('SELECT html FROM screens WHERE id=?').get(id),'화면을 찾을 수 없습니다.') as {html:string}).html;}
export function getRecording(id:string){return required(parse<Recording>(db().prepare('SELECT payload FROM recordings WHERE id=?').get(id)));}
export function readRecording(id:string){const recording=getRecording(id);return {recording,bytes:readFileSync(path.join(recordingDir,recording.id))};}
// 같은 의뢰자가 「샘플 연구로 둘러보기」를 다시 눌러도 샘플 연구가 쌓이지 않게, 이미 있으면 그걸 돌려준다.
export function seedDemo(owner:string,durationSeconds:number):{study:Study;created:boolean} {
 const existing=db().prepare('SELECT payload FROM studies WHERE owner=? ORDER BY rowid DESC').all(owner).map(r=>parse<Study>(r)!).find(s=>s.isDemo);
 if(existing)return {study:existing,created:false};
 const study=createStudy({owner,title:'프로젝트 대시보드 사용 경험 비교',description:'프로젝트 상태와 마감일을 확인하는 두 가지 대시보드. 목록 중심 시안과 상태별 보드 시안의 탐색 흐름을 비교합니다.',durationSeconds,isDemo:true,variantAName:'variant-a.html',variantBName:'variant-b.html'},readFileSync(path.join(process.cwd(),'public/demo/variant-a.html'),'utf8'),readFileSync(path.join(process.cwd(),'public/demo/variant-b.html'),'utf8'));
 return {study,created:true};
}
export function addComments(sessionId:string,comments:ParticipantComment[]) {return transaction(()=>{const statement=db().prepare('INSERT INTO comments(sessionId,payload) VALUES (?,?)');for(const c of comments)statement.run(sessionId,JSON.stringify({...c,sessionId,createdAt:new Date().toISOString()}));return comments.length;});}
// 과업 시도 저장 — (세션, 과업, 시안) 당 1행. 같은 시도를 다시 보내면 덮지 않고 무시한다(재전송 멱등).
export function addTaskAttempts(sessionId:string,attempts:TaskAttempt[]):number {return transaction(()=>{const statement=db().prepare('INSERT INTO task_attempts(sessionId,taskId,variant,payload) VALUES (?,?,?,?) ON CONFLICT(sessionId,taskId,variant) DO NOTHING');let saved=0;for(const a of attempts)saved+=Number(statement.run(sessionId,a.taskId,a.variant,JSON.stringify({...a,sessionId,createdAt:new Date().toISOString()})).changes);return saved;});}
export function updateStudy(study:Study):Study {db().prepare('UPDATE studies SET payload=? WHERE id=?').run(JSON.stringify(study),study.id);return study;}
