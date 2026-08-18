import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, IS_CONFIGURED } from './config.js';

const form = document.querySelector('#supportForm');
const statusEl = document.querySelector('#formStatus');
const submitBtn = document.querySelector('#submitBtn');
const demoBanner = document.querySelector('#demoBanner');
const supabase = IS_CONFIGURED ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

if (!IS_CONFIGURED) demoBanner.hidden = false;

const sanitize = (value) => String(value ?? '').trim();
const checkedValues = (name) => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map(el => el.value);
const brMoneyNumber = (value) => {
  if (value === '' || value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : null;
};

const setStatus = (text, type = '') => {
  statusEl.textContent = text;
  statusEl.className = `form-status ${type}`.trim();
};

form.querySelector('input[name="whatsapp"]').addEventListener('input', (e) => {
  let v = e.target.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 10) v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  else if (v.length > 6) v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
  else if (v.length > 2) v = v.replace(/^(\d{2})(\d+)/, '($1) $2');
  e.target.value = v;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('');
  if (!form.checkValidity()) {
    form.reportValidity();
    setStatus('Confira os campos obrigatórios antes de enviar.', 'error');
    return;
  }
  if (sanitize(form.website.value)) return;

  const supportTypes = checkedValues('support_type');
  if (!supportTypes.length) {
    setStatus('Selecione pelo menos uma forma de apoio.', 'error');
    form.querySelector('.choice-set').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const fd = new FormData(form);
  const payload = {
    full_name: sanitize(fd.get('full_name')),
    email: sanitize(fd.get('email')).toLowerCase(),
    whatsapp: sanitize(fd.get('whatsapp')),
    city_state: sanitize(fd.get('city_state')),
    profile_type: sanitize(fd.get('profile_type')),
    source: sanitize(fd.get('source')) || null,
    relationship: sanitize(fd.get('relationship')) || null,
    support_types: supportTypes,
    intended_amount: brMoneyNumber(fd.get('intended_amount')),
    payment_preference: sanitize(fd.get('payment_preference')) || null,
    motivation: sanitize(fd.get('motivation')) || null,
    best_contact_period: sanitize(fd.get('best_contact_period')) || null,
    allow_name_public: fd.get('allow_name_public') === 'true',
    lgpd_consent: fd.get('lgpd_consent') === 'on'
  };

  submitBtn.disabled = true;
  submitBtn.querySelector('span').textContent = 'Enviando...';

  try {
    if (IS_CONFIGURED) {
      const { error } = await supabase.from('investor_leads').insert(payload);
      if (error) throw error;
    } else {
      const demo = JSON.parse(localStorage.getItem('epm_demo_leads') || '[]');
      demo.unshift({
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        admin_status: 'novo',
        confirmed_amount: null,
        admin_notes: null,
        ...payload
      });
      localStorage.setItem('epm_demo_leads', JSON.stringify(demo));
    }
    form.reset();
    setStatus(IS_CONFIGURED ? 'Obrigado! Seu interesse foi registrado com sucesso. Nossa equipe poderá entrar em contato com você.' : 'Teste salvo neste navegador. Configure o Supabase para receber cadastros reais.', 'ok');
  } catch (error) {
    console.error(error);
    setStatus('Não foi possível concluir o envio agora. Tente novamente em instantes.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector('span').textContent = 'Enviar meu interesse';
  }
});
