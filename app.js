const modules = {
  services: { title: 'Linux service assessment', short: 'Linux services', desc: 'Review running services, firewall posture, and update configuration.', heading: 'Linux services' },
  permissions: { title: 'File permission assessment', short: 'File permissions', desc: 'Review ownership, access modes, sensitive files, and least privilege.', heading: 'File permissions' },
  nfs: { title: 'NFS security assessment', short: 'NFS security', desc: 'Review exports, root squashing, and network exposure.', heading: 'NFS security' },
  reporting: { title: 'Security reports & recommendations', short: 'Reports & guidance', desc: 'Prioritize findings and track practical remediation across students.', heading: 'Reports & guidance' }
};
const palette = { '#e8e5ff':'#5e5b84','#def4ed':'#3f806a','#ffe8da':'#a46b49','#e1f0ff':'#4d7595','#ffe2ec':'#9b5d77','#fff0cf':'#9a7a37' };
let offlineMode = location.protocol === 'file:' || location.hostname.endsWith('.github.io'), students = [], activeView = 'overview', query = '', filterMode = 'All students', detailStudent = null, toastTimer;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const demoNames = [['STU-2401','Maya Chen','Computer Science','Year 3','MC','#e8e5ff'],['STU-2402','Ethan Brooks','Information Systems','Year 2','EB','#def4ed'],['STU-2403','Amara Okafor','Cybersecurity','Year 4','AO','#ffe8da'],['STU-2404','Lucas Ferreira','Data Science','Year 1','LF','#e1f0ff'],['STU-2405','Sofia Patel','Computer Science','Year 3','SP','#ffe2ec'],['STU-2406','Noah Williams','Network Engineering','Year 2','NW','#fff0cf'],['STU-2407','Aisha Rahman','Cybersecurity','Year 4','AR','#def4ed'],['STU-2408','Oliver Kim','Information Systems','Year 1','OK','#e8e5ff']];
const demoFindings = {services:[['SSH service','Running','Review'],['Firewall (UFW)','Active','Pass'],['Automatic updates','Enabled','Pass']],permissions:[['Student records','Group writable','Review'],['Home directories','Owner only','Pass'],['Backup files','World readable','Critical']],nfs:[['NFS exports','No exports found','Pass'],['Root squash','Enabled','Pass'],['Network scope','Restricted','Pass']],reporting:[['Assessment notes','2 recommendations','Review'],['Last reviewed','Today','Pass'],['Evidence attached','0 items','Review']]};
function makeDemoStudents(){return demoNames.map((s,i)=>({id:s[0],name:s[1],program:s[2],year:s[3],email:`demo${i+1}@northstar.edu`,initials:s[4],color:s[5],updatedAt:new Date(Date.now()-i*3600000).toISOString(),assessments:Object.fromEntries(Object.keys(modules).map((m,j)=>[m,{status:i===2&&j===2?'At risk':(i+j)%4===0?'Needs review':'Secure',findings:demoFindings[m].map(([name,value,status])=>({name,value,status})),notes:''}]))}));}
function loadLocalStudents(){try{const saved=localStorage.getItem('campusguard-students');if(saved)return JSON.parse(saved);}catch{}const seeded=makeDemoStudents();saveLocalStudents(seeded);return seeded;}
function saveLocalStudents(items){try{localStorage.setItem('campusguard-students',JSON.stringify(items));}catch{}}
if(offlineMode) students=loadLocalStudents();
async function api(path, options = {}) {
  if(offlineMode){
    const method=options.method||'GET', items=loadLocalStudents();
    if(method==='GET'){const q=new URLSearchParams(path.split('?')[1]||'').get('q')?.toLowerCase();return q?items.filter(s=>`${s.name} ${s.id} ${s.program} ${s.email}`.toLowerCase().includes(q)):items;}
    const payload=options.body?JSON.parse(options.body):{};
    if(method==='POST'&&path==='/api/students'){const name=String(payload.name||'').trim(),id=`STU-${String(Date.now()).slice(-6)}`,student={id,name,program:String(payload.program||'').trim(),year:payload.year||'Year 1',email:'student@northstar.edu',initials:name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase(),color:'#e8e5ff',updatedAt:new Date().toISOString(),assessments:Object.fromEntries(Object.keys(modules).map(m=>[m,{status:'Needs review',findings:demoFindings[m].map(([n,v,s])=>({name:n,value:v,status:s})),notes:''}]))};items.unshift(student);saveLocalStudents(items);return student;}
    const match=path.match(/^\/api\/students\/([^/]+)\/assessments\/([^/?]+)/);
    if(method==='PATCH'&&match){const student=items.find(s=>s.id===decodeURIComponent(match[1]));if(!student)throw new Error('Student not found');const assessment=student.assessments[match[2]];if(payload.status)assessment.status=payload.status;if(typeof payload.notes==='string')assessment.notes=payload.notes;student.updatedAt=new Date().toISOString();saveLocalStudents(items);return student;}
    throw new Error('Unsupported local preview action');
  }
  const res = await fetch(path, { headers: {'Content-Type':'application/json', ...(options.headers || {})}, ...options });
  const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Request failed'); return data;
}
function aggregate(student) {
  const states = Object.values(student.assessments || {}).map(a => a.status);
  if (states.includes('At risk')) return 'At risk';
  if (states.includes('Needs review')) return 'Needs review';
  return 'Secure';
}
function pill(status) {
  const cls = status === 'Secure' ? 'status-secure' : status === 'At risk' ? 'status-risk' : status === 'Needs review' ? 'status-review' : 'status-none';
  return `<span class="status-pill ${cls}">${esc(status)}</span>`;
}
function relativeDate(value) {
  const d = new Date(value); if (!value || Number.isNaN(d.getTime())) return 'Not reviewed';
  const hrs = Math.floor((Date.now() - d.getTime()) / 3600000);
  if (hrs < 1) return 'Just now'; if (hrs < 24) return `${hrs}h ago`; if (hrs < 48) return 'Yesterday';
  return `${Math.floor(hrs / 24)} days ago`;
}
function assessmentStatus(student, view = activeView) {
  return modules[view] ? student.assessments?.[view]?.status || 'Needs review' : aggregate(student);
}
function filteredStudents() {
  let items = [...students];
  if (query) items = items.filter(s => `${s.name} ${s.id} ${s.program} ${s.email}`.toLowerCase().includes(query.toLowerCase()));
  if (filterMode === 'Needs review') items = items.filter(s => ['Needs review','At risk'].includes(aggregate(s)));
  if (filterMode === 'Secure') items = items.filter(s => aggregate(s) === 'Secure');
  return items;
}
function renderRows() {
  const items = filteredStudents().slice(0, activeView === 'overview' ? 6 : 100);
  $('#student-rows').innerHTML = items.length ? items.map(s => {
    const bg = esc(s.color || '#e8e5ff'), fg = palette[s.color] || '#5e5b84';
    return `<tr data-student="${esc(s.id)}"><td><div class="student-cell"><span class="student-avatar" style="background:${bg};color:${fg}">${esc(s.initials)}</span><span><span class="student-name">${esc(s.name)}</span><span class="student-id">${esc(s.id)}</span></span></div></td><td><span class="program-name">${esc(s.program)}</span></td><td>${pill(assessmentStatus(s))}</td><td><span class="last-reviewed">${relativeDate(s.updatedAt)}</span></td><td><button class="row-menu" aria-label="Open ${esc(s.name)}">···</button></td></tr>`;
  }).join('') : '<tr><td colspan="5"><div class="empty-state">No students match your search.</div></td></tr>';
  $('#showing-text').textContent = `${items.length ? 'Showing 1–' + items.length + ' of ' : 'Showing '}${filteredStudents().length} students`;
  $('#student-count').textContent = String(students.length).padStart(2, '0');
  $('#student-rows').querySelectorAll('tr[data-student]').forEach(row => row.addEventListener('click', () => openDetail(row.dataset.student)));
}
function updateMetrics() {
  const total = students.length;
  const reviewed = students.filter(s => Object.values(s.assessments || {}).some(a => a.status !== 'Needs review')).length;
  const attention = students.filter(s => aggregate(s) !== 'Secure').length;
  const securePct = total ? Math.round(students.reduce((sum,s) => sum + Object.values(s.assessments || {}).filter(a => a.status === 'Secure').length, 0) / (total * 4) * 100) : 0;
  $('#total-students').textContent = total; $('#total-small').textContent = total;
  $('#assessed-count').textContent = reviewed; $('#attention-count').textContent = attention;
  $('#posture-score').textContent = securePct; $('#score-fill').style.width = `${securePct}%`;
  for (const key of ['services','permissions','nfs']) {
    const arr = students.map(s => s.assessments?.[key]?.status).filter(Boolean);
    const pct = arr.length ? Math.round(arr.filter(s => s === 'Secure').length / arr.length * 100) : 0;
    $(`#mod-${key}`).textContent = `${pct}%`;
  }
  $('#mod-reporting').textContent = `${attention} open`;
  $('#last-sync').textContent = 'Just updated';
  if(offlineMode){$('.local-badge').innerHTML='<span></span> LOCAL PREVIEW';$('.module-foot span:nth-child(2)').textContent='Saved in this browser';$('#last-sync').textContent='Saved on this device';}
}
function reportModule() {
  const concerns = [];
  for (const student of students) for (const [key,a] of Object.entries(student.assessments || {})) {
    if (a.status !== 'Secure') concerns.push({student, key, status:a.status, notes:a.notes || ''});
  }
  const byModule = Object.keys(modules).map(key => [key, students.filter(s => s.assessments?.[key]?.status !== 'Secure').length]);
  const top = [...byModule].sort((a,b) => b[1]-a[1]).filter(x => x[1]);
  const advice = {
    services:'Disable unused listeners, review firewall rules, and keep essential packages patched.',
    permissions:'Remove broad write/read access on sensitive records; verify ownership and use least privilege.',
    nfs:'Restrict exports to trusted subnets, enable root squashing, and avoid wildcard client access.',
    reporting:'Add concise evidence and an owner for each open item, then record a follow-up review date.'
  };
  $('.module-list').innerHTML = `<div class="report-summary"><div class="report-count">${concerns.length}<small> open module reviews</small></div><div class="report-advice"><strong>Suggested next steps</strong>${(top.length ? top : [['reporting',0]]).slice(0,3).map(([key,count])=>`<div class="recommendation"><span class="rec-dot ${count?'':'green-dot'}"></span><span><b>${esc(modules[key].short)}${count?` · ${count} student${count===1?'':'s'}`:''}</b><small>${esc(advice[key])}</small></span></div>`).join('')}</div><div class="report-note">Recommendations are guidance for an authorized system administrator. Confirm each finding against current host configuration.</div></div>`;
}
function showView(view) {
  activeView = modules[view] ? view : (view === 'students' ? 'students' : 'overview');
  document.body.classList.toggle('view-module', !!modules[activeView]);
  const title = modules[activeView]?.title || (activeView === 'students' ? 'Student directory' : 'Good morning, admin ✳');
  $('#crumb').textContent = modules[activeView]?.short || (activeView === 'students' ? 'Students' : 'Overview');
  $('#page-title').innerHTML = activeView === 'overview' ? 'Good morning, admin <span class="wave">✳</span>' : esc(title);
  $('#page-subtitle').textContent = modules[activeView]?.desc || (activeView === 'students' ? 'Manage student records and open an assessment to review findings.' : 'A clear view of your student environment and its security posture.');
  document.querySelectorAll('.nav-link').forEach(b => b.classList.toggle('active', b.dataset.view === activeView || (activeView === 'students' && b.dataset.view === 'students')));
  $('.stats-grid').style.display = activeView === 'students' ? 'none' : '';
  $('#add-student').style.display = activeView === 'reporting' ? 'none' : '';
  $('.module-panel .panel-heading h2').textContent = activeView === 'reporting' ? 'Prioritized recommendations' : 'Assessment modules';
  $('.module-panel .panel-heading p').textContent = activeView === 'reporting' ? 'Based on open student reviews' : 'Your four review areas';
  $('.students-panel .panel-heading h2').textContent = modules[activeView] ? `${modules[activeView].short} · students` : 'Student directory';
  $('.students-panel .panel-heading p').textContent = modules[activeView] ? 'Select a student to review findings and update status' : 'Security coverage across your student records';
  if (activeView === 'reporting') reportModule(); else $('.module-list').innerHTML = originalModuleList;
  renderRows();
}
const originalModuleList = $('.module-list').innerHTML;
async function refresh() { try{students = await api('/api/students');}catch(e){if(!offlineMode){offlineMode=true;students=loadLocalStudents();$('.local-badge').innerHTML='<span></span> LOCAL PREVIEW';showToast('Server unavailable — running local preview');}else throw e;} updateMetrics(); renderRows(); }
function showToast(message) {
  const toast = $('#toast'); toast.textContent = message; toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}
