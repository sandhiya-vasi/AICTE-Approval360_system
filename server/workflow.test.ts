import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTransition, weightedScore, advisory } from './workflow';
import { DOC_CATEGORIES } from '../src/types/index';
test('only assigned officer role can move workflow, even system admins cannot decide',()=>{
 assert.ok(validateTransition('Pending Final Approval','Approved','admin',DOC_CATEGORIES,90,75));
 assert.equal(validateTransition('Pending Final Approval','Approved','authority',DOC_CATEGORIES,90,75),null);
 assert.ok(validateTransition('Draft','Approved','authority',DOC_CATEGORIES,90,75));
});
test('completeness and compliance gate progression',()=>{
 assert.ok(validateTransition('Draft','Submitted','institution',[],90,75));
 assert.equal(validateTransition('Draft','Submitted','institution',DOC_CATEGORIES,90,75),null);
 assert.ok(validateTransition('Under Bureau Review','Pending Final Approval','bureau',DOC_CATEGORIES,60,75));
});
test('missing compliance categories count zero and weighting applies',()=>{
 assert.equal(weightedScore([{requirementId:'a',score:100}],[{id:'a',weight:1},{id:'b',weight:3}]),25);
});
test('advisory explains critical deadlines and never approves',()=>{
 const result=advisory({id:'x',deadline:'2020-01-01',createdAt:'2019-12-01',status:'Submitted'},[],[{id:'a',weight:1,threshold:75}],[]);
 assert.equal(result.priority,'Critical');assert.equal(result.missing.length,6);assert.equal(result.score,0);assert.equal(result.reasons.length,3);
});
