"""Generate a deterministic SQL migration of fictional SIH demonstration records.
This generates migration source only; it does not connect to or modify a database.
"""
from pathlib import Path
from datetime import datetime, timedelta, timezone
import random
rng = random.Random(360)
def q(v):
    if v is None: return 'NULL'
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, (int, float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"
rows = ['-- Fictional demonstration data only. No real institutions or personal information.']
def insert(table, values):
    rows.append(f'INSERT INTO "{table}" ({", ".join(chr(34)+k+chr(34) for k in values)}) VALUES ({", ".join(q(v) for v in values.values())}) ON CONFLICT DO NOTHING;')
roles = [('institution','Institution Administrator','Kavya Nair'),('scrutiny','Scrutiny Officer','Arjun Mehta'),('bureau','Bureau Officer','Devika Sen'),('authority','Approving Authority','Vikram Iyer'),('admin','System Administrator','Ananya Rao')]
for role, name, person in roles: insert('roles',dict(id=role,name=name))
for i,(name,region) in enumerate([('Technical Education Bureau','Southern Region'),('Engineering & Technology Bureau','Western Region'),('Institutional Standards Bureau','Northern Region')]): insert('bureaus',dict(id=f'bureau-{i+1}',workspace='demo',name=name,region=region))
for role,name,person in roles:
    insert('users',dict(id=f'demo-{role}',workspace='demo',name=person,email=f'{role}@approval360.example',role_id=role,bureau_id=None if role=='institution' else 'bureau-1'))
    if role in ['scrutiny','bureau','authority']: insert('officers',dict(id=f'officer-{role}',user_id=f'demo-{role}',bureau_id='bureau-1'))
categories=[('faculty','Faculty availability','Maintain the demonstration faculty-to-student ratio.',80,2),('qualifications','Faculty qualifications','Verify faculty credentials and qualification evidence.',75,2),('intake','Student intake','Confirm approved capacity against proposed intake.',75,1),('infrastructure','Infrastructure','Verify building, accessibility and safety evidence.',80,2),('laboratory','Laboratory facilities','Confirm laboratory capacity and facility records.',75,2),('library','Library facilities','Verify learning resources and library access.',70,1),('equipment','Equipment availability','Verify equipment inventory and maintenance evidence.',75,1),('documents','Institutional documents','Verify institutional registration and supporting records.',80,1)]
for rid,cat,description,threshold,weight in categories: insert('compliance_requirements',dict(id=rid,category=cat,description=description,threshold=threshold,weight=weight))
names=['Sahyadri Institute of Technology','Kaveri College of Engineering','Aravali Institute of Science','Malabar Technical Institute','Vindhya School of Technology','Nilgiri College of Engineering','Konkan Institute of Technology','Deccan College of Technical Studies','Himalaya Polytechnic Institute','Narmada Institute of Engineering','Godavari Technical College','Satpura College of Engineering','Chambal Institute of Technology','Brahmaputra Technical Institute','Mahanadi College of Engineering','Coromandel Institute of Science','Tapti Polytechnic College','Shivalik Institute of Engineering','Vaigai Technical Institute','Pennar College of Technology']
places=[('Maharashtra','Pune'),('Tamil Nadu','Coimbatore'),('Rajasthan','Jaipur'),('Kerala','Kozhikode'),('Madhya Pradesh','Indore'),('Tamil Nadu','Ooty'),('Goa','Panaji'),('Karnataka','Bengaluru'),('Uttarakhand','Dehradun'),('Gujarat','Vadodara'),('Telangana','Hyderabad'),('Madhya Pradesh','Bhopal'),('Rajasthan','Kota'),('Assam','Guwahati'),('Odisha','Bhubaneswar'),('Tamil Nadu','Chennai'),('Gujarat','Surat'),('Himachal Pradesh','Solan'),('Tamil Nadu','Madurai'),('Andhra Pradesh','Nellore')]
base=datetime(2026,10,31,10,0,tzinfo=timezone.utc)
for i,name in enumerate(names):
    state,city=places[i]
    insert('institutions',dict(id=f'inst-{i+1:03}',workspace='demo',owner_id='demo-institution',name=name,code=f'DEMO-{1000+i}',state=state,city=city,type='Polytechnic' if 'Polytechnic' in name else 'Engineering College',email=f'office{i+1}@institution.example',established=1992+i%23))
    for j,(rid,*_) in enumerate(categories):
        score=54+(i*7+j*3)%30 if i%5==0 else 77+(i*3+j*2)%23
        insert('compliance_records',dict(id=f'comp-{i+1}-{rid}',institution_id=f'inst-{i+1:03}',requirement_id=rid,score=score,notes='Synthetic assessment; verify evidence before making a decision.'))
statuses=['Under Scrutiny','Under Bureau Review','Pending Final Approval','Approved','Submitted','Clarification Required','Approved','Draft','Rejected','Approved']
docs=['Institution registration','Land & building certificate','Faculty details','Laboratory inventory','Financial statement','Affiliation certificate']
for i in range(50):
    aid=f'APP-2026-{1001+i}',
    aid=aid[0]
    status=statuses[i%10];inst=f'inst-{i%20+1:03}';created=base-timedelta(days=(i*11)%170+1)
    deadline=base+timedelta(days=[4,7,12,20,-3,2,16,27,-5,9][i%10])
    insert('applications',dict(id=aid,workspace='demo',institution_id=inst,type=['Extension of Approval','New Institution','Increase in Intake','New Programme'][i%4],year='2026–27',status=status,deadline=deadline.isoformat(),intake=[180,240,360,120][i%4],program=['Engineering & Technology','Management','Computer Applications'][i%3],created_at=created.isoformat(),updated_at=(base-timedelta(hours=i*2)).isoformat(),assigned_to='demo-'+('scrutiny' if status in ['Submitted','Under Scrutiny'] else 'bureau' if status=='Under Bureau Review' else 'authority') if status not in ['Draft','Approved','Rejected'] else None))
    count=4 if status in ['Draft','Clarification Required'] else 6
    for j,cat in enumerate(docs[:count]): insert('application_documents',dict(id=f'doc-{i+1}-{j}',application_id=aid,category=cat,name=cat.lower().replace(' ','_').replace('&','and')+'.pdf',size=14500+i*317+j*100,status='Verified' if status in ['Under Bureau Review','Pending Final Approval','Approved','Rejected'] else 'Pending',synthetic=True,comment='Fictional sample evidence for demonstration.'))
    insert('approval_history',dict(id=f'history-{i+1}',application_id=aid,user_id='demo-institution' if status in ['Draft','Submitted'] else 'demo-scrutiny' if status in ['Under Scrutiny','Under Bureau Review','Clarification Required'] else 'demo-authority',from_status='Draft' if status=='Submitted' else 'Submitted',to_status=status,comment='Synthetic workflow snapshot imported for the SIH demonstration; not a complete historical chain.',created_at=(base-timedelta(hours=i*2)).isoformat()))
    if i<12:
        title=['Faculty compliance requires attention','Application ready for bureau review','Final decision pending','Approval recorded','Deadline approaching','Clarification response needed'][i%6]
        insert('notifications',dict(id=f'notice-{i+1}',workspace='demo',application_id=aid,title=title,message=f'{names[i%20]} · {aid}. Review the application and supporting evidence.',priority=['Critical','Normal','High','Normal','High','High'][i%6],created_at=(base-timedelta(hours=i*3)).isoformat()))
    if i<15: insert('audit_logs',dict(id=f'audit-{i+1}',workspace='demo',user_id='demo-scrutiny',action='Application reviewed' if i%2 else 'Documents verified',entity_id=aid,details=names[i%20],created_at=(base-timedelta(hours=i*2)).isoformat()))
    if i in [4,14,24]: insert('escalations',dict(id=f'esc-{i}',application_id=aid,reason='Demonstration SLA deadline exceeded. Officer follow-up required.',status='Open'))
insert('settings',dict(id='demo',workspace='demo',value='{"slaDays":30,"warningDays":7,"complianceThreshold":75}'))
path=Path('netlify/database/migrations/20261031140000_seed_demonstration.sql')
path.write_text('\n'.join(rows)+'\n')
print('Generated fictional seed migration: 20 institutions, 50 applications, 160 compliance records.')
