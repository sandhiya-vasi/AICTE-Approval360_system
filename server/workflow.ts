import { DOC_CATEGORIES } from '../src/types/index';
export const transitions: Record<string, {to:string;role:string;label:string}[]> = {
 'Draft':[{to:'Submitted',role:'institution',label:'Submit application'}],
 'Submitted':[{to:'Under Scrutiny',role:'scrutiny',label:'Begin scrutiny'}],
 'Under Scrutiny':[{to:'Under Bureau Review',role:'scrutiny',label:'Complete scrutiny'},{to:'Clarification Required',role:'scrutiny',label:'Request clarification'}],
 'Clarification Required':[{to:'Submitted',role:'institution',label:'Resubmit application'}],
 'Under Bureau Review':[{to:'Pending Final Approval',role:'bureau',label:'Recommend for approval'},{to:'Clarification Required',role:'bureau',label:'Request clarification'}],
 'Pending Final Approval':[{to:'Approved',role:'authority',label:'Approve application'},{to:'Rejected',role:'authority',label:'Reject application'}],
};
export function validateTransition(from:string,to:string,role:string,docCategories:string[],score:number,threshold:number) {
 const transition=transitions[from]?.find(t=>t.to===to);
 if(!transition || transition.role!==role) return 'This role cannot perform that status transition.';
 if(to==='Submitted' && DOC_CATEGORIES.some(c=>!docCategories.includes(c))) return 'Upload all six required document categories before submission.';
 if((to==='Pending Final Approval'||to==='Approved')&&score<threshold) return `Compliance score must reach ${threshold}% before progressing.`;
 return null;
}
export function weightedScore(records:{score:number;requirementId:string}[],requirements:{id:string;weight:number}[]) {
 const weight=requirements.reduce((n,r)=>n+r.weight,0);
 return weight?Math.round(requirements.reduce((n,r)=>n+(records.find(c=>c.requirementId===r.id)?.score||0)*r.weight,0)/weight):0;
}
export function advisory(app:{id:string;deadline:Date|string;createdAt:Date|string;status:string},records:{score:number;requirementId:string}[],requirements:{id:string;weight:number;threshold:number}[],categories:string[],threshold=75) {
 const score=weightedScore(records,requirements),violations=requirements.filter(r=>(records.find(c=>c.requirementId===r.id)?.score||0)<r.threshold).length;
 const missing=DOC_CATEGORIES.filter(c=>!categories.includes(c));
 const remaining=Math.ceil((new Date(app.deadline).getTime()-Date.now())/86400000),age=Math.max(0,Math.floor((Date.now()-new Date(app.createdAt).getTime())/86400000));
 const terminal=['Approved','Rejected'].includes(app.status);
 const risk=score<threshold-15||violations>=4?'High':score<threshold||violations>=2?'Medium':'Low';
 const priority=terminal?'Closed':remaining<0||risk==='High'?'Critical':remaining<=7||age>21?'High':'Normal';
 return {applicationId:app.id,missing,score,violations,risk,priority,estimatedDelayDays:terminal?0:Math.max(0,Math.round(missing.length*1.8+violations*1.3+age*.12+(score<threshold?4:0)-3)),reasons:[terminal?'Application has a final human decision.':`${remaining<0?`${Math.abs(remaining)} days past deadline`:`${remaining} days until deadline`}; pending for ${age} days.`,`${missing.length} required document categories missing.`,`${violations} compliance categories below their configured minimum; overall score ${score}%.`],model:'Transparent demonstration rules (not a trained prediction).'};
}
