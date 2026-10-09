import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

function validateSupabaseConfig(url, key) {
  if (!url || !key) return 'Supabase configuration is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) {
      return 'VITE_SUPABASE_URL is not a valid Supabase project URL.';
    }
    const parts = key.split('.');
    if (parts.length !== 3) return 'VITE_SUPABASE_ANON_KEY is not a valid JWT.';
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - parts[1].length % 4) % 4)));
    const ref = parsed.hostname.split('.')[0];
    if (payload.ref && payload.ref !== ref) return 'VITE_SUPABASE_ANON_KEY belongs to a different Supabase project.';
    if (payload.role !== 'anon') return 'VITE_SUPABASE_ANON_KEY is not an anonymous/public key.';
    return '';
  } catch {
    return 'Supabase configuration is invalid. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';
  }
}

const SUPABASE_CONFIG_ERROR = validateSupabaseConfig(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabase = SUPABASE_CONFIG_ERROR ? null : createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const money = (v) => typeof v === 'number' ? `₹${v.toLocaleString('en-IN')}` : (v || '—');
const esc = (v='') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
const fmtDate = (v) => v ? new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(v)) : '—';
const toast = (message, type='') => { let el=$('#fds-toast'); if(!el){el=document.createElement('div');el.id='fds-toast';document.body.appendChild(el)} el.className=`fds-toast ${type}`; el.textContent=message; requestAnimationFrame(()=>el.classList.add('show')); setTimeout(()=>el.classList.remove('show'),3600); };
const getRoute = () => window.location.pathname.replace(/\/+$/,'') || '/';
const friendlyError = (error, fallback='Something went wrong. Please try again.') => {
  const message=String(error?.message||'').trim();
  if(!message) return fallback;
  if(/invalid login credentials/i.test(message)) return 'The email or password is incorrect.';
  if(/email.*already.*registered|user.*already.*registered/i.test(message)) return 'An account with this email already exists. Try logging in instead.';
  if(/rate limit/i.test(message)) return 'Too many attempts. Please wait a moment and try again.';
  if(/network|fetch|failed to fetch/i.test(message)) return 'We could not reach the client platform. Check your connection and try again.';
  if(/permission|not authorized|row-level security|rls/i.test(message)) return 'You do not have permission to perform that action.';
  return message;
};
const renderPortalLoading = (root,label='Loading your workspace…') => {
  if(!root) return;
  root.innerHTML=`<div class=\"portal-empty portal-loading\"><div class=\"portal-empty-mark\">FD</div><h2>${esc(label)}</h2><p>Please wait while we load the latest information.</p></div>`;
};
const renderPortalError = (root,title='We could not load this page.',message='Please try again.') => {
  if(!root) return;
  root.innerHTML=`<div class=\"portal-empty portal-error-state\"><div class=\"portal-empty-mark\">!</div><h2>${esc(title)}</h2><p>${esc(message)}</p><button class=\"button button-dark\" type=\"button\" id=\"portal-retry\">Try again ↗</button></div>`;
};

let session = null;
let profile = null;
let isAdmin = false;
let authInitialized = false;
let authListenerRegistered = false;
let navigationChain = Promise.resolve();

function showConfigError() {
  const root = $('#app-root');
  if (!root) return;
  root.innerHTML = `<div class="portal-empty"><div class="portal-empty-mark">FD</div><h2>Account connection unavailable.</h2><p>${esc(SUPABASE_CONFIG_ERROR || 'Supabase could not be initialized.')}</p><a class="button button-dark" href="/">Back to First Draft Studio ↗</a></div>`;
}

async function getCurrentSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data?.session || null;
}

function getCurrentUser() {
  return session?.user || null;
}

async function syncAuthState(nextSession = undefined) {
  const next = nextSession === undefined ? await getCurrentSession() : nextSession;
  session = next;
  profile = session ? await getProfile(session.user) : null;
  isAdmin = session ? await checkAdmin(session.user) : false;
  setAuthNav();
  authInitialized = true;
  return session;
}

async function requireAuth() {
  if (!authInitialized) await syncAuthState();
  return !!session;
}

async function requireAdmin() {
  if (!authInitialized) await syncAuthState();
  if (session && isAdmin) return true;
  return false;
}

async function signIn(email, password) {
  if (!supabase) throw new Error(SUPABASE_CONFIG_ERROR || 'Supabase is not configured.');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await syncAuthState();
}

async function signUp({ email, password, full_name, business_name, phone }) {
  if (!supabase) throw new Error(SUPABASE_CONFIG_ERROR || 'Supabase is not configured.');
  const { data: result, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name, business_name, phone } } });
  if (error) throw error;
  if (result?.user) {
    const { error: profileError } = await supabase.from('profiles').upsert({ id: result.user.id, email, full_name: full_name || null, business_name: business_name || null, phone: phone || null }, { onConflict: 'id' });
    if (profileError) console.warn('[FDS] Profile creation:', profileError.message);
  }
  await syncAuthState(result?.session || null);
  return result;
}

async function signOut() {
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
  session = null;
  profile = null;
  isAdmin = false;
  await navigate('/');
}

async function getProfile(user) {
  if (!supabase || !user) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return data || null;
}

async function checkAdmin(user) {
  if (!supabase || !user) return false;
  const { data, error } = await supabase.from('admin_users').select('role').eq('user_id', user.id).maybeSingle();
  if (error) console.error('[FDS] admin_users authorization query failed:', { code: error.code, message: error.message, details: error.details, hint: error.hint }, error);
  return !!data;
}

function setAuthNav() {
  const trigger = $('#account-trigger');
  if (!trigger) return;
  if (!session) { trigger.innerHTML='Login <span>↗</span>'; trigger.onclick=()=>navigate('/login'); return; }
  trigger.innerHTML='Account <span>↗</span>';
  trigger.onclick=()=>navigate('/account');
}

function openAuth(mode='login') {
  const modal=$('#auth-modal'); if(!modal) return;
  modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); setAuthMode(mode);
}
function closeAuth(){ const modal=$('#auth-modal'); modal?.classList.remove('open'); modal?.setAttribute('aria-hidden','true'); }
function setAuthMode(mode){
  const signup=mode==='signup';
  $$('.auth-tab').forEach(b=>b.classList.toggle('active',b.dataset.authMode===mode));
  $('.auth-signup-only')?.classList.toggle('hidden',!signup);
  $('#auth-title').innerHTML=signup?'Start your<br /><em>client account.</em>':'Your work,<br /><em>in one place.</em>';
  $('#auth-submit').innerHTML=signup?'Create account <span>↗</span>':'Log in <span>↗</span>';
  $('#auth-status').textContent='';
}

