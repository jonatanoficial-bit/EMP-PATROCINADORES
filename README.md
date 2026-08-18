# EPM — Site de Parceiros e Apoiadores

Site estático em HTML + CSS + JavaScript, pronto para GitHub Pages, com banco gratuito Supabase, formulário público e painel administrativo privado.

## O que já está pronto

- Landing page premium em preto, dourado e prata usando o logo oficial enviado.
- Formulário grande para manifestação de interesse de patrocinadores/apoiadores.
- Supabase/Postgres como banco de dados.
- Supabase Auth para login dos administradores.
- Row Level Security (RLS): visitante pode inserir; somente administradores autorizados podem ler/alterar.
- Painel tipo planilha, com busca, filtro de status, valor indicado, valor confirmado e anotações internas.
- Exportação CSV compatível com Excel/Google Sheets.
- Responsivo para celular e computador.
- Modo demonstração local enquanto o Supabase ainda não foi configurado.

## 1. Criar o banco gratuito no Supabase

1. Crie um projeto no Supabase.
2. Abra **SQL Editor**.
3. Cole e execute todo o conteúdo de `supabase-setup.sql`.
4. Vá em **Authentication > Users** e crie o usuário administrador com e-mail e senha.
5. Copie o UUID desse usuário.
6. Volte ao SQL Editor e execute o comando mostrado no final de `supabase-setup.sql`, substituindo UUID e e-mail.

## 2. Conectar o site ao banco

No Supabase, abra o painel de conexão/API e copie:

- Project URL
- chave pública `anon` / `publishable`

Abra `config.js` e substitua os dois valores de exemplo.

**Nunca** use a chave `service_role` no GitHub ou no navegador. A chave pública pode ficar no front-end porque o acesso real é limitado pelas regras RLS do banco.

## 3. Testar antes de publicar

Sem Supabase configurado, o site funciona em **modo demonstração**:

- o formulário salva apenas no `localStorage` do navegador;
- a tela `admin.html` aceita qualquer e-mail/senha para visualizar esses testes.

Ao preencher `config.js`, o modo demonstração é desligado automaticamente e os dados passam para o Supabase.

## 4. Publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie todos estes arquivos para a raiz do repositório.
3. Abra **Settings > Pages**.
4. Escolha a branch principal e a pasta raiz como fonte de publicação.
5. Aguarde o GitHub fornecer o endereço do site.

## Área administrativa

Acesse:

`SEU-ENDERECO-GITHUB-PAGES/admin.html`

O fato de o arquivo `admin.html` ser público não expõe os dados. O banco só permite leitura após login e confirmação de que o UUID do usuário está na tabela `admins`.

## Estrutura

- `index.html` — site público e formulário
- `admin.html` — login + painel privado
- `styles.css` — identidade visual e responsividade
- `app.js` — envio do formulário
- `admin.js` — autenticação, dashboard e CSV
- `config.js` — URL e chave pública do Supabase
- `supabase-setup.sql` — banco, tabelas e regras de segurança
- `assets/logo-epm.png` — logo do curso

## Observação jurídica do formulário

O texto público foi propositalmente escrito como **manifestação de interesse em apoio/patrocínio**. Não há promessa automática de participação societária ou retorno financeiro. Se o projeto for realmente oferecer investimento com retorno, participação, juros, receita compartilhada ou outra contrapartida financeira, a proposta e os documentos devem ser revisados juridicamente antes da publicação.
