# EPM — Amigos Fundadores V2

Site estático em **HTML + CSS + JavaScript**, pronto para GitHub Pages, com **Supabase** opcional para banco de dados e autenticação da área administrativa.

## O que mudou na V2

- Meta Fundadora — Fase 1: **R$ 10.000**.
- Barra pública de progresso baseada **somente no valor efetivamente recebido**.
- Orçamento da fase:
  - R$ 4.200 — infraestrutura digital;
  - R$ 3.000 — lançamento e divulgação;
  - R$ 2.000 — produção e estrutura técnica;
  - R$ 800 — reserva técnica.
- Apoios sugeridos: **R$ 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 150 e 200**, além de outro valor.
- Programa **Amigos Fundadores EPM**.
- Registro do **Crédito Vale**: o painel calcula o crédito disponível como `valor recebido - crédito já utilizado`.
- Controle de certificado de Apoiador Fundador.
- Área separada para empresas:
  - Parceiro Fundador — R$ 1.500/ano;
  - Patrocinador Oficial — R$ 3.000/ano;
  - Patrocinador Master — R$ 5.000/ano;
  - Parceiro Técnico — serviços/equipamentos.
- Painel administrativo com busca, filtros e exportação CSV.
- RLS no Supabase: cadastros pessoais não ficam públicos.
- Função pública agregada que revela apenas meta, valor recebido, quantidade de apoios e data de atualização.
- Modo demonstração via `localStorage` quando o Supabase não está configurado.

## Estrutura

```text
EPM-PATROCINADORES-V2/
├── index.html
├── admin.html
├── styles.css
├── config.js
├── app.js
├── admin.js
├── supabase-setup-v2.sql
├── .nojekyll
└── assets/
    ├── logo-epm.webp
    ├── logo-epm.png
    └── favicon.png
```

## Testar sem banco

Abra `index.html` por um servidor local ou publique no GitHub Pages. Enquanto `config.js` estiver com os valores `COLE_AQUI...`, o site entra em **modo demonstração**.

No modo demo:

- cadastros ficam apenas no navegador atual;
- qualquer e-mail/senha entra na área admin;
- dados não são compartilhados com outros aparelhos;
- serve apenas para testar a interface.

## Ativar o banco Supabase

### 1. Crie um projeto no Supabase

No painel do Supabase, crie um projeto.

### 2. Rode o SQL

Abra **SQL Editor**, cole todo o conteúdo de `supabase-setup-v2.sql` e execute.

O SQL cria/migra:

- `public.admins`;
- `public.investor_leads`;
- políticas RLS;
- índices;
- função `get_epm_campaign_stats()`;
- trigger de `updated_at`.

### 3. Crie o administrador

No painel Supabase:

1. Abra **Authentication > Users**.
2. Crie o usuário administrador com e-mail e senha.
3. Copie o UUID do usuário.
4. No SQL Editor, execute:

```sql
insert into public.admins (user_id, email)
values ('COLE-O-UUID-AQUI', 'seu-email@dominio.com')
on conflict (user_id) do update set email = excluded.email;
```

### 4. Configure `config.js`

Pegue no Supabase:

- Project URL;
- Publishable Key atual **ou** chave `anon` pública legada.

Edite:

```js
window.EPM_CONFIG = {
  supabaseUrl: 'https://SEU-PROJETO.supabase.co',
  supabaseKey: 'SUA_CHAVE_PUBLICA',
  campaignGoal: 10000,
  appName: 'Amigos Fundadores EPM'
};
```

**Nunca coloque `service_role`, secret key ou senha de banco no GitHub.**

## Como a meta é calculada

A barra pública **não soma intenção nem valor confirmado**.

Ela soma apenas:

```text
received_amount
```

Isso significa:

- pessoa preencheu R$ 200 → não altera a barra;
- admin confirmou R$ 200 → ainda não altera a barra;
- admin registrou R$ 200 como recebido → a barra sobe R$ 200.

Essa regra evita mostrar promessa de apoio como dinheiro já arrecadado.

## Crédito Vale

O painel usa a regra:

```text
Crédito Vale gerado = valor recebido
Crédito Vale disponível = valor recebido - crédito utilizado
```

O banco impede que `credit_used` fique maior que `received_amount`.

## Publicar no GitHub Pages

1. Crie/abra o repositório no GitHub.
2. Envie todos os arquivos desta pasta para a raiz do repositório.
3. Em **Settings > Pages**, selecione a branch principal e a pasta `/root`.
4. Aguarde a publicação.

Se o projeto ficar em uma subpasta do GitHub Pages, os caminhos relativos usados aqui continuam funcionando.

## Segurança

- O navegador usa somente chave pública do Supabase.
- A tabela de cadastros tem RLS habilitado.
- Visitante anônimo pode apenas inserir cadastro válido.
- Visitante não pode listar os cadastros.
- Usuário autenticado só vê todos os registros se seu UUID estiver em `public.admins`.
- A função da barra pública retorna somente dados agregados.
- O site não possui função de exclusão para reduzir risco de apagar cadastros acidentalmente.

## Observação jurídica/comercial

O texto da V2 apresenta o programa como **apoio à fase fundadora**, não como aplicação financeira. O formulário informa que não há promessa de rendimento, participação societária ou retorno financeiro. Antes de oferecer regras comerciais adicionais, validade do Crédito Vale ou benefícios específicos de patrocínio, recomenda-se formalizar essas condições em regulamento/termo próprio.