async function handleAuth(e){
  e.preventDefault();
  const status=$('#auth-status');
  if (!supabase) { status.textContent = SUPABASE_CONFIG_ERROR || 'Supabase is not configured.'; return; }
  const mode=$('.auth-tab.active')?.dataset.authMode || 'login';
  const data=Object.fromEntries(new FormData(e.currentTarget).entries());
  status.textContent='Working…';
  try {
    if(mode==='signup'){
      const result = await signUp({email:data.email,password:data.password,full_name:data.full_name,business_name:data.business_name,phone:data.phone});
      if(result?.session){ closeAuth(); await navigate('/account'); }
      else status.textContent='Account created. Check your email to confirm it, then log in.';
    } else {
      await signIn(data.email,data.password);
      closeAuth();
      await navigate(isAdmin ? '/admin' : '/account');
    }
  } catch(err){ status.textContent=err.message || 'Something went wrong.'; }
}

async function resetPassword(){
  if(!supabase){ $('#auth-status').textContent=SUPABASE_CONFIG_ERROR || 'Supabase is not configured.'; return; }
  const email=$('#auth-form input[name="email"]')?.value;
  if(!email){ $('#auth-status').textContent='Enter your email first.'; return; }
  const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}/account`});
  $('#auth-status').textContent=error?.message || 'Password reset instructions sent.';
}

function appShell(title, subtitle, body, active='dashboard'){
  return `<div class="portal-shell"><aside class="portal-sidebar"><a class="portal-brand" href="/"><span class="brand-mark">FD</span><span><b>FIRST DRAFT</b><small>CLIENT PORTAL</small></span></a><div class="portal-nav"><a class="${active==='dashboard'?'active':''}" href="/account">Overview</a><a class="${active==='inquiries'?'active':''}" href="/account/inquiries">Inquiries</a><a class="${active==='projects'?'active':''}" href="/account/projects">Projects</a><a href="/">Back to studio ↗</a></div><button class="portal-logout" id="portal-logout">Log out</button></aside><main class="portal-main"><div class="portal-top"><div><div class="eyebrow">FIRST DRAFT / CLIENT PORTAL</div><h1>${title}</h1><p>${subtitle}</p></div><div class="portal-user">${esc(profile?.full_name||session?.user?.email||'Client')}<span>${esc(profile?.business_name||'')}</span></div></div>${body}</main></div>`;
}

function statusPill(status='New'){return `<span class="status-pill status-${status.toLowerCase().replaceAll(' ','-')}">${esc(status)}</span>`}

async function renderAccount(){
  const root=$('#app-root'); if(!root) return;
  if(!session){ root.innerHTML=appShell('Client portal','Log in to access your inquiries and projects.',`<div class="portal-empty"><div class="portal-empty-mark">FD</div><h2>Everything about your project,<br /><em>in one place.</em></h2><p>Sign in to send an inquiry, continue a conversation, and follow your project from first draft to launch.</p><button class="button button-dark" id="portal-login">Log in to continue ↗</button></div>`); $('#portal-login')?.addEventListener('click',()=>openAuth('login')); return; }
  renderPortalLoading(root,'Loading your account…');
  const [{data: inquiriesData, error: inquiriesError},{data:projectsData, error: projectsError}]=await Promise.all([
    supabase.from('inquiries').select('*').eq('customer_id',session.user.id).order('created_at',{ascending:false}),
    supabase.from('projects').select('*').eq('customer_id',session.user.id).order('created_at',{ascending:false})
  ]);
  if(inquiriesError || projectsError){ console.error('[FDS] /account data load failed:', inquiriesError || projectsError); renderPortalError(root,'Your account could not be loaded.',friendlyError(inquiriesError || projectsError)); $('#portal-retry')?.addEventListener('click',()=>renderAccount()); return; }
  const inquiries=Array.isArray(inquiriesData)?inquiriesData:[];
  const projects=Array.isArray(projectsData)?projectsData:[];
  const recent=inquiries[0];
  root.innerHTML=appShell(`Welcome back, ${esc((profile?.full_name||'there').split(' ')[0])}.`,`A clear view of where things stand with First Draft Studio.`, `<div class="portal-grid portal-stats"><div class="portal-card"><span>INQUIRIES</span><strong>${inquiries.length}</strong></div><div class="portal-card"><span>ACTIVE PROJECTS</span><strong>${projects.filter(p=>['Active','Review'].includes(p.status)).length}</strong></div><div class="portal-card"><span>RECENT STATUS</span><strong class="stat-word">${esc(recent?.status||'None')}</strong></div><div class="portal-card portal-contact-card"><span>ACCOUNT</span><strong class="stat-word">${esc(profile?.email||session.user.email||'—')}</strong><small>${esc(profile?.phone||'Phone not added')}</small></div></div><div class="portal-columns"><section class="portal-card portal-card-large"><div class="card-heading"><div><span class="eyebrow">RECENT INQUIRY</span><h2>${esc(recent?.business_name||'No inquiry yet')}</h2></div>${recent?statusPill(recent.status):''}</div>${recent?`<p class="muted">${esc(recent.business_description||'Your latest project conversation is here.')}</p><div class="detail-row"><span>Package</span><strong>${esc(recent.package||'—')}</strong></div><div class="detail-row"><span>Submitted</span><strong>${fmtDate(recent.created_at)}</strong></div><a class="text-link" href="/account/inquiries/${recent.id}">Open inquiry ↗</a>`:`<p class="muted">Tell us what you're building and we'll start the conversation.</p><button class="button button-dark" id="new-inquiry">Start an inquiry ↗</button>`}</section><section class="portal-card portal-card-large"><div class="card-heading"><div><span class="eyebrow">YOUR PROJECTS</span><h2>${projects.length?projects.length:'No'} project${projects.length===1?'':'s'}</h2></div><a class="text-link" href="/account/projects">View all ↗</a></div>${projects.slice(0,3).map(p=>`<a class="portal-list-row" href="/account/projects/${p.id}"><div><strong>${esc(p.name||p.project_name||'Project')}</strong><span>${esc(p.agreed_price?money(p.agreed_price):'Scope being finalized')}</span></div>${statusPill(p.project_status)}</a>`).join('')||'<p class="muted">Projects appear here once an inquiry is confirmed.</p>'}</section></div>`,'dashboard');
  $('#new-inquiry')?.addEventListener('click',()=>navigate('/account/new-inquiry'));
}

async function renderInquiries(){
  const root=$('#app-root'); if(!root) return;
  if(!session){ await navigate('/login'); return; }
  renderPortalLoading(root,'Loading your inquiries…');
  const {data: inquiries=[],error}=await supabase.from('inquiries').select('*').eq('customer_id',session.user.id).order('created_at',{ascending:false});
  if(error){ console.error('[FDS] /account/inquiries query failed:',error); renderPortalError(root,'Your inquiries could not be loaded.',friendlyError(error)); $('#portal-retry')?.addEventListener('click',()=>renderInquiries()); return; }
  root.innerHTML=appShell('Your inquiries','Every conversation, package, and status update in one place.',`<div class="portal-card portal-card-large"><div class="table-head"><span>BUSINESS</span><span>PACKAGE</span><span>STATUS</span><span>SUBMITTED</span></div>${inquiries.map(i=>`<a class="portal-table-row" href="/account/inquiries/${i.id}"><span><strong>${esc(i.business_name||'Untitled')}</strong><small>${esc(i.business_type||'Business website')}</small></span><span>${esc(i.package||'—')}${i.online_ordering?' + online ordering':''}</span><span>${statusPill(i.status)}</span><span>${fmtDate(i.created_at)}</span></a>`).join('')||'<div class="portal-empty small"><h2>No inquiries yet.</h2><p>Your first project conversation will appear here.</p><a class="button button-dark" href="/#contact">Start an inquiry ↗</a></div>'}</div>`,'inquiries');
}

async function renderInquiryDetail(id){
  const root=$('#app-root'); if(!root||!session) return renderAccount();
  renderPortalLoading(root,'Loading inquiry…');
  const {data:i,error}=await supabase.from('inquiries').select('*').eq('id',id).eq('customer_id',session.user.id).maybeSingle();
  if(error){ renderPortalError(root,'This inquiry could not be loaded.',friendlyError(error)); $('#portal-retry')?.addEventListener('click',()=>renderInquiryDetail(id)); return; }
  if(!i){ root.innerHTML=appShell('Inquiry not found','We could not find that inquiry.',`<div class="portal-empty small"><h2>This inquiry isn't available.</h2><a class="text-link" href="/account/inquiries">Back to inquiries ↗</a></div>`,'inquiries'); return; }
  const {data:messages=[],error:messagesError}=await supabase.from('inquiry_messages').select('*').eq('inquiry_id',id).order('created_at',{ascending:true});
  if(messagesError){ console.error('[FDS] inquiry messages load failed:',messagesError); renderPortalError(root,'The conversation could not be loaded.',friendlyError(messagesError)); $('#portal-retry')?.addEventListener('click',()=>renderInquiryDetail(id)); return; }
  root.innerHTML=appShell(esc(i.business_name||'Project inquiry'),`Inquiry ${esc(String(i.id).slice(0,8))} · submitted ${fmtDate(i.created_at)}`,`<div class="detail-toolbar"><a class="text-link" href="/account/inquiries">← All inquiries</a>${statusPill(i.status)}</div><div class="portal-columns inquiry-layout"><section class="portal-card portal-card-large"><div class="eyebrow">PROJECT BRIEF</div><div class="detail-grid"><div><span>Package</span><strong>${esc(i.package||'—')}</strong></div><div><span>Online ordering</span><strong>${i.online_ordering?'Yes · +₹1,000':'Not requested'}</strong></div><div><span>Business type</span><strong>${esc(i.business_type||'—')}</strong></div><div><span>Last updated</span><strong>${fmtDate(i.updated_at||i.created_at)}</strong></div></div><hr><h3>What you're building</h3><p>${esc(i.business_description||'No description provided.')}</p><h3>Goals</h3><p>${esc(i.website_goals||'No goals provided.')}</p><h3>Requirements</h3><p>${esc(i.requirements||'No additional requirements provided.')}</p></section><section class="portal-card portal-card-large"><div class="eyebrow">CONVERSATION</div><div class="message-thread">${messages.map(m=>`<div class="message ${m.sender_id===session.user.id?'mine':''}"><div>${esc(m.message||'')}</div><span>${m.sender_id===session.user.id?'You':'First Draft Studio'} · ${fmtDate(m.created_at)}</span></div>`).join('')||'<p class="muted">No messages yet. Your conversation will appear here.</p>'}</div><form id="message-form" class="message-form"><textarea name="message" placeholder="Write a message to First Draft Studio…" required></textarea><button class="button button-dark" type="submit">Send message ↗</button></form></section></div>`,'inquiries');
  $('#message-form')?.addEventListener('submit',async e=>{e.preventDefault();const message=new FormData(e.currentTarget).get('message');const {error}=await supabase.from('inquiry_messages').insert({inquiry_id:id,sender_id:session.user.id,sender_role:'customer',message});if(error)toast(friendlyError(error),'error');else{toast('Message sent');await renderInquiryDetail(id)}});
}

