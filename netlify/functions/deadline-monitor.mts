import type { Config } from '@netlify/functions';
import { and, eq, notInArray, lt } from 'drizzle-orm';
import { database } from '../../db';
import { applications, settings, notifications, escalations, audits, sessions } from '../../db/schema';
export default async()=>{
 const db=database(),now=new Date(),day=now.toISOString().slice(0,10);
 await db.delete(sessions).where(lt(sessions.expiresAt,now));
 const configs=await db.select().from(settings);
 const records=await db.select().from(applications).where(and(notInArray(applications.status,['Draft','Approved','Rejected']),lt(applications.deadline,new Date(Date.now()+30*86400000))));
 for(const app of records){
  const cfg=configs.find(c=>c.workspace===app.workspace)?.value||{slaDays:30,warningDays:7,complianceThreshold:75};
  const remaining=Math.ceil((app.deadline.getTime()-now.getTime())/86400000);if(remaining>cfg.warningDays)continue;
  const title=remaining<0?'Decision deadline exceeded':'Upcoming application deadline',id=`deadline:${app.id}:${day}`;
  await db.transaction(async tx=>{
   const inserted=await tx.insert(notifications).values({id,workspace:app.workspace,applicationId:app.id,title,message:`${app.id}: ${remaining<0?`${Math.abs(remaining)} days overdue`:`due in ${remaining} days`}. Responsible officers should review the application.`,priority:remaining<0?'Critical':'High'}).onConflictDoNothing().returning();
   if(remaining< -cfg.warningDays){await tx.insert(escalations).values({id:`sla:${app.id}`,applicationId:app.id,reason:'Automatic demonstration SLA escalation: deadline exceeded beyond warning window.'}).onConflictDoNothing();}
   if(inserted.length)await tx.insert(audits).values({id:`audit:${id}`,workspace:app.workspace,action:'Deadline monitor alert',entityId:app.id,details:title}).onConflictDoNothing();
  });
 }
};
export const config:Config={schedule:'@daily'};
