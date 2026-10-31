import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getUser } from '@netlify/identity';
import { getStore } from '@netlify/blobs';
import { and, eq, inArray, desc } from 'drizzle-orm';
import { database } from '../db';
import * as s from '../db/schema';
import { ROLE_NAMES, DOC_CATEGORIES } from '../src/types';
import { advisory, weightedScore, validateTransition } from './workflow';
import { samplePdf } from './pdf';
import type { Context } from '@netlify/functions';
class ApiError extends Error { constructor(public status:number,message:string){super(message);} }
function fail(status:number,message:string):never {throw new ApiError(status,message);}
const uid=()=>randomUUID();
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
const required=(v:unknown,name:string,max=200)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail(422,`${name} is required (maximum ${max} characters).`);return (v as string).trim();};
const number=(v:unknown,name:string,min:number,max:number)=>{const n=Number(v);if(!Number.isInteger(n)||n<min||n>max)fail(422,`${name} must be between ${min} and ${max}.`);return n;};
function cookie(req:Request,name:string){return req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);}
async function actor(req:Request) {
 const db=database();
 const identity=await getUser();
 if(identity){
  const [existing]=await db.select().from(s.users).where(eq(s.users.identityId,identity.id));
  if(existing){if(!existing.active)fail(403,'This account is deactivated.');if(identity.roles?.includes('admin')&&existing.roleId!=='admin'){const [promoted]=await db.update(s.users).set({roleId:'admin'}).where(eq(s.users.id,existing.id)).returning();return promoted;}return existing;}
  const id=uid(),workspace='live';
  // Only trusted app metadata can grant officer privileges; user metadata cannot.
  const raw=identity as unknown as {appMetadata?:{roles?:string[]}};
  const roleId=(identity.roles||raw.appMetadata?.roles)?.find(r=>Object.keys(ROLE_NAMES).includes(r))||'institution';
  const [user]=await db.insert(s.users).values({id,workspace,identityId:identity.id,name:identity.name||'Institution administrator',email:identity.email||'',roleId}).onConflictDoNothing().returning();
  return user||(await db.select().from(s.users).where(eq(s.users.identityId,identity.id)))[0];
 }
 const token=cookie(req,'approval360_demo');
 if(token){const [session]=await db.select().from(s.sessions).where(eq(s.sessions.id,hash(token)));if(session&&session.expiresAt>new Date()){const [user]=await db.select().from(s.users).where(eq(s.users.id,session.userId));if(user?.active)return user;}}
 return null;
}
type Actor=NonNullable<Awaited<ReturnType<typeof actor>>>;
async function authorize(req:Request,roles?:string[]){const user=await actor(req);if(!user)fail(401,'Sign in or choose a demonstration role to continue.');if(roles&&!roles.includes(user!.roleId))fail(403,'Your role cannot perform this operation.');return user!;}
async function audit(tx:any,user:Actor,action:string,entityId:string,details:string){await tx.insert(s.audits).values({id:uid(),workspace:user.workspace,userId:user.id,action,entityId,details});}
async function scopedApplication(id:string,user:Actor){const db=database();const [app]=await db.select().from(s.applications).where(and(eq(s.applications.id,id),eq(s.applications.workspace,user.workspace)));if(!app)fail(404,'Application not found.');if(user.roleId==='institution'){const [inst]=await db.select().from(s.institutions).where(eq(s.institutions.id,app!.institutionId));if(inst?.ownerId!==user.id)fail(403,'This institution belongs to another administrator.');}return app!;}
async function getConfig(workspace:string){const [row]=await database().select().from(s.settings).where(eq(s.settings.id,workspace));return row?.value||{slaDays:30,warningDays:7,complianceThreshold:75};}
export async function handle(req:Request,context:Context):Promise<Response>{
 try {
 const origin=req.headers.get('origin');
 if(!['GET','HEAD','OPTIONS'].includes(req.method)&&origin&&origin!==new URL(req.url).origin&&origin!==Netlify.env.get('FRONTEND_ORIGIN'))fail(403,'Request origin is not permitted.');
 const path=new URL(req.url).pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean), method=req.method,db=database();
 if(method==='POST'&&path.join('/')==='session/demo'){
  const body=await req.json(),role=required(body.role,'Role');if(!ROLE_NAMES[role])fail(422,'Unknown role.');
  const [user]=await db.select().from(s.users).where(eq(s.users.id,`demo-${role}`));if(!user)fail(503,'Demo data is not initialized yet. Wait for deployment migrations to finish.');
  const token=randomBytes(32).toString('hex');await db.insert(s.sessions).values({id:hash(token),userId:user.id,expiresAt:new Date(Date.now()+8*3600000)});
  context.cookies.set({name:'approval360_demo',value:token,httpOnly:true,secure:new URL(req.url).protocol==='https:',sameSite:'Lax',path:'/',maxAge:28800});
  return Response.json({user});
 }
 if(method==='POST'&&path.join('/')==='session/logout'){const token=cookie(req,'approval360_demo');if(token)await db.delete(s.sessions).where(eq(s.sessions.id,hash(token)));context.cookies.delete({name:'approval360_demo',path:'/'});return Response.json({ok:true});}
 if(method==='GET'&&path[0]==='bootstrap'){
  const user=await actor(req),workspace=user?.workspace||'demo';
  const allInst=await db.select().from(s.institutions).where(eq(s.institutions.workspace,workspace));
  const institutions=user?.roleId==='institution'?allInst.filter(i=>i.ownerId===user.id):allInst;
  const ids=institutions.map(i=>i.id);
  const applications=ids.length?await db.select().from(s.applications).where(and(eq(s.applications.workspace,workspace),inArray(s.applications.institutionId,ids))).orderBy(desc(s.applications.createdAt)):[];
  const appIds=applications.map(a=>a.id);
  const [documents,compliance,requirements,notices,reads,history,bureaus,settings,users,escalations,audits]=await Promise.all([
   appIds.length?db.select({id:s.documents.id,applicationId:s.documents.applicationId,category:s.documents.category,name:s.documents.name,size:s.documents.size,status:s.documents.status,comment:s.documents.comment,synthetic:s.documents.synthetic,uploadedAt:s.documents.uploadedAt}).from(s.documents).where(inArray(s.documents.applicationId,appIds)):[],
   ids.length?db.select().from(s.compliance).where(inArray(s.compliance.institutionId,ids)):[],db.select().from(s.requirements),
   db.select().from(s.notifications).where(eq(s.notifications.workspace,workspace)).orderBy(desc(s.notifications.createdAt)),
   user?db.select().from(s.notificationReads).where(eq(s.notificationReads.userId,user.id)):[],
   appIds.length?db.select().from(s.history).where(inArray(s.history.applicationId,appIds)).orderBy(desc(s.history.createdAt)):[],
   db.select().from(s.bureaus).where(eq(s.bureaus.workspace,workspace)),getConfig(workspace),
   user?.roleId==='admin'?db.select().from(s.users).where(eq(s.users.workspace,workspace)):user?[user]:[],
   appIds.length?db.select().from(s.escalations).where(inArray(s.escalations.applicationId,appIds)):[],
   (!user||user.roleId!=='institution')?db.select().from(s.audits).where(eq(s.audits.workspace,workspace)).orderBy(desc(s.audits.createdAt)).limit(100):user?db.select().from(s.audits).where(and(eq(s.audits.workspace,workspace),eq(s.audits.userId,user.id))).orderBy(desc(s.audits.createdAt)).limit(100):[]
  ]);
  const visibleNotices=notices.filter(n=>(!n.applicationId||appIds.includes(n.applicationId))&&(!n.institutionId||ids.includes(n.institutionId)));
  return Response.json({user,institutions,applications,documents,compliance,requirements,notifications:visibleNotices.map(n=>({...n,read:reads.some(r=>r.notificationId===n.id)})),history,bureaus,settings,users,escalations,audits,demo:workspace==='demo'});
 }
 if(method==='POST'&&path[0]==='institutions'){
  const user=await authorize(req,['institution','admin']),body=await req.json();
  const name=required(body.name,'Institution name'),code=required(body.code,'Institution code',40).toUpperCase(),email=required(body.email,'Email');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(422,'Enter a valid institutional email.');
  const institution={id:uid(),workspace:user.workspace,ownerId:user.id,name,code,email,state:required(body.state,'State'),city:required(body.city,'City'),type:required(body.type,'Institution type'),established:number(body.established,'Year established',1850,new Date().getFullYear())};
  await db.transaction(async tx=>{await tx.insert(s.institutions).values(institution);const requirements=await tx.select().from(s.requirements);if(requirements.length)await tx.insert(s.compliance).values(requirements.map(r=>({id:uid(),institutionId:institution.id,requirementId:r.id,score:0,notes:'Awaiting officer verification.'})));await audit(tx,user,'Institution registered',institution.id,name);});
  return Response.json(institution,{status:201});
 }
 if(method==='POST'&&path[0]==='applications'&&path.length===1){
  const user=await authorize(req,['institution']),body=await req.json(),institutionId=required(body.institutionId,'Institution');
  const [institution]=await db.select().from(s.institutions).where(and(eq(s.institutions.id,institutionId),eq(s.institutions.workspace,user.workspace)));if(!institution||institution.ownerId!==user.id)fail(403,'Choose an institution that you administer.');
  const cfg=await getConfig(user.workspace),id=`APP-2026-${uid().slice(0,8).toUpperCase()}`;
  const app={id,workspace:user.workspace,institutionId,type:required(body.type,'Application type'),program:required(body.program,'Program'),intake:number(body.intake,'Student intake',1,5000),deadline:new Date(Date.now()+cfg.slaDays*86400000),status:'Draft'};
  await db.transaction(async tx=>{await tx.insert(s.applications).values(app);await audit(tx,user,'Application created',id,app.type);});return Response.json(app,{status:201});
 }
 if(method==='POST'&&path[0]==='applications'&&path[2]==='transition'){
  const user=await authorize(req),app=await scopedApplication(path[1],user),body=await req.json(),to=required(body.status,'Status'),comment=required(body.comment,'Review comment',2000);
  await db.transaction(async tx=>{
   const [current]=await tx.select().from(s.applications).where(eq(s.applications.id,app.id)).for('update');
   if(!current||current.version!==app.version)fail(409,'The application changed. Refresh and try again.');
   const [docs,records,requirements,cfg]=await Promise.all([tx.select().from(s.documents).where(eq(s.documents.applicationId,app.id)),tx.select().from(s.compliance).where(eq(s.compliance.institutionId,app.institutionId)),tx.select().from(s.requirements),getConfig(user.workspace)]);
   const score=weightedScore(records,requirements),error=validateTransition(current.status,to,user.roleId,docs.filter(d=>d.status!=='Rejected').map(d=>d.category),score,cfg.complianceThreshold);if(error)fail(422,error);
   if(['Under Bureau Review','Pending Final Approval','Approved'].includes(to)&&DOC_CATEGORIES.some(c=>!docs.some(d=>d.category===c&&d.status==='Verified')))fail(422,'All required documents must be verified before progressing.');
   const updated=await tx.update(s.applications).set({status:to,updatedAt:new Date(),version:app.version+1}).where(and(eq(s.applications.id,app.id),eq(s.applications.version,app.version))).returning();if(!updated.length)fail(409,'The application changed. Refresh and try again.');
   await tx.insert(s.history).values({id:uid(),applicationId:app.id,userId:user.id,fromStatus:app.status,toStatus:to,comment});
   await tx.insert(s.notifications).values({id:uid(),workspace:user.workspace,applicationId:app.id,title:`Application ${to.toLowerCase()}`,message:`${app.id}: ${comment}`,priority:to==='Clarification Required'||to==='Rejected'?'High':'Normal'});
   await audit(tx,user,`Status changed: ${to}`,app.id,comment);
  });return Response.json({ok:true});
 }
 if(path[0]==='applications'&&path[2]==='documents'&&method==='POST'){
  const user=await authorize(req,['institution']),app=await scopedApplication(path[1],user);if(!['Draft','Clarification Required'].includes(app.status))fail(422,'Documents can only be changed in draft or clarification.');
  const form=await req.formData(),file=form.get('file'),category=required(form.get('category'),'Category');if(!DOC_CATEGORIES.includes(category))fail(422,'Invalid document category.');
  if(!(file instanceof File)||file.type!=='application/pdf'||file.size>4*1024*1024||file.size<5)fail(422,'Upload a PDF document between 5 bytes and 4 MB.');
  const bytes=await file.arrayBuffer();if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')fail(422,'The file does not have a valid PDF signature.');
  const key=`${user.workspace}/${app.id}/${uid()}`;const store=getStore({name:'approval360-private-documents',consistency:'strong'});await store.set(key,bytes);
  const [existing]=await db.select().from(s.documents).where(and(eq(s.documents.applicationId,app.id),eq(s.documents.category,category)));
  try{await db.transaction(async tx=>{
   const [locked]=await tx.select().from(s.applications).where(eq(s.applications.id,app.id)).for('update');if(!locked||!['Draft','Clarification Required'].includes(locked.status))fail(409,'The application moved to review. Refresh before changing documents.');
   const values={name:file.name.replace(/[^a-zA-Z0-9_. -]/g,'_').slice(0,160),blobKey:key,size:file.size,status:'Pending',comment:'',synthetic:false,uploadedAt:new Date()};
   if(existing)await tx.update(s.documents).set(values).where(eq(s.documents.id,existing.id));else await tx.insert(s.documents).values({id:uid(),applicationId:app.id,category,...values});
   await tx.update(s.applications).set({version:locked.version+1,updatedAt:new Date()}).where(eq(s.applications.id,app.id));
   const present=await tx.select({category:s.documents.category}).from(s.documents).where(eq(s.documents.applicationId,app.id));const missing=DOC_CATEGORIES.filter(c=>!present.some(d=>d.category===c));if(missing.length)await tx.insert(s.notifications).values({id:uid(),workspace:user.workspace,applicationId:app.id,title:'Supporting documents still required',message:`${app.id}: ${missing.join(', ')}`,priority:'High'});
   await audit(tx,user,existing?'Document replaced':'Document uploaded',app.id,category);
  });}catch(error){await store.delete(key);throw error;}
  if(existing?.blobKey)await store.delete(existing.blobKey);return Response.json({ok:true},{status:201});
 }
 if(path[0]==='documents'&&method==='GET'){
  const user=await authorize(req),[doc]=await db.select().from(s.documents).where(eq(s.documents.id,path[1]));if(!doc)fail(404,'Document not found.');await scopedApplication(doc!.applicationId,user);
  const bytes=doc!.synthetic?samplePdf(`${doc!.category} - ${doc!.applicationId}`):await getStore('approval360-private-documents').get(doc!.blobKey!,{type:'arrayBuffer'});if(!bytes)fail(404,'Stored file was not found.');
  return new Response(bytes as BodyInit,{headers:{'Content-Type':'application/pdf','Content-Disposition':`${new URL(req.url).searchParams.has('download')?'attachment':'inline'}; filename="${doc!.name.replace(/[^a-zA-Z0-9_. -]/g,'_')}"`,'Cache-Control':'private, no-store','Content-Security-Policy':"sandbox; default-src 'none'"}});
 }
 if(path[0]==='documents'&&method==='PATCH'){
  const user=await authorize(req,['scrutiny']),[doc]=await db.select().from(s.documents).where(eq(s.documents.id,path[1]));if(!doc)fail(404,'Document not found.');const app=await scopedApplication(doc!.applicationId,user);if(app.status!=='Under Scrutiny')fail(422,'Begin scrutiny before verifying documents.');const body=await req.json();if(!['Verified','Rejected'].includes(body.status))fail(422,'Choose Verified or Rejected.');
  await db.transaction(async tx=>{const [locked]=await tx.select().from(s.applications).where(eq(s.applications.id,app.id)).for('update');if(!locked||locked.status!=='Under Scrutiny')fail(409,'The application moved to another stage. Refresh before verifying documents.');await tx.update(s.applications).set({version:locked.version+1,updatedAt:new Date()}).where(eq(s.applications.id,app.id));await tx.update(s.documents).set({status:body.status,comment:required(body.comment,'Verification comment',1000)}).where(eq(s.documents.id,doc!.id));await audit(tx,user,`Document ${body.status.toLowerCase()}`,app.id,doc!.category);});return Response.json({ok:true});
 }
 if(path[0]==='compliance'&&method==='PATCH'){
  const user=await authorize(req,['bureau']),[record]=await db.select().from(s.compliance).where(eq(s.compliance.id,path[1]));if(!record)fail(404,'Compliance record not found.');const [institution]=await db.select().from(s.institutions).where(and(eq(s.institutions.id,record!.institutionId),eq(s.institutions.workspace,user.workspace)));if(!institution)fail(404,'Institution not found.');
  const body=await req.json(),score=number(body.score,'Score',0,100),notes=required(body.notes,'Verification evidence',1500);
  await db.transaction(async tx=>{await tx.update(s.compliance).set({score,notes,updatedAt:new Date()}).where(eq(s.compliance.id,record!.id));await audit(tx,user,'Compliance verified',institution!.id,notes);if(score<75)await tx.insert(s.notifications).values({id:uid(),workspace:user.workspace,institutionId:institution!.id,title:'Compliance violation identified',message:`${institution!.name}: ${notes}`,priority:'High'});});return Response.json({ok:true});
 }
 if(path[0]==='notifications'&&method==='PATCH'){
  const user=await authorize(req),[notice]=await db.select().from(s.notifications).where(and(eq(s.notifications.id,path[1]),eq(s.notifications.workspace,user.workspace)));if(!notice)fail(404,'Notification not found.');if(notice!.applicationId)await scopedApplication(notice!.applicationId,user);if(notice!.institutionId&&user.roleId==='institution'){const [institution]=await db.select().from(s.institutions).where(eq(s.institutions.id,notice!.institutionId));if(institution?.ownerId!==user.id)fail(403,'This notification belongs to another institution.');}
  const body=await req.json();if(body.read===false)await db.delete(s.notificationReads).where(and(eq(s.notificationReads.notificationId,notice!.id),eq(s.notificationReads.userId,user.id)));else await db.insert(s.notificationReads).values({id:uid(),notificationId:notice!.id,userId:user.id}).onConflictDoNothing();return Response.json({ok:true});
 }
 if(path[0]==='ai'&&method==='GET'){
  const user=await authorize(req),app=await scopedApplication(path[1],user);
  const [records,requirements,docs,cfg]=await Promise.all([db.select().from(s.compliance).where(eq(s.compliance.institutionId,app.institutionId)),db.select().from(s.requirements),db.select().from(s.documents).where(eq(s.documents.applicationId,app.id)),getConfig(user.workspace)]);
  return Response.json(advisory(app,records,requirements,docs.filter(d=>d.status!=='Rejected').map(d=>d.category),cfg.complianceThreshold));
 }
 if(path[0]==='escalations'&&method==='POST'){
  const user=await authorize(req,['scrutiny','bureau','authority','admin']),body=await req.json(),app=await scopedApplication(required(body.applicationId,'Application'),user);if(['Approved','Rejected'].includes(app.status))fail(422,'Closed applications cannot be escalated.');const reason=required(body.reason,'Escalation reason',1000);
  await db.transaction(async tx=>{await tx.insert(s.escalations).values({id:uid(),applicationId:app.id,reason}).onConflictDoUpdate({target:s.escalations.applicationId,set:{reason,status:'Open'}});await tx.insert(s.notifications).values({id:uid(),workspace:user.workspace,applicationId:app.id,title:'Application escalated',message:`${app.id}: ${reason}`,priority:'Critical'});await audit(tx,user,'Application escalated',app.id,reason);});return Response.json({ok:true});
 }
 if(path[0]==='escalations'&&method==='PATCH'){
  const user=await authorize(req,['bureau','authority','admin']),[row]=await db.select().from(s.escalations).where(eq(s.escalations.id,path[1]));if(!row)fail(404,'Escalation not found.');await scopedApplication(row!.applicationId,user);await db.transaction(async tx=>{await tx.update(s.escalations).set({status:'Resolved'}).where(eq(s.escalations.id,row!.id));await audit(tx,user,'Escalation resolved',row!.applicationId,row!.reason);});return Response.json({ok:true});
 }
 if(path[0]==='settings'&&method==='PUT'){
  const user=await authorize(req,['admin']),body=await req.json(),value={slaDays:number(body.slaDays,'SLA days',7,120),warningDays:number(body.warningDays,'Warning days',1,30),complianceThreshold:number(body.complianceThreshold,'Compliance threshold',50,100)};
  await db.transaction(async tx=>{await tx.insert(s.settings).values({id:user.workspace,workspace:user.workspace,value}).onConflictDoUpdate({target:s.settings.id,set:{value}});await audit(tx,user,'Settings updated',user.workspace,JSON.stringify(value));});return Response.json({ok:true});
 }
 if(path[0]==='profile'&&method==='PATCH'){
  const user=await authorize(req),body=await req.json(),name=required(body.name,'Full name',100);await db.transaction(async tx=>{await tx.update(s.users).set({name}).where(eq(s.users.id,user.id));await audit(tx,user,'Profile updated',user.id,'Display name updated.');});return Response.json({ok:true});
 }
 if(path[0]==='users'&&method==='PATCH'){
  const user=await authorize(req,['admin']),body=await req.json(),[target]=await db.select().from(s.users).where(and(eq(s.users.id,path[1]),eq(s.users.workspace,user.workspace)));if(!target)fail(404,'User not found.');if(target!.id===user.id)fail(422,'You cannot change your own permissions.');if(!ROLE_NAMES[body.roleId])fail(422,'Invalid role.');
  const bureauId=body.bureauId||null;if(bureauId){const [bureau]=await db.select().from(s.bureaus).where(and(eq(s.bureaus.id,bureauId),eq(s.bureaus.workspace,user.workspace)));if(!bureau)fail(422,'Choose a bureau in this workspace.');}
  await db.transaction(async tx=>{await tx.update(s.users).set({roleId:body.roleId,active:body.active!==false,bureauId}).where(eq(s.users.id,target!.id));await tx.delete(s.officers).where(eq(s.officers.userId,target!.id));if(bureauId&&['scrutiny','bureau','authority'].includes(body.roleId))await tx.insert(s.officers).values({id:uid(),userId:target!.id,bureauId});await audit(tx,user,'User permissions updated',target!.id,ROLE_NAMES[body.roleId]);});return Response.json({ok:true});
 }
 if(path[0]==='bureaus'&&method==='POST'){
  const user=await authorize(req,['admin']),body=await req.json(),row={id:uid(),workspace:user.workspace,name:required(body.name,'Bureau name'),region:required(body.region,'Region')};await db.transaction(async tx=>{await tx.insert(s.bureaus).values(row);await audit(tx,user,'Bureau created',row.id,row.name);});return Response.json(row,{status:201});
 }
 fail(404,'API endpoint not found.');
 }catch(error){if(error instanceof ApiError)return Response.json({error:error.message},{status:error.status});if(error instanceof SyntaxError)return Response.json({error:'Invalid request body.'},{status:400});const code=(error as {code?:string;cause?:{code?:string}})?.code||(error as {cause?:{code?:string}})?.cause?.code;if(code==='23505')return Response.json({error:'A record with this identifier already exists.'},{status:409});console.error('API request failed',error instanceof Error?error.name:'UnknownError');return Response.json({error:'The service could not complete this request. Check database provisioning and try again.'},{status:503});}
}