async function renderProjects(){
  const root=$('#app-root'); if(!root||!session) return renderAccount();
  renderPortalLoading(root,'Loading your projects…');
  const {data:projects=[],error}=await supabase.from('projects').select('*').eq('customer_id',session.user.id).order('created_at',{ascending:false});
  if(error){ console.error('[FDS] /account/projects query failed:',error); renderPortalError(root,'Your projects could not be loaded.',friendlyError(error)); $('#portal-retry')?.addEventListener('click',()=>renderProjects()); return; }
  root.innerHTML=appShell('Your projects','Follow active builds, reviews, and completed work.',`<div class="project-portal-grid">${projects.map(p=>`<a class="portal-card project-portal-card" href="/account/projects/${p.id}"><div class="project-index">PROJECT / ${esc(String(p.id).slice(0,6))}</div><h2>${esc(p.name||p.project_name||'Website project')}</h2><div class="project-meta">${statusPill(p.project_status)}<span>${p.agreed_price?money(p.agreed_price):'Scope being finalized'}</span></div><div class="project-line"><span>Start</span><strong>${fmtDate(p.start_date)}</strong></div><div class="project-line"><span>Completion</span><strong>${fmtDate(p.completion_date)}</strong></div></a>`).join('')||'<div class="portal-empty small"><h2>No projects yet.</h2><p>A project will appear once your inquiry is confirmed and work begins.</p></div>'}</div>`,'projects');
}

