(() => {
  'use strict';

  const config = window.EPM_CONFIG || {};
  const isConfigured =
    typeof config.supabaseUrl === 'string' &&
    config.supabaseUrl.startsWith('https://') &&
    !config.supabaseUrl.includes('COLE_AQUI') &&
    typeof config.supabaseKey === 'string' &&
    config.supabaseKey.length > 25 &&
    !config.supabaseKey.includes('COLE_AQUI') &&
    window.supabase?.createClient;

  const db = isConfigured ? window.supabase.createClient(config.supabaseUrl, config.supabaseKey) : null;
  const goal = Number(config.campaignGoal) || 10000;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const sanitize = (value) => String(value ?? '').trim();
  const parseMoney = (value) => {
    if (value === '' || value == null) return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Number(n.toFixed(2)) : null;
  };

  const menuToggle = $('.menu-toggle');
  const nav = $('.main-nav');
  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(open));
    });
    $$('.main-nav a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }));
  }

  const observer = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 }) : null;
  $$('.reveal').forEach(el => observer ? observer.observe(el) : el.classList.add('visible'));

  async function loadPublicStats() {
    const receivedEl = $('#publicReceived');
    const percentEl = $('#publicPercent');
    const barEl = $('#publicProgressBar');
    const remainingEl = $('#publicRemaining');
    const supportersEl = $('#publicSupporters');
    const updatedEl = $('#publicUpdated');
    const demoEl = $('#progressDemo');
    if (!receivedEl) return;

    let received = 0;
    let supporters = 0;
    let updatedAt = null;

    try {
      if (isConfigured) {
        const { data, error } = await db.rpc('get_epm_campaign_stats');
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (row) {
          received = Number(row.received || 0);
          supporters = Number(row.supporters || 0);
          updatedAt = row.updated_at || null;
        }
      } else {
        demoEl.hidden = false;
        const leads = JSON.parse(localStorage.getItem('epm_v2_demo_leads') || '[]');
        received = leads.reduce((sum, lead) => sum + (Number(lead.received_amount) || 0), 0);
        supporters = leads.filter(lead => Number(lead.received_amount) > 0).length;
        updatedAt = leads.length ? leads.map(l => l.updated_at || l.created_at).sort().at(-1) : null;
      }
    } catch (err) {
      console.error('Falha ao carregar a meta pública:', err);
      if (demoEl) {
        demoEl.hidden = false;
        demoEl.textContent = 'Não foi possível atualizar a barra agora. O formulário continua disponível.';
      }
    }

    const pct = Math.max(0, Math.min(100, goal ? (received / goal) * 100 : 0));
    const remaining = Math.max(0, goal - received);
    receivedEl.textContent = money(received);
    percentEl.textContent = `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
    barEl.style.width = `${pct}%`;
    remainingEl.textContent = remaining > 0 ? `Faltam ${money(remaining)}` : 'Meta da Fase 1 alcançada!';
    supportersEl.textContent = String(supporters);
    $$('.milestone[data-threshold]').forEach(el => el.classList.toggle('active', pct >= Number(el.dataset.threshold)));
    if (updatedEl && updatedAt) {
      const d = new Date(updatedAt);
      if (!Number.isNaN(d.getTime())) updatedEl.textContent = `Atualizado em ${d.toLocaleDateString('pt-BR')}`;
    }
  }

  const form = $('#supportForm');
  const amountInput = $('#intendedAmount');
  const programInput = $('#supportProgram');
  const summary = $('#selectionSummary');
  const profileType = $('#profileType');
  const statusEl = $('#formStatus');
  const submitBtn = $('#submitBtn');
  const demoBanner = $('#demoBanner');
  const wizardScreens = $$('[data-wizard-step]');
  const wizardDots = $$('[data-step-dot]');
  const termScroll = $('#termScroll');
  const termContinue = $('#termContinue');
  const termReadStatus = $('#termReadStatus');
  const friendSummary = $('#friendSummary');
  const businessSummary = $('#businessSummary');
  const friendTermsStep = $('#friendTermsStep');
  const businessTermsStep = $('#businessTermsStep');
  const friendAmountChoices = $('#friendAmountChoices');
  const friendFinalReminder = $('#friendFinalReminder');
  const termsAcceptedLabel = $('#termsAcceptedLabel');
  const submitLabel = $('#submitBtn span');
  let currentWizardStep = 1;
  let friendTermRead = false;

  if (form && !isConfigured) demoBanner.hidden = false;

  const isBusinessProgram = () => {
    const p = programInput?.value || 'Amigo Fundador';
    return p !== 'Amigo Fundador';
  };

  function updateFlowMode() {
    const business = isBusinessProgram();
    if (friendSummary) friendSummary.hidden = business;
    if (businessSummary) businessSummary.hidden = !business;
    if (friendTermsStep) friendTermsStep.hidden = business;
    if (businessTermsStep) businessTermsStep.hidden = !business;
    if (friendAmountChoices) friendAmountChoices.hidden = business;
    if (friendFinalReminder) friendFinalReminder.hidden = business;

    if (termContinue) {
      termContinue.disabled = business ? false : !friendTermRead;
    }
    if (termsAcceptedLabel) {
      termsAcceptedLabel.innerHTML = business
        ? '<strong>Confirmo que este envio é uma manifestação de interesse institucional</strong> e compreendo que patrocínio/parceria depende de proposta ou contrato próprio e confirmação das condições pela equipe. *'
        : '<strong>Li e aceito o Termo de Adesão ao Programa Apoiador Fundador — Crédito Vale</strong> e confirmo que compreendi o quadro-resumo, inclusive que 100% do apoio gera saldo nominal, mas o percentual de utilização varia conforme o produto ou serviço. *';
    }
    if (submitLabel) submitLabel.textContent = business ? 'Registrar interesse institucional' : 'Registrar minha adesão';
  }

  function setWizardStep(step, { scroll = false } = {}) {
    const target = Math.max(1, Math.min(3, Number(step) || 1));
    if (target === 3 && !isBusinessProgram() && !friendTermRead) return;
    currentWizardStep = target;
    wizardScreens.forEach(screen => {
      const active = Number(screen.dataset.wizardStep) === target;
      screen.hidden = !active;
      screen.classList.toggle('active', active);
    });
    wizardDots.forEach(dot => {
      const n = Number(dot.dataset.stepDot);
      dot.classList.toggle('active', n === target);
      dot.classList.toggle('done', n < target);
      dot.setAttribute('aria-current', n === target ? 'step' : 'false');
    });
    updateFlowMode();
    updateSummary(programInput?.value, amountInput?.value);
    if (scroll) $('#apoie')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('#step1Continue')?.addEventListener('click', () => setWizardStep(2, { scroll: true }));
  termContinue?.addEventListener('click', () => setWizardStep(3, { scroll: true }));
  $$('[data-back-step]').forEach(btn => btn.addEventListener('click', () => setWizardStep(btn.dataset.backStep, { scroll: true })));

  function refreshTermReadState() {
    if (!termScroll || friendTermRead) return;
    const reachedEnd = termScroll.scrollTop + termScroll.clientHeight >= termScroll.scrollHeight - 24;
    if (reachedEnd) {
      friendTermRead = true;
      if (termContinue) termContinue.disabled = false;
      if (termReadStatus) {
        termReadStatus.textContent = 'Termo percorrido até o final. Você pode continuar para a etapa de adesão.';
        termReadStatus.classList.add('ok');
      }
    }
  }
  termScroll?.addEventListener('scroll', refreshTermReadState);
  window.setTimeout(refreshTermReadState, 300);

  function updateSummary(program = programInput?.value || 'Amigo Fundador', amount = amountInput?.value) {
    if (!summary) return;
    const strong = $('strong', summary);
    const value = $('b', summary);
    strong.textContent = program || 'Amigo Fundador';
    if (currentWizardStep < 3) {
      value.textContent = 'O valor será exibido somente na etapa 3.';
    } else {
      value.textContent = amount && Number(amount) > 0 ? `Valor pretendido: ${money(amount)}` : 'Nenhum valor selecionado';
    }
  }

  function selectProgram(program) {
    if (!programInput) return;
    programInput.value = program;
    $$('.program-choice').forEach(btn => {
      const base = btn.dataset.program;
      btn.classList.toggle('active', program === base || (base === 'Empresa / Patrocínio' && program.startsWith('Empresa / Patrocínio')));
    });
    if (program === 'Empresa / Patrocínio' && profileType && !profileType.value) profileType.value = 'Empresa / marca';
    if (program === 'Parceiro Técnico' && profileType && !profileType.value) profileType.value = 'Profissional / prestador';
    updateFlowMode();
    updateSummary(program, amountInput?.value);
  }

  function setAmount(value, { scroll = true } = {}) {
    if (!amountInput) return;
    amountInput.value = value;
    $$('#amountGrid [data-amount]').forEach(btn => btn.classList.toggle('selected', String(btn.dataset.amount) === String(value)));
    selectProgram('Amigo Fundador');
    updateSummary('Amigo Fundador', value);
    if (scroll) $('#apoie')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $$('#amountGrid [data-amount]').forEach(btn => btn.addEventListener('click', () => setAmount(btn.dataset.amount)));
  $('[data-other-amount]')?.addEventListener('click', () => {
    selectProgram('Amigo Fundador');
    if (amountInput) amountInput.value = '';
    updateSummary('Amigo Fundador', '');
    $('#apoie')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => amountInput?.focus(), 500);
  });

  $$('.program-choice').forEach(btn => btn.addEventListener('click', () => selectProgram(btn.dataset.program)));
  amountInput?.addEventListener('input', () => {
    $$('#amountGrid [data-amount]').forEach(btn => btn.classList.toggle('selected', String(btn.dataset.amount) === String(amountInput.value)));
    updateSummary(programInput?.value, amountInput.value);
  });

  $$('.sponsor-select').forEach(btn => btn.addEventListener('click', () => {
    const tier = btn.dataset.tier || 'Empresa / Patrocínio';
    const amount = btn.dataset.amount || '';
    selectProgram(tier === 'Parceiro Técnico' ? 'Parceiro Técnico' : `Empresa / Patrocínio — ${tier}`);
    if (amountInput) amountInput.value = amount;
    if (profileType) profileType.value = tier === 'Parceiro Técnico' ? 'Profissional / prestador' : 'Empresa / marca';
    setWizardStep(1);
    updateSummary(programInput.value, amount);
    $('#apoie')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  form?.querySelector('input[name="whatsapp"]')?.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 10) v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    else if (v.length > 6) v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
    else if (v.length > 2) v = v.replace(/^(\d{2})(\d+)/, '($1) $2');
    e.target.value = v;
  });

  function setStatus(text, type = '') {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = `form-status ${type}`.trim();
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('');
    if (!form.checkValidity()) {
      form.reportValidity();
      setStatus('Confira os campos obrigatórios antes de enviar.', 'error');
      return;
    }
    if (sanitize(form.website.value)) return;

    const fd = new FormData(form);
    const amount = parseMoney(fd.get('intended_amount'));
    const program = sanitize(fd.get('support_program')) || 'Amigo Fundador';
    if (program.includes('Amigo Fundador') && (amount == null || amount < 10)) {
      setStatus('Para Amigos Fundadores, informe um valor a partir de R$ 10.', 'error');
      amountInput?.focus();
      return;
    }

    const payload = {
      full_name: sanitize(fd.get('full_name')),
      email: sanitize(fd.get('email')).toLowerCase(),
      whatsapp: sanitize(fd.get('whatsapp')),
      city_state: sanitize(fd.get('city_state')),
      profile_type: sanitize(fd.get('profile_type')),
      organization_name: sanitize(fd.get('organization_name')) || null,
      support_program: program,
      support_types: [program],
      source: sanitize(fd.get('source')) || null,
      intended_amount: amount,
      payment_preference: sanitize(fd.get('payment_preference')) || null,
      motivation: sanitize(fd.get('motivation')) || null,
      best_contact_period: sanitize(fd.get('best_contact_period')) || null,
      allow_name_public: fd.get('allow_name_public') === 'true',
      lgpd_consent: fd.get('terms_accepted') === 'on',
      terms_accepted: fd.get('terms_accepted') === 'on',
      terms_version: isBusinessProgram() ? 'MANIFESTACAO-INSTITUCIONAL-V2.2' : '1.0 — agosto de 2026',
      marketing_opt_in: fd.get('marketing_opt_in') === 'on',
      consent_version: isBusinessProgram() ? 'EPM-INSTITUCIONAL-V2.2-2026-08' : 'EPM-CREDITO-VALE-1.0-2026-08'
    };

    submitBtn.disabled = true;
    $('span', submitBtn).textContent = 'Registrando...';

    try {
      if (isConfigured) {
        const { error } = await db.from('investor_leads').insert(payload);
        if (error) throw error;
      } else {
        const demo = JSON.parse(localStorage.getItem('epm_v2_demo_leads') || '[]');
        demo.unshift({
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          admin_status: 'novo',
          confirmed_amount: null,
          received_amount: 0,
          received_at: null,
          credit_used: 0,
          certificate_status: 'nao_emitido',
          certificate_code: null,
          payment_method_confirmed: null,
          admin_notes: null,
          ...payload
        });
        localStorage.setItem('epm_v2_demo_leads', JSON.stringify(demo));
      }

      form.reset();
      programInput.value = 'Amigo Fundador';
      $$('#amountGrid [data-amount]').forEach(btn => btn.classList.remove('selected'));
      friendTermRead = false;
      if (termScroll) termScroll.scrollTop = 0;
      if (termContinue) termContinue.disabled = true;
      if (termReadStatus) {
        termReadStatus.textContent = 'Role o documento até o final para continuar.';
        termReadStatus.classList.remove('ok');
      }
      setWizardStep(1);
      updateSummary('Amigo Fundador', '');
      setStatus(isConfigured
        ? 'Registro concluído. A equipe poderá entrar em contato para confirmar o meio de pagamento e os próximos passos.'
        : 'Teste salvo neste navegador. Configure o Supabase para receber cadastros reais e atualizar a meta pública.', 'ok');
      await loadPublicStats();
    } catch (err) {
      console.error(err);
      setStatus('Não foi possível concluir o cadastro agora. Tente novamente em instantes.', 'error');
    } finally {
      submitBtn.disabled = false;
      $('span', submitBtn).textContent = 'Registrar meu interesse';
    }
  });

  updateFlowMode();
  setWizardStep(1);
  loadPublicStats();
  if (isConfigured) window.setInterval(loadPublicStats, 60000);
})();
