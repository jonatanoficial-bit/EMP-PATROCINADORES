import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, IS_CONFIGURED } from './config.js';

const $ = (sel) => document.querySelector(sel);
const supabase = IS_CONFIGURED ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
let leads = [];
let currentUser = null;

const loginView = $('#loginView');
const dashboardView = $('#dashboardView');
const identity = $('#adminIdentity');
const loginStatus = $('#loginStatus');
const demoNotice = $('#adminDemoNotice');
const body = $('#leadsBody');
const dialog = $('#leadDialog');
const dialogContent = $('#leadDialogContent');

if (!IS_CONFIGURED) demoNotice.hidden = false;

const money = (v) => v == null || v === '' ? '—' : Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const dateBR = (d) => new Date(d).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
const safe = (value) => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const normalize = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

function setAuthUI(isLogged, email=''){
  loginView.hidden = isLogged;
  dashboardView.hidden = !isLogged;
  identity.hidden = !isLogged;
  $('#adminEmail').textContent = email;
}

async function verifyAdmin(user){
  if (!user) return false;
  if (!IS_CONFIGURED) return true;
  const { data, error } = await supabase.from('admins').select('user_id,email').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  return !!data;
}

async function boot(){
  if (!IS_CONFIGURED) return setAuthUI(false);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return setAuthUI(false);
  try{
    if (!(await verifyAdmin(session.user))) {
      await supabase.auth.signOut();
      setAuthUI(false);
      loginStatus.textContent = 'Esta conta existe, mas não está autorizada como administradora.';
      loginStatus.className='form-status error';
      return;
    }
    currentUser = session.user;
    setAuthUI(true, currentUser.email);
    await loadLeads();
  }catch(err){console.error(err);setAuthUI(false);}
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault(); loginStatus.textContent = '';
  const fd = new FormData(e.currentTarget);
  const email = String(fd.get('email')).trim();
  const password = String(fd.get('password'));
  try{
    if (!IS_CONFIGURED) {
      currentUser = {email};
      setAuthUI(true, email || 'admin@demo.local');
      await loadLeads();
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({email,password});
    if (error) throw error;
    if (!(await verifyAdmin(data.user))) {
      await supabase.auth.signOut();
      throw new Error('Conta não autorizada como administradora.');
    }
    currentUser = data.user;
    setAuthUI(true,currentUser.email);
    await loadLeads();
  } catch (err) {
    loginStatus.textContent = err.message || 'Não foi possível entrar.';
    loginStatus.className='form-status error';
  }
});

$('#logoutBtn').addEventListener('click', async () => {
  if (IS_CONFIGURED) await supabase.auth.signOut();
  currentUser = null; leads = []; setAuthUI(false);
});
$('#refreshBtn').addEventListener('click', loadLeads);
$('#searchInput').addEventListener('input', renderTable);
$('#statusFilter').addEventListener('change', renderTable);
$('#exportBtn').addEventListener('click', exportCsv);

async function loadLeads(){
  body.innerHTML='<tr><td colspan="8" class="empty-cell">Carregando...</td></tr>';
  try{
    if (IS_CONFIGURED) {
      const { data, error } = await supabase.from('investor_leads').select('*').order('created_at',{ascending:false});
      if (error) throw error;
      leads = data || [];
    } else {
      leads = JSON.parse(localStorage.getItem('epm_demo_leads') || '[]');
    }
    updateStats(); renderTable();
  }catch(err){console.error(err);body.innerHTML='<tr><td colspan="8" class="empty-cell">Falha ao carregar. Verifique as permissões do banco.</td></tr>';}
}

function updateStats(){
  $('#statTotal').textContent = leads.length;
  $('#statInterest').textContent = money(leads.reduce((s,l)=>s+(Number(l.intended_amount)||0),0));
  $('#statConfirmed').textContent = money(leads.reduce((s,l)=>s+(Number(l.confirmed_amount)||0),0));
  $('#statNew').textContent = leads.filter(l=>l.admin_status==='novo').length;
}

function filteredLeads(){
  const q = normalize($('#searchInput').value);
  const st = $('#statusFilter').value;
  return leads.filter(l => {
    const hay = normalize([l.full_name,l.email,l.whatsapp,l.city_state,l.profile_type,(l.support_types||[]).join(' ')].join(' '));
    return (!q || hay.includes(q)) && (!st || l.admin_status===st);
  });
}