async function renderProjectDetail(id){
  const root=$('#app-root'); if(!root||!session) return renderAccount();
  renderPortalLoading(root,'Loading project…');
  const {data:p,error}=await supabase.from('projects').select('*').eq('id',id).eq('customer_id',session.user.id).maybeSingle();
  if(error){ console.error('[FDS] project load failed:',error); renderPortalError(root,'This project could not be loaded.',friendlyError(error)); $('#portal-retry')?.addEventListener('click',()=>renderProjectDetail(id)); return; }
  if(!p){ await renderProjects(); return; }
  const stages=['Pending','Active','Review','Completed']; const current=stages.indexOf(p.status);
  root.innerHTML=appShell(esc(p.name||p.project_name||'Website project'),`Project ${esc(String(p.id).slice(0,8))} · ${p.agreed_price?money(p.agreed_price):'Scope being finalized'}`,`<div class="detail-toolbar"><a class="text-link" href="/account/projects">← All projects</a>${statusPill(p.project_status)}</div><section class="portal-card project-detail-card"><div class="project-timeline">${stages.map((s,idx)=>`<div class="timeline-step ${idx<=current?'done':''} ${idx===current?'current':''}"><span>${idx<current?'✓':String(idx+1).padStart(2,'0')}</span><strong>${s}</strong></div>`).join('')}</div><div class="project-detail-copy"><div><span>START DATE</span><strong>${fmtDate(p.start_date)}</strong></div><div><span>COMPLETION</span><strong>${fmtDate(p.completion_date)}</strong></div><div><span>AGREED PRICE</span><strong>${p.agreed_price?money(p.agreed_price):'—'}</strong></div></div><hr><div class="eyebrow">CUSTOMER UPDATES</div><p>${esc(p.customer_updates||'Your project updates will appear here as the work progresses.')}</p></section>`,'projects');
}

async function renderNewInquiry(){
  const root=$('#app-root'); if(!root||!session) return renderAccount();
  root.innerHTML=appShell('Start a new inquiry','Tell us what you want to build. This starts a conversation, not a purchase.',`<section class="portal-card portal-card-large inquiry-form-card"><form id="portal-inquiry-form" class="portal-form"><div class="form-grid"><label>Full name<input name="name" value="${esc(profile?.full_name||'')}" required></label><label>Business name<input name="business_name" value="${esc(profile?.business_name||'')}" required></label><label>Phone<input name="phone" value="${esc(profile?.phone||'')}" required></label><label>Email<input name="email" value="${esc(session.user.email||profile?.email||'')}" required type="email"></label><label>Business type<select name="business_type"><option>Business website</option><option>Online store</option><option>Custom website</option></select></label><label>Package<select name="package"><option>₹3,000</option><option>₹5,000</option><option>₹10,000</option><option>₹20,000</option></select></label></div><label>What does your business do?<textarea name="business_description" required></textarea></label><label>What should the website achieve?<textarea name="website_goals" required></textarea></label><label>Requirements / things you'd like included<textarea name="requirements"></textarea></label><label class="check-line"><input type="checkbox" name="online_ordering"> Customers should be able to order online <span>+₹1,000</span></label><button class="button button-dark" type="submit">Send inquiry ↗</button><p class="form-inline-status" id="inquiry-status"></p></form></section>`,'inquiries');
  $('#portal-inquiry-form')?.addEventListener('submit',async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget).entries());const payload={user_id:session.user.id,full_name:d.name,business_name:d.business_name,phone:d.phone,email:d.email,business_type:d.business_type,business_description:d.business_description,website_goals:d.website_goals,requirements:d.requirements,package:d.package,online_ordering:d.online_ordering==='on',status:'New'};const {data,error}=await supabase.from('inquiries').insert(payload).select().single();if(error){$('#inquiry-status').textContent=friendlyError(error);return} toast('Inquiry received. We’ll be in touch.'); navigate(`/account/inquiries/${data.id}`);});
}

function adminShell(title,subtitle,body,active='dashboard'){
  const nav=(key,label,path)=>`<a class="${active===key?'active':''}" href="${path}">${label}</a>`;
  return `<div class="portal-shell admin-shell"><aside class="portal-sidebar"><a class="portal-brand" href="/"><span class="brand-mark">FD</span><span><b>FIRST DRAFT</b><small>STUDIO / ADMIN</small></span></a><div class="portal-nav">${nav('dashboard','Dashboard','/admin')}${nav('customers','Customers','/admin/customers')}${nav('inquiries','Inquiries','/admin/inquiries')}${nav('projects','Projects','/admin/projects')}<a href="/">Back to studio ↗</a></div><button class="portal-logout" id="portal-logout">Log out</button></aside><main class="portal-main"><div class="portal-top"><div><div class="eyebrow">FIRST DRAFT / ADMIN</div><h1>${title}</h1><p>${subtitle}</p></div><div class="portal-user">Owner access<span>Internal workspace</span></div></div>${body}</main></div>`;
}

