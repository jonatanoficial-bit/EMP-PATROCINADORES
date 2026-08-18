// CONFIGURAÇÃO DO BANCO DE DADOS
// Substitua SOMENTE pelos valores públicos do seu projeto Supabase.
// IMPORTANTE: use a chave anon/publishable. NUNCA coloque service_role aqui.
export const SUPABASE_URL = 'COLE_AQUI_SUA_SUPABASE_URL';
export const SUPABASE_ANON_KEY = 'COLE_AQUI_SUA_CHAVE_ANON_PUBLICA';
export const APP_NAME = 'Parceiros EPM';

export const IS_CONFIGURED =
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('COLE_AQUI') &&
  SUPABASE_ANON_KEY.length > 30 &&
  !SUPABASE_ANON_KEY.includes('COLE_AQUI');
