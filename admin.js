(() => {
  'use strict';
  const config = window.EPM_CONFIG || {};
  const isConfigured = typeof config.supabaseUrl === 'string' && config.supabaseUrl.startsWith('https://') && !config.supabaseUrl.includes('COLE_AQUI') && typeof config.supabaseKey === 'string' && config.supabaseKey.length > 25 && !config.supabaseKey.includes('COLE_AQUI') && window.supabase?.createClient;
  const db = isConfigured ? window.supabase.createClient(config.supabaseUrl, config.supabaseKey) : null;
  const goal = Number(config.campaignGoal) || 10000;
  const $ = (sel, root = document) => root.querySelector(sel);
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
  if (!isConfigured) demoNotice.hidden = false;

  const money = (v) => v == null || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dateBR = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  };
  const safe = (value) => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
  const normalize = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const numberOrNull = (v) => v === '' || v == null ? null : Number(v);
  const creditBalance = (l) => Math.max(0, (Number(l.received_amount) || 0) - (Number(l.credit_used) || 0));

  function setAuthUI(isLogged, email = '') {
    loginView.hidden = isLogged;
    dashboardView.hidden = !isLogged;
    identity.hidden = !isLogged;
    $('#adminEmail').textContent = email;
  }

  async function verifyAdmin(user) {
    if (!user?.email) return false;
    if (!isConfigured) return true;
    const email = String(user.email).trim().toLowerCase();
    const { data, error } = await db
      .from('admin_allowlist')
      .select('email')
      .eq('email', email)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  }

  async function boot() {
    if (!isConfigured) return setAuthUI(false);
    const { data: { session } } = await db.auth.getSession();
    if (!session?.user) return setAuthUI(false);
    try {
      if (!(await verifyAdmin(session.user))) {
        await db.auth.signOut();
        setAuthUI(false);
        loginStatus.textContent = 'Esta conta existe, mas não está autorizada como administradora.';
        loginStatus.className = 'form-status error';
        return;
      }
      currentUser = session.user;
      setAuthUI(true, currentUser.email);
      await loadLeads();
    } catch (err) {
      console.error(err);
      setAuthUI(false);
    }
  }

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    loginStatus.textContent = '';
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') || '').trim();
    const password = String(fd.get('password') || '');
    try {
      if (!isConfigured) {
        currentUser = { email: email || 'admin@demo.local' };
        setAuthUI(true, currentUser.email);
        await loadLeads();
        return;
      }
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!(await verifyAdmin(data.user))) {
        await db.auth.signOut();
        throw new Error('Conta não autorizada como administradora.');
      }
      currentUser = data.user;
      setAuthUI(true, currentUser.email);
      await loadLeads();
    } catch (err) {
      loginStatus.textContent = err.message || 'Não foi possível entrar.';
      loginStatus.className = 'form-status error';
    }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    if (isConfigured) await db.auth.signOut();
    currentUser = null;
    leads = [];
    setAuthUI(false);
  });
  $('#refreshBtn').addEventListener('click', loadLeads);
  $('#searchInput').addEventListener('input', renderTable);
  $('#statusFilter').addEventListener('change', renderTable);
  $('#exportBtn').addEventListener('click', exportCsv);

  async function loadLeads() {
    body.innerHTML = '<tr><td colspan="9" class="empty-cell">Carregando...</td></tr>';
    try {
      if (isConfigured) {
        const { data, error } = await db.from('investor_leads').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        leads = data || [];
      } else {
        leads = JSON.parse(localStorage.getItem('epm_v2_demo_leads') || '[]');
      }
      updateStats();
      renderTable();
    } catch (err) {
      console.error(err);
      body.innerHTML = '<tr><td colspan="9" class="empty-cell">Falha ao carregar. Verifique a configuração do banco e as permissões RLS.</td></tr>';
    }
  }

  function updateStats() {
    const received = leads.reduce((s, l) => s + (Number(l.received_amount) || 0), 0);
    const confirmed = leads.reduce((s, l) => s + (Number(l.confirmed_amount) || 0), 0);
    const credit = leads.reduce((s, l) => s + creditBalance(l), 0);
    const pct = Math.min(100, goal ? received / goal * 100 : 0);
    $('#statGoal').textContent = money(goal);
    $('#statGoalPercent').textContent = `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% alcançado`;
    $('#adminGoalBar').style.width = `${pct}%`;
    $('#statReceived').textContent = money(received);
    $('#statConfirmed').textContent = money(confirmed);
    $('#statCredit').textContent = money(credit);
    $('#statNew').textContent = leads.filter(l => l.admin_status === 'novo').length;
    $('#statTotal').textContent = `${leads.length} registros totais`;
  }

  function filteredLeads() {
    const q = normalize($('#searchInput').value);
    const st = $('#statusFilter').value;
    return leads.filter(l => {
      const hay = normalize([l.full_name, l.email, l.whatsapp, l.city_state, l.profile_type, l.organization_name, l.support_program, l.payment_preference].join(' '));
      return (!q || hay.includes(q)) && (!st || l.admin_status === st);
    });
  }

  function statusLabel(status) {
    return ({novo:'Novo',contato:'Em contato',aguardando:'Aguardando',confirmado:'Confirmado',recebido_parcial:'Recebido parcial',recebido:'Recebido',pausado:'Pausado',encerrado:'Encerrado'})[status] || status || '—';
  }

  function renderTable() {
    const rows = filteredLeads();
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="9" class="empty-cell">Nenhum cadastro encontrado.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(l => `<tr>
      <td>${safe(dateBR(l.created_at))}</td>
      <td><strong>${safe(l.full_name)}</strong><br><span>${safe(l.organization_name || l.profile_type || '')}</span></td>
      <td>${safe(l.support_program || '—')}</td>
      <td><div class="contact-stack"><span>${safe(l.email)}</span><span>${safe(l.whatsapp)}</span></div></td>
      <td class="money">${safe(money(l.intended_amount))}</td>
      <td class="money">${safe(money(l.received_amount || 0))}</td>
      <td class="money">${safe(money(creditBalance(l)))}</td>
      <td><span class="status-pill ${safe(l.admin_status)}">${safe(statusLabel(l.admin_status))}</span></td>
      <td><button class="row-action" data-id="${safe(l.id)}">Abrir</button></td>
    </tr>`).join('');
    body.querySelectorAll('.row-action').forEach(btn => btn.addEventListener('click', () => openLead(btn.dataset.id)));
  }

  function detailBox(label, value) {
    return `<div class="detail-box"><span>${safe(label)}</span><p>${safe(value || '—')}</p></div>`;
  }

  function openLead(id) {
    const l = leads.find(x => x.id === id);
    if (!l) return;
    dialogContent.innerHTML = `
      <div class="detail-head"><span class="eyebrow">CADASTRO • ${safe(l.support_program || 'APOIO')}</span><h2>${safe(l.full_name)}</h2><p>Recebido em ${safe(dateBR(l.created_at))}</p></div>
      <div class="detail-grid">
        ${detailBox('E-mail', l.email)}${detailBox('WhatsApp', l.whatsapp)}${detailBox('Cidade / Estado', l.city_state)}${detailBox('Perfil', l.profile_type)}
        ${detailBox('Empresa / organização', l.organization_name)}${detailBox('Programa', l.support_program)}${detailBox('Como conheceu', l.source)}${detailBox('Forma preferida', l.payment_preference)}
        ${detailBox('Valor pretendido', money(l.intended_amount))}${detailBox('Melhor contato', l.best_contact_period)}${detailBox('Nome público autorizado?', l.allow_name_public ? 'Sim' : 'Não')}${detailBox('Observação / motivação', l.motivation)}
        ${detailBox('Termo/manifestação aceita?', l.terms_accepted ? 'Sim' : 'Não')}${detailBox('Versão aceita', l.terms_version || l.consent_version)}${detailBox('Marketing opcional?', l.marketing_opt_in ? 'Sim' : 'Não')}
      </div>
      <div class="admin-edit">
        <h3>Controle administrativo</h3>
        <div class="form-grid two">
          <label class="field"><span>Status</span><select id="editStatus"><option value="novo">Novo</option><option value="contato">Em contato</option><option value="aguardando">Aguardando</option><option value="confirmado">Confirmado</option><option value="recebido_parcial">Recebido parcial</option><option value="recebido">Recebido</option><option value="pausado">Pausado</option><option value="encerrado">Encerrado</option></select></label>
          <label class="field"><span>Valor confirmado (R$)</span><input id="editConfirmed" type="number" min="0" step="0.01" value="${l.confirmed_amount ?? ''}" /></label>
        </div>
        <div class="admin-finance-grid">
          <label class="field"><span>Valor recebido (R$)</span><input id="editReceived" type="number" min="0" step="0.01" value="${l.received_amount ?? 0}" /></label>
          <label class="field"><span>Crédito já utilizado (R$)</span><input id="editCreditUsed" type="number" min="0" step="0.01" value="${l.credit_used ?? 0}" /></label>
          <div class="credit-readout"><span>Crédito Vale disponível</span><strong id="creditPreview">${safe(money(creditBalance(l)))}</strong></div>
        </div>
        <div class="form-grid two">
          <label class="field"><span>Forma recebida</span><select id="editPaymentMethod"><option value="">Não informado</option><option>PIX</option><option>Cartão de crédito</option><option>Boleto</option><option>Transferência</option><option>Dinheiro</option><option>Serviços / equipamentos</option><option>Outro</option></select></label>
          <label class="field"><span>Data do recebimento</span><input id="editReceivedAt" type="datetime-local" value="${toLocalInput(l.received_at)}" /></label>
        </div>
        <div class="form-grid two">
          <label class="field"><span>Certificado</span><select id="editCertificateStatus"><option value="nao_emitido">Não emitido</option><option value="emitir">Emitir</option><option value="emitido">Emitido</option><option value="entregue">Entregue</option></select></label>
          <label class="field"><span>Código / número do certificado</span><input id="editCertificateCode" maxlength="80" value="${safe(l.certificate_code || '')}" placeholder="Opcional" /></label>
        </div>
        <label class="field"><span>Anotações internas</span><textarea id="editNotes" rows="5" maxlength="3000">${safe(l.admin_notes || '')}</textarea></label>
        <button id="saveLeadBtn" class="btn btn-gold" type="button">Salvar alterações</button>
        <p id="dialogStatus" class="form-status"></p>
      </div>`;

    $('#editStatus').value = l.admin_status || 'novo';
    $('#editPaymentMethod').value = l.payment_method_confirmed || '';
    $('#editCertificateStatus').value = l.certificate_status || 'nao_emitido';
    const updateCreditPreview = () => {
      const received = Number($('#editReceived').value || 0);
      const used = Number($('#editCreditUsed').value || 0);
      $('#creditPreview').textContent = money(Math.max(0, received - used));
    };
    $('#editReceived').addEventListener('input', updateCreditPreview);
    $('#editCreditUsed').addEventListener('input', updateCreditPreview);
    $('#saveLeadBtn').addEventListener('click', () => saveLead(l.id));
    dialog.showModal();
  }

  function toLocalInput(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  async function saveLead(id) {
    const received = Number($('#editReceived').value || 0);
    const used = Number($('#editCreditUsed').value || 0);
    const st = $('#dialogStatus');
    if (used > received) {
      st.textContent = 'O crédito utilizado não pode ser maior que o valor recebido.';
      st.className = 'form-status error';
      return;
    }
    const receivedAtRaw = $('#editReceivedAt').value;
    const patch = {
      admin_status: $('#editStatus').value,
      confirmed_amount: numberOrNull($('#editConfirmed').value),
      received_amount: received,
      received_at: receivedAtRaw ? new Date(receivedAtRaw).toISOString() : (received > 0 ? new Date().toISOString() : null),
      credit_used: used,
      payment_method_confirmed: $('#editPaymentMethod').value || null,
      certificate_status: $('#editCertificateStatus').value,
      certificate_code: $('#editCertificateCode').value.trim() || null,
      admin_notes: $('#editNotes').value.trim() || null,
      updated_at: new Date().toISOString()
    };
    st.textContent = 'Salvando...';
    st.className = 'form-status';
    try {
      if (isConfigured) {
        const { error } = await db.from('investor_leads').update(patch).eq('id', id);
        if (error) throw error;
      } else {
        leads = leads.map(l => l.id === id ? { ...l, ...patch } : l);
        localStorage.setItem('epm_v2_demo_leads', JSON.stringify(leads));
      }
      st.textContent = 'Alterações salvas. Se houve recebimento, a barra pública será recalculada.';
      st.className = 'form-status ok';
      await loadLeads();
      setTimeout(() => dialog.close(), 650);
    } catch (err) {
      console.error(err);
      st.textContent = 'Não foi possível salvar. Verifique o banco e as permissões.';
      st.className = 'form-status error';
    }
  }

  function csvEscape(value) {
    const s = String(value ?? '');
    return `"${s.replace(/"/g, '""')}"`;
  }

  function exportCsv() {
    const rows = filteredLeads();
    const headers = ['Data cadastro','Nome','Email','WhatsApp','Cidade/Estado','Perfil','Empresa/Organização','Programa','Origem','Valor pretendido','Preferência de pagamento','Motivação','Melhor contato','Autorização nome público','Termo/manifestação aceita','Versão aceita','Marketing opcional','Status','Valor confirmado','Valor recebido','Data recebimento','Forma recebida','Crédito gerado','Crédito utilizado','Crédito disponível','Certificado','Código certificado','Notas internas'];
    const data = rows.map(l => [
      dateBR(l.created_at), l.full_name, l.email, l.whatsapp, l.city_state, l.profile_type, l.organization_name, l.support_program, l.source, l.intended_amount, l.payment_preference, l.motivation, l.best_contact_period, l.allow_name_public ? 'Sim' : 'Não', l.terms_accepted ? 'Sim' : 'Não', l.terms_version || l.consent_version, l.marketing_opt_in ? 'Sim' : 'Não', statusLabel(l.admin_status), l.confirmed_amount, l.received_amount, dateBR(l.received_at), l.payment_method_confirmed, Number(l.received_amount) || 0, l.credit_used || 0, creditBalance(l), l.certificate_status, l.certificate_code, l.admin_notes
    ]);
    const csv = '\uFEFF' + [headers, ...data].map(r => r.map(csvEscape).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `epm-amigos-fundadores-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  boot();
})();