async function renderAdmin(){
  const root=$('#app-root'); if(!root) return;
  if(!session||!isAdmin){root.innerHTML=adminShell('Restricted area','This workspace is available to authorized First Draft Studio admins.',`<div class="portal-empty"><div class="portal-empty-mark">FD</div><h2>Admin access only.</h2><p>Sign in with an authorized studio account to continue.</p><a class="button button-dark" href="/login">Log in ↗</a></div>`);return;}
  renderPortalLoading(root,'Loading studio overview…');
  const dashboardQueries = [
    { name: 'profiles customer count', run: () => supabase.from('profiles').select('*',{count:'exact',head:true}) },
    { name: 'inquiries total count', run: () => supabase.from('inquiries').select('*',{count:'exact',head:true}) },
    { name: 'inquiries New count', run: () => supabase.from('inquiries').select('*',{count:'exact',head:true}).eq('status','new') },
    { name: 'inquiries Discussing count', run: () => supabase.from('inquiries').select('*',{count:'exact',head:true}).eq('status','discussing') },
    { name: 'projects total count', run: () => supabase.from('projects').select('*',{count:'exact',head:true}) },
    { name: 'projects Active/Review count', run: () => supabase.from('projects').select('*',{count:'exact',head:true}).in('project_status',['active','review']) },
    { name: 'projects Completed count', run: () => supabase.from('projects').select('*',{count:'exact',head:true}).eq('project_status','completed') },
    { name: 'recent inquiries (created_at desc, limit 6)', run: () => supabase.from('inquiries').select('*').order('created_at',{ascending:false}).limit(6) }
  ];
  const results = await Promise.all(dashboardQueries.map(async query => {
    try {
      const result = await query.run();
      if (result.error) console.error('[FDS] ADMIN DASHBOARD QUERY ERROR:', { query: query.name, code: result.error.code, message: result.error.message, details: result.error.details, hint: result.error.hint }, result.error);
      return { ...result, queryName: query.name };
    } catch (error) {
      console.error('[FDS] ADMIN DASHBOARD QUERY THREW:', { query: query.name, message: error?.message, code: error?.code, details: error?.details, hint: error?.hint }, error);
      return { error, queryName: query.name };
    }
  }));
  const failedResult=results.find(r=>r.error);
  const loadError=failedResult?.error;
  if(loadError){ console.error('[FDS] /admin first failing dashboard query:', failedResult.queryName); renderPortalError(root,'The studio overview could not be loaded.',friendlyError(loadError)); $('#portal-retry')?.addEventListener('click',()=>renderAdmin()); return; }
  const [{count:customers},{count:inquiries},{count:newInquiries},{count:discussing},{count:projects},{count:activeProjects},{count:completedProjects},{data:recentInquiries=[]}]=results;
  root.innerHTML=adminShell('Studio overview','A clear operating view of customers, inquiries, and active work.',`<div class="portal-grid portal-stats admin-stats"><div class="portal-card"><span>CUSTOMERS</span><strong>${customers||0}</strong></div><div class="portal-card"><span>INQUIRIES</span><strong>${inquiries||0}</strong></div><div class="portal-card"><span>NEW</span><strong>${newInquiries||0}</strong></div><div class="portal-card"><span>DISCUSSING</span><strong>${discussing||0}</strong></div><div class="portal-card"><span>ACTIVE PROJECTS</span><strong>${activeProjects||0}</strong></div><div class="portal-card"><span>COMPLETED</span><strong>${completedProjects||0}</strong></div></div><section class="portal-card portal-card-large"><div class="card-heading"><div><span class="eyebrow">RECENT INQUIRIES</span><h2>Latest conversations</h2></div><a class="text-link" href="/admin/inquiries">View all ↗</a></div><div class="admin-list">${recentInquiries.map(i=>`<a class="portal-table-row" href="/admin/inquiries/${i.id}"><span><strong>${esc(i.business_name||'Untitled')}</strong><small>${esc(i.full_name||i.email||'')}</small></span><span>${esc(i.package||'—')}</span><span>${statusPill(i.status)}</span><span>${fmtDate(i.created_at)}</span></a>`).join('')||'<p class="muted">No inquiries yet.</p>'}</div></section>`,'dashboard');
}

async function renderAdminInquiries(){
  const root=$('#app-root'); if(!root||!isAdmin)return renderAdmin();
  const filter=new URLSearchParams(location.search).get('status'); let q=supabase.from('inquiries').select('*').order('created_at',{ascending:false}); if(filter)q=q.eq('status',filter); renderPortalLoading(root,'Loading inquiries…'); const {data=[],error}=await q; if(error){ console.error('[FDS] /admin/inquiries query failed:',error); renderPortalError(root,'Inquiries could not be loaded.',friendlyError(error)); $('#portal-retry')?.addEventListener('click',()=>renderAdminInquiries()); return; }
  root.innerHTML=adminShell('Inquiries','Review every incoming project conversation and move it forward.',`<div class="filter-row"><a class="filter ${!filter?'active':''}" href="/admin/inquiries">All</a>${['New','Contacted','Discussing','Confirmed','In Progress','Completed','Lost'].map(s=>`<a class="filter ${filter===s?'active':''}" href="/admin/inquiries?status=${encodeURIComponent(s)}">${s}</a>`).join('')}</div><div class="portal-card portal-card-large"><div class="table-head"><span>BUSINESS</span><span>PACKAGE</span><span>STATUS</span><span>CREATED</span></div>${data.map(i=>`<a class="portal-table-row" href="/admin/inquiries/${i.id}"><span><strong>${esc(i.business_name||'Untitled')}</strong><small>${esc(i.full_name||i.email||'')}</small></span><span>${esc(i.package||'—')}</span><span>${statusPill(i.status)}</span><span>${fmtDate(i.created_at)}</span></a>`).join('')||'<p class="muted">No inquiries match this filter.</p>'}</div>`,'inquiries');
}