function renderTable(){
  const rows = filteredLeads();
  if (!rows.length) { body.innerHTML='<tr><td colspan="8" class="empty-cell">Nenhum cadastro encontrado.</td></tr>'; return; }
  body.innerHTML = rows.map(l => `<tr>
    <td>${safe(dateBR(l.created_at))}</td>
    <td><strong>${safe(l.full_name)}</strong><br><span>${safe(l.profile_type)}</span></td>
    <td><div class="contact-stack"><span>${safe(l.email)}</span><span>${safe(l.whatsapp)}</span></div></td>
    <td>${safe(l.city_state)}</td>
    <td>${safe((l.support_types||[]).join(', '))}</td>
    <td class="money">${safe(money(l.intended_amount))}</td>
    <td><span class="status-pill ${safe(l.admin_status)}">${safe(l.admin_status)}</span></td>
    <td><button class="row-action" data-id="${safe(l.id)}">Abrir</button></td>
  </tr>`).join('');
  body.querySelectorAll('.row-action').forEach(btn=>btn.addEventListener('click',()=>openLead(btn.dataset.id)));
}

function detailBox(label, value){return `<div class="detail-box"><span>${safe(label)}</span><p>${safe(value || '—')}</p></div>`;}
function openLead(id){
  const l = leads.find(x=>x.id===id); if(!l) return;
  dialogContent.innerHTML = `<div class="detail-head"><span class="eyebrow">CADASTRO</span><h2>${safe(l.full_name)}</h2><p>${safe(dateBR(l.created_at))}</p></div>
  <div class="detail-grid">
    ${detailBox('E-mail',l.email)}${detailBox('WhatsApp',l.whatsapp)}${detailBox('Cidade / Estado',l.city_state)}${detailBox('Perfil',l.profile_type)}
    ${detailBox('Origem',l.source)}${detailBox('Relação',l.relationship)}${detailBox('Formas de apoio',(l.support_types||[]).join(', '))}${detailBox('Valor informado',money(l.intended_amount))}
    ${detailBox('Preferência',l.payment_preference)}${detailBox('Melhor contato',l.best_contact_period)}${detailBox('Pode divulgar nome?',l.allow_name_public?'Sim':'Não')}${detailBox('Motivação',l.motivation)}
  </div>
  <div class="admin-edit">
    <h3>Controle administrativo</h3>
    <div class="form-grid two">
      <label class="field"><span>Status</span><select id="editStatus"><option value="novo">Novo</option><option value="contato">Em contato</option><option value="reuniao">Reunião</option><option value="confirmado">Confirmado</option><option value="pago">Recebido</option><option value="pausado">Pausado</option><option value="encerrado">Encerrado</option></select></label>
      <label class="field"><span>Valor confirmado (R$)</span><input id="editConfirmed" type="number" min="0" step="0.01" value="${l.confirmed_amount ?? ''}" /></label>
    </div>
    <label class="field"><span>Anotações internas</span><textarea id="editNotes" rows="4" maxlength="2000">${safe(l.admin_notes || '')}</textarea></label>
    <button id="saveLeadBtn" class="btn btn-gold" type="button">Salvar alterações</button>
    <p id="dialogStatus" class="form-status"></p>
  </div>`;
  $('#editStatus').value = l.admin_status || 'novo';
  $('#saveLeadBtn').addEventListener('click',()=>saveLead(l.id));
  dialog.showModal();
}

async function saveLead(id){
  const patch = {
    admin_status: $('#editStatus').value,
    confirmed_amount: $('#editConfirmed').value === '' ? null : Number($('#editConfirmed').value),
    admin_notes: $('#editNotes').value.trim() || null,
    updated_at: new Date().toISOString()
  };
  const st = $('#dialogStatus'); st.textContent='Salvando...'; st.className='form-status';
  try{
    if (IS_CONFIGURED) {
      const { error } = await supabase.from('investor_leads').update(patch).eq('id',id);
      if (error) throw error;
    } else {
      leads = leads.map(l=>l.id===id?{...l,...patch}:l);
      localStorage.setItem('epm_demo_leads',JSON.stringify(leads));
    }
    st.textContent='Alterações salvas.'; st.className='form-status ok';
    await loadLeads();
    setTimeout(()=>dialog.close(),500);
  }catch(err){console.error(err);st.textContent='Não foi possível salvar.';st.className='form-status error';}
}

function csvEscape(value){ const s = String(value ?? ''); return `"${s.replace(/"/g,'""')}"`; }
function exportCsv(){
  const rows = filteredLeads();
  const headers=['Data','Nome','Email','WhatsApp','Cidade/Estado','Perfil','Origem','Relação','Formas de apoio','Valor informado','Preferência','Motivação','Melhor contato','Divulgação autorizada','Status','Valor confirmado','Notas internas'];
  const data = rows.map(l=>[
    dateBR(l.created_at),l.full_name,l.email,l.whatsapp,l.city_state,l.profile_type,l.source,l.relationship,(l.support_types||[]).join(' | '),l.intended_amount,l.payment_preference,l.motivation,l.best_contact_period,l.allow_name_public?'Sim':'Não',l.admin_status,l.confirmed_amount,l.admin_notes
  ]);
  const csv='\uFEFF'+[headers,...data].map(r=>r.map(csvEscape).join(';')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`epm-parceiros-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
}

boot();