async function openDetail(id) {
  const s = students.find(x => x.id === id); if (!s) return;
  detailStudent = s;
  const key = modules[activeView] ? activeView : 'services';
  const a = s.assessments[key]; const bg = esc(s.color || '#e8e5ff'); const fg = palette[s.color] || '#5e5b84';
  $('#detail-content').innerHTML = `<div class="detail-content"><div class="detail-topline"><span class="eyebrow">STUDENT ASSESSMENT</span><button class="close-button" id="close-detail" aria-label="Close">×</button></div><div class="detail-header"><span class="student-avatar" style="background:${bg};color:${fg}">${esc(s.initials)}</span><span><h2>${esc(s.name)}</h2><p>${esc(s.id)} · ${esc(s.program)} · ${esc(s.year)}</p></span></div><div class="detail-section"><h3>${esc(modules[key].short)} findings</h3>${a.findings.map(f=>`<div class="finding"><span>${esc(f.name)}</span><strong>${esc(f.value)} &nbsp; ${pill(f.status==='Critical'?'At risk':f.status==='Pass'?'Secure':'Needs review')}</strong></div>`).join('')}</div><div class="detail-section"><h3>Assessment status</h3><select class="detail-status" id="detail-status"><option ${a.status==='Secure'?'selected':''}>Secure</option><option ${a.status==='Needs review'?'selected':''}>Needs review</option><option ${a.status==='At risk'?'selected':''}>At risk</option></select><h3>Review notes</h3><textarea id="detail-notes" class="detail-notes" maxlength="2000" placeholder="Add a note for this assessment…">${esc(a.notes || '')}</textarea></div><div class="detail-actions"><button class="secondary-button" id="close-detail-2">Close</button><button class="primary-button" id="save-detail">Save review</button></div></div>`;
  const dlg = $('#detail-dialog'); dlg.showModal();
  $('#close-detail').onclick = () => dlg.close(); $('#close-detail-2').onclick = () => dlg.close();
  $('#save-detail').onclick = async () => {
    try { await api(`/api/students/${encodeURIComponent(s.id)}/assessments/${key}`, {method:'PATCH', body:JSON.stringify({status:$('#detail-status').value, notes:$('#detail-notes').value})}); await refresh(); dlg.close(); showToast('Assessment saved'); }
    catch(e) { showToast(e.message); }
  };
}
document.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
$('#student-search').addEventListener('input', e => { query = e.target.value; renderRows(); });
$('#filter-button').addEventListener('click', () => { filterMode = filterMode === 'All students' ? 'Needs review' : filterMode === 'Needs review' ? 'Secure' : 'All students'; $('#filter-label').textContent = filterMode; renderRows(); });
$('#add-student').addEventListener('click', () => $('#student-dialog').showModal());
$('#cancel-add').addEventListener('click', () => $('#student-dialog').close());
$('#student-form').addEventListener('submit', async e => {
  e.preventDefault(); const form = new FormData(e.currentTarget);
  try { await api('/api/students', {method:'POST',body:JSON.stringify({name:form.get('name'),program:form.get('program'),year:form.get('year')})}); e.currentTarget.reset(); $('#student-dialog').close(); await refresh(); showToast('Student record created'); }
  catch(err) { showToast(err.message); }
});
$('#help-btn').addEventListener('click', () => showToast('CampusGuard stores demo records on this device. See README for setup and security notes.'));
refresh().catch(e => { $('#student-rows').innerHTML = `<tr><td colspan="5"><div class="empty-state">Unable to load demo records: ${esc(e.message)}</div></td></tr>`; });