async function renderAdminInquiry(id){
  const root=$('#app-root'); if(!root||!isAdmin)return renderAdmin();
  renderPortalLoading(root,'Loading inquiry…');
  const {data:i,error}=await supabase.from('inquiries').select('*').eq('id',id).maybeSingle(); if(error){ console.error('[FDS] /admin/inquiries/:id load failed:',error); renderPortalError(root,'This inquiry could not be loaded.',friendlyError(error)); $('#portal-retry')?.addEventListener('click',()=>renderAdminInquiry(id)); return; } if(!i){ await renderAdminInquiries(); return; }
  const [{data:messages=[],error:messagesError},{data:notes=[],error:notesError}]=await Promise.all([supabase.from('inquiry_messages').select('*').eq('inquiry_id',id).order('created_at',{ascending:true}),supabase.from('internal_notes').select('*').eq('inquiry_id',id).order('created_at',{ascending:false})]);
  if(messagesError || notesError){ const loadError=messagesError || notesError; console.error('[FDS] admin inquiry related data load failed:',loadError); renderPortalError(root,'Inquiry workspace data could not be loaded.',friendlyError(loadError)); $('#portal-retry')?.addEventListener('click',()=>renderAdminInquiry(id)); return; }
  root.innerHTML=adminShell(esc(i.business_name||'Inquiry'),`${esc(i.full_name||i.email||'Customer')} · ${fmtDate(i.created_at)}`,`<div class="detail-toolbar"><a class="text-link" href="/admin/inquiries">← All inquiries</a>${statusPill(i.status)}</div><div class="portal-columns inquiry-layout"><section class="portal-card portal-card-large"><div class="eyebrow">INQUIRY DETAILS</div><div class="detail-grid"><div><span>Customer</span><strong>${esc(i.full_name||'—')}</strong></div><div><span>Email</span><strong>${esc(i.email||'—')}</strong></div><div><span>Phone</span><strong>${esc(i.phone||'—')}</strong></div><div><span>Package</span><strong>${esc(i.package||'—')}</strong></div><div><span>Online ordering</span><strong>${i.online_ordering?'Yes · +₹1,000':'No'}</strong></div><div><span>Business type</span><strong>${esc(i.business_type||'—')}</strong></div></div><hr><h3>Business</h3><p>${esc(i.business_description||'—')}</p><h3>Goals</h3><p>${esc(i.website_goals||'—')}</p><h3>Requirements</h3><p>${esc(i.requirements||'—')}</p><div class="admin-actions"><label>Status<select id="admin-status"><option ${i.status==='New'?'selected':''}>New</option><option ${i.status==='Contacted'?'selected':''}>Contacted</option><option ${i.status==='Discussing'?'selected':''}>Discussing</option><option ${i.status==='Confirmed'?'selected':''}>Confirmed</option><option ${i.status==='In Progress'?'selected':''}>In Progress</option><option ${i.status==='Completed'?'selected':''}>Completed</option><option ${i.status==='Lost'?'selected':''}>Lost</option></select></label><button class="button button-dark" id="save-status">Save status</button><button class="button button-outline" id="convert-project">Convert to project</button></div></section><section class="portal-card portal-card-large"><div class="eyebrow">CUSTOMER CONVERSATION</div><div class="message-thread">${messages.map(m=>`<div class="message ${m.sender_id===session.user.id?'mine':''}"><div>${esc(m.message||'')}</div><span>${m.sender_id===session.user.id?'You':'Customer'} · ${fmtDate(m.created_at)}</span></div>`).join('')||'<p class="muted">No messages yet.</p>'}</div><form id="admin-message-form" class="message-form"><textarea name="message" placeholder="Reply to the customer…" required></textarea><button class="button button-dark">Send reply ↗</button></form><hr><div class="eyebrow">INTERNAL NOTES</div><div class="notes-list">${notes.map(n=>`<div class="note"><p>${esc(n.note)}</p><span>${fmtDate(n.created_at)}</span></div>`).join('')||'<p class="muted">No internal notes.</p>'}</div><form id="note-form" class="note-form"><textarea name="note" placeholder="Private note for the studio…" required></textarea><button class="button button-outline">Add note</button></form></section></div>`,'inquiries');
  $('#save-status')?.addEventListener('click',async()=>{const status=$('#admin-status').value;const {error}=await supabase.from('inquiries').update({status,updated_at:new Date().toISOString()}).eq('id',id);if(error)toast(friendlyError(error),'error');else{toast('Status updated');await renderAdminInquiry(id)}});
  $('#admin-message-form')?.addEventListener('submit',async e=>{e.preventDefault();const message=new FormData(e.currentTarget).get('message');const {error}=await supabase.from('inquiry_messages').insert({inquiry_id:id,sender_id:session.user.id,sender_role:'admin',message});if(error)toast(friendlyError(error),'error');else{toast('Reply sent');await renderAdminInquiry(id)}});
  $('#note-form')?.addEventListener('submit',async e=>{e.preventDefault();const note=new FormData(e.currentTarget).get('note');const {error}=await supabase.from('internal_notes').insert({inquiry_id:id,admin_id:session.user.id,note});if(error)toast(friendlyError(error),'error');else{toast('Internal note added');await renderAdminInquiry(id)}});
  $('#convert-project')?.addEventListener('click',async()=>{const {error}=await supabase.from('projects').insert({inquiry_id:id,customer_id:i.customer_id,agreed_price:i.package_price||null,project_status:'pending'});if(error)toast(friendlyError(error),'error');else{await supabase.from('inquiries').update({status:'Confirmed',updated_at:new Date().toISOString()}).eq('id',id);toast('Project created');navigate('/admin/projects')}});
}

async function renderAdminCustomers(){
  const root=$('#app-root'); if(!root||!isAdmin)return renderAdmin(); renderPortalLoading(root,'Loading customers…'); const {data=[],error}=await supabase.from('profiles').select('*').order('created_at',{ascending:false}); if(error){ console.error('[FDS] /admin/customers query failed:',error); renderPortalError(root,'Customers could not be loaded.',friendlyError(error)); $('#portal-retry')?.addEventListener('click',()=>renderAdminCustomers()); return; }
  root.innerHTML=adminShell('Customers','The people behind the businesses you are helping online.',`<div class="portal-card portal-card-large"><div class="table-head"><span>CUSTOMER</span><span>BUSINESS</span><span>CONTACT</span><span>JOINED</span></div>${data.map(c=>`<div class="portal-table-row"><span><strong>${esc(c.full_name||'Unnamed')}</strong><small>${esc(c.email||'')}</small></span><span>${esc(c.business_name||'—')}</span><span>${esc(c.phone||'—')}</span><span>${fmtDate(c.created_at)}</span></div>`).join('')||'<p class="muted">No customers yet.</p>'}</div>`,'customers');
}

async function renderAdminProjects(){
  const root=$('#app-root'); if(!root||!isAdmin)return renderAdmin(); renderPortalLoading(root,'Loading projects…'); const {data=[],error}=await supabase.from('projects').select('*').order('created_at',{ascending:false}); if(error){ console.error('[FDS] /admin/projects query failed:',error); renderPortalError(root,'Projects could not be loaded.',friendlyError(error)); $('#portal-retry')?.addEventListener('click',()=>renderAdminProjects()); return; }
  root.innerHTML=adminShell('Projects','Keep confirmed work moving from first draft to launch.',`<div class="project-portal-grid">${data.map(p=>`<a class="portal-card project-portal-card" href="/admin/projects/${p.id}"><div class="project-index">PROJECT / ${esc(String(p.id).slice(0,6))}</div><h2>${esc(p.name||p.project_name||'Website project')}</h2><div class="project-meta">${statusPill(p.project_status)}<span>${p.agreed_price?money(p.agreed_price):'—'}</span></div><div class="project-line"><span>Start</span><strong>${fmtDate(p.start_date)}</strong></div><div class="project-line"><span>Completion</span><strong>${fmtDate(p.completion_date)}</strong></div></a>`).join('')||'<p class="muted">No projects yet.</p>'}</div>`,'projects');
}

async function renderAdminProject(id){
  const root=$('#app-root'); if(!root||!isAdmin)return renderAdmin(); renderPortalLoading(root,'Loading project…'); const {data:p,error}=await supabase.from('projects').select('*').eq('id',id).maybeSingle(); if(error){ console.error('[FDS] /admin/projects/:id load failed:',error); renderPortalError(root,'This project could not be loaded.',friendlyError(error)); $('#portal-retry')?.addEventListener('click',()=>renderAdminProject(id)); return; } if(!p)return renderAdminProjects();
  root.innerHTML=adminShell(esc(p.name||p.project_name||'Project'),`Project ${esc(String(p.id).slice(0,8))}`,`<div class="detail-toolbar"><a class="text-link" href="/admin/projects">← All projects</a></div><section class="portal-card project-detail-card"><div class="form-grid"><label>Project name<input id="p-name" value="${esc(p.name||p.project_name||'')}" /></label><label>Agreed price<input id="p-price" type="number" value="${esc(p.agreed_price||'')}" /></label><label>Status<select id="p-status">${['Pending','Active','Review','Completed','Cancelled'].map(s=>`<option value="${s.toLowerCase()}" ${p.project_status===s.toLowerCase()?'selected':''}>${s}</option>`).join('')}</select></label><label>Start date<input id="p-start" type="date" value="${p.start_date||''}" /></label><label>Completion date<input id="p-end" type="date" value="${p.completion_date||''}" /></label></div><label>Customer-visible updates<textarea id="p-updates">${esc(p.customer_updates||'')}</textarea></label><button class="button button-dark" id="save-project">Save project ↗</button></section>`,'projects');
  $('#save-project')?.addEventListener('click',async()=>{const payload={agreed_price:$('#p-price').value?Number($('#p-price').value):null,project_status:String($('#p-status').value).toLowerCase(),start_date:$('#p-start').value||null,completion_date:$('#p-end').value||null,updated_at:new Date().toISOString()};const {error}=await supabase.from('projects').update(payload).eq('id',id);if(error)toast(friendlyError(error),'error');else toast('Project saved');});
}

async function renderAuthPage(mode='login'){
  const root=$('#app-root'); if(!root) return;
  const title=mode==='signup'?'Create your\nclient account.':mode==='reset'?'Reset your\npassword.':'Welcome\nback.';
  const intro=mode==='signup'?'Create an account to send inquiries, follow conversations, and track projects.':mode==='reset'?'Enter your email and we’ll send you a secure password reset link.':'Log in to manage inquiries, conversations, and projects with First Draft Studio.';
  const submit=mode==='signup'?'Create account ↗':mode==='reset'?'Send reset link ↗':'Log in ↗';
  const extra=mode==='signup'?`<div class="form-grid"><label>Full name<input name="full_name" autocomplete="name" required></label><label>Business name<input name="business_name" autocomplete="organization"></label><label>Phone<input name="phone" autocomplete="tel"></label></div>`:'';
  const password=mode==='reset'?'':`<label>Password<input type="password" name="password" autocomplete="${mode==='signup'?'new-password':'current-password'}" minlength="6" required></label>`;
  root.innerHTML=`<div class="auth-page"><div class="auth-page-inner"><a class="portal-brand" href="/"><span class="brand-mark">FD</span><span><b>FIRST DRAFT</b><small>STUDIO</small></span></a><div class="auth-page-grid"><div class="auth-page-copy"><div class="eyebrow">FIRST DRAFT / ACCOUNT</div><h1>${title.replace(/\n/g,'<br>')}</h1><p>${intro}</p><div class="auth-page-note">CLIENT PORTAL<br><span>Inquiries · Conversations · Projects</span></div></div><section class="auth-page-card"><div class="auth-tabs"><button class="auth-tab ${mode!=='signup'?'active':''}" data-page-auth="login">Log in</button><button class="auth-tab ${mode==='signup'?'active':''}" data-page-auth="signup">Create account</button></div><form id="page-auth-form" class="auth-form">${extra}<label>Email<input type="email" name="email" autocomplete="email" required></label>${password}<button class="button button-dark" type="submit">${submit}</button>${mode==='login'?'<a class="auth-reset" href="/forgot-password">Forgot your password?</a>':''}<p class="form-inline-status" id="page-auth-status" aria-live="polite"></p></form></section></div><a class="text-link auth-back" href="/">← Back to First Draft Studio</a></div></div>`;
  $$('[data-page-auth]').forEach(btn=>btn.addEventListener('click',()=>navigate(btn.dataset.pageAuth==='signup'?'/signup':'/login')));
  $('#page-auth-form')?.addEventListener('submit',async e=>{
    e.preventDefault(); const data=Object.fromEntries(new FormData(e.currentTarget).entries()); const status=$('#page-auth-status'); status.textContent='Working…';
    if(!supabase){status.textContent=SUPABASE_CONFIG_ERROR || 'Supabase is not configured.';return;}
    try{
      if(mode==='reset'){
        const {error}=await supabase.auth.resetPasswordForEmail(data.email,{redirectTo:`${location.origin}/login`}); if(error) throw error; status.textContent='Reset instructions sent. Check your email.'; return;
      }
      if(mode==='signup'){
        const r=await signUp({email:data.email,password:data.password,full_name:data.full_name,business_name:data.business_name,phone:data.phone});
        if(r.session) await navigate('/account'); else status.textContent='Account created. Check your email to confirm it, then log in.';
      } else {
        await signIn(data.email,data.password);
        await navigate(isAdmin ? '/admin' : '/account');
      }
    }catch(err){status.textContent=friendlyError(err);}
  });
}


function renderPublicHomepage(routePath='/'){
  const root=$('#app-root');
  const template=document.querySelector('#public-home-template');
  if(!root||!template) return;
  root.replaceChildren(template.content.cloneNode(true));
  window.__FDS_ACTIVE_ROUTE_VIEW__='public';
  setAuthNav();
  window.dispatchEvent(new CustomEvent('fds:route-rendered',{detail:{path:routePath}}));
}

async function route(){
  const path=getRoute();
  try {
    if (!supabase && path !== '/') { showConfigError(); return; }
    if(path==='/') return renderPublicHomepage('/');
    if(['/pricing','/work','/process','/about','/faq','/contact'].includes(path)){
      renderPublicHomepage(path);
      const id=path.slice(1);
      requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'}));
      return;
    }
    if(path==='/login'){ if(session){ history.replaceState({},'',isAdmin?'/admin':'/account'); return route(); } return renderAuthPage('login'); }
    if(path==='/signup'){ if(session){ history.replaceState({},'',isAdmin?'/admin':'/account'); return route(); } return renderAuthPage('signup'); }
    if(path==='/forgot-password'){ if(session){ history.replaceState({},'',isAdmin?'/admin':'/account'); return route(); } return renderAuthPage('reset'); }
    if(path==='/account'){ if(!(await requireAuth())){ history.replaceState({},'','/login'); return renderAuthPage('login'); } return renderAccount(); }
    if(path==='/account/inquiries'){ if(!(await requireAuth())){ history.replaceState({},'','/login'); return renderAuthPage('login'); } return renderInquiries(); }
    if(path==='/account/projects'){ if(!(await requireAuth())){ history.replaceState({},'','/login'); return renderAuthPage('login'); } return renderProjects(); }
    if(path==='/account/new-inquiry'){ if(!(await requireAuth())){ history.replaceState({},'','/login'); return renderAuthPage('login'); } return renderNewInquiry(); }
    if(path.startsWith('/account/inquiries/')){ if(!(await requireAuth())){ history.replaceState({},'','/login'); return renderAuthPage('login'); } return renderInquiryDetail(path.split('/').pop()); }
    if(path.startsWith('/account/projects/')){ if(!(await requireAuth())){ history.replaceState({},'','/login'); return renderAuthPage('login'); } return renderProjectDetail(path.split('/').pop()); }
    if(path==='/admin' || path==='/admin/'){ if(!(await requireAdmin())) return renderAdminGate(); return renderAdmin(); }
    if(path==='/admin/customers'){ if(!(await requireAdmin())) return renderAdminGate(); return renderAdminCustomers(); }
    if(path==='/admin/inquiries'){ if(!(await requireAdmin())) return renderAdminGate(); return renderAdminInquiries(); }
    if(path.startsWith('/admin/inquiries/')){ if(!(await requireAdmin())) return renderAdminGate(); return renderAdminInquiry(path.split('/').pop()); }
    if(path==='/admin/projects'){ if(!(await requireAdmin())) return renderAdminGate(); return renderAdminProjects(); }
    if(path.startsWith('/admin/projects/')){ if(!(await requireAdmin())) return renderAdminGate(); return renderAdminProject(path.split('/').pop()); }
    renderPublicHomepage('/');
  } catch (error) {
    console.error(`[FDS] Route render failed for ${path}:`, error);
    const root=$('#app-root');
    if(root) root.innerHTML=`<div class="portal-empty"><div class="portal-empty-mark">FD</div><h2>We hit a loading error.</h2><p>${esc(error?.message||'The page could not be rendered.')}</p><a class="button button-dark" href="/">Back to First Draft Studio ↗</a></div>`;
  }
}

async function navigate(path,{replace=false,scroll=true}={}){
  navigationChain = navigationChain.then(async()=>{
    const url=new URL(path,window.location.origin);
    const target=`${url.pathname}${url.search}${url.hash}`;
    const current=`${window.location.pathname}${window.location.search}${window.location.hash}`;
    if(target!==current){
      if(replace) history.replaceState({},'',target); else history.pushState({},'',target);
    }
    await route();
    if(scroll) window.scrollTo(0,0);
    if(url.hash && getRoute()==='/') requestAnimationFrame(()=>document.querySelector(url.hash)?.scrollIntoView({behavior:'smooth',block:'start'}));
  }).catch(error=>console.error('[FDS] Navigation failed:',error));
  return navigationChain;
}

function renderAdminGate(){
  const root=$('#app-root'); if(!root) return;
  if(!session){
    root.innerHTML=adminShell('Admin access','Sign in with an authorized First Draft Studio account.',`<div class="portal-empty"><div class="portal-empty-mark">FD</div><h2>Admin access only.</h2><p>Log in with your studio admin account to continue.</p><a class="button button-dark" href="/login">Log in ↗</a></div>`);
    return;
  }
  root.innerHTML=adminShell('Access restricted','This account is not authorized for the First Draft Studio admin workspace.',`<div class="portal-empty"><div class="portal-empty-mark">FD</div><h2>You don’t have admin access.</h2><p>Your account is signed in correctly, but it is not listed in the studio admin users.</p><a class="button button-dark" href="/account">Go to your account ↗</a></div>`);
}

async function refresh(){
  if(!supabase){
    setAuthNav();
    if(getRoute()!=='/') showConfigError();
    return;
  }
  await syncAuthState();
  await route();
}

function wire(){
  // All internal navigation is delegated from the document, so handlers survive route replacement.
  document.addEventListener('click',async e=>{
    const logout=e.target.closest('#portal-logout');
    if(logout){ e.preventDefault(); await signOut(); return; }
    const a=e.target.closest('a[href]');
    if(!a || a.target==='_blank' || a.hasAttribute('download')) return;
    const href=a.getAttribute('href');
    if(!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || /^[a-z][a-z0-9+.-]*:/i.test(href)) return;
    const url=new URL(href,window.location.origin);
    if(url.origin!==window.location.origin) return;
    const internal=/^(\/|\/login|\/signup|\/forgot-password|\/account(?:\/|$)|\/admin(?:\/|$)|\/pricing$|\/work$|\/process$|\/about$|\/faq$|\/contact$)/.test(url.pathname);
    if(!internal) return;
    e.preventDefault();
    await navigate(`${url.pathname}${url.search}${url.hash}`);
  });
  window.addEventListener('popstate',()=>route());
  if(supabase && !authListenerRegistered){
    authListenerRegistered=true;
    supabase.auth.onAuthStateChange((event,nextSession)=>{
      queueMicrotask(async()=>{
        try{
          await syncAuthState(nextSession);
          if(authInitialized) await route();
        }catch(error){ console.error('[FDS] Auth state update failed:',error); }
      });
    });
  }
}

async function bootstrap(){
  wire();
  if(SUPABASE_CONFIG_ERROR){
    console.error('[FDS] Supabase configuration error:',SUPABASE_CONFIG_ERROR);
  }
  await refresh();
}

bootstrap().catch(error=>{ console.error('[FDS] Bootstrap failed:',error); const root=$('#app-root'); if(root) root.innerHTML=`<div class="portal-empty"><h2>Application startup failed.</h2><p>${esc(error?.message||'Unknown startup error')}</p></div>`; });

// Public inquiry form -> Supabase when a customer is authenticated.
document.addEventListener('submit', async (event) => {
  const form = event.target.closest('#inquiry-form');
  if (!form || !session || !supabase) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const data = Object.fromEntries(new FormData(form).entries());
  const packageValue = data.package || data['package'] || '';
  const payload = {
    customer_id: session.user.id,
    business_type: data.type || null,
    business_description: data.description || data.business_description || null,
    website_goals: data.goals || data.website_goals || null,
    requirements: data.requirements || data.message || null,
    package_price: Number(String(packageValue).replace(/[^0-9]/g, '')) || null,
    online_ordering: data.online_ordering === 'on' || data.online_ordering === 'true'
  };
  const success = form.parentElement?.querySelector('.form-success') || $('.form-success');
  const submit = form.querySelector('button[type="submit"]');
  if(submit) submit.disabled=true;
  const {data: inserted,error}=await supabase.from('inquiries').insert(payload).select().single();
  if(submit) submit.disabled=false;
  if(error){ toast(error.message,'error'); return; }
  if(success){success.classList.add('show'); const strong=success.querySelector('strong'); const span=success.querySelector('span'); if(strong)strong.textContent='Inquiry received.'; if(span)span.textContent='Thanks. Your project conversation is now in your client portal.';}
  toast('Inquiry received.');
  setTimeout(()=>{if(inserted?.id) navigate(`/account/inquiries/${inserted.id}`);},700);
}, true);
