## Célula Raízes – Aplicação Web (Supabase + GitHub Pages)

Aplicação SPA estática para gerenciamento da célula cristã **“Célula Raízes”**, com:

- **Área pública**: aniversários, agenda, escala da célula, galeria de fotos.
- **Área administrativa protegida**: gestão de membros, agenda, escalas, fotos, presenças e relatórios.
- **Backend**: Supabase (PostgreSQL + Auth + Storage).
- **Frontend**: HTML + CSS + JS puro, mobile-first, compatível com GitHub Pages.

---

### 1. Estrutura de pastas

- `index.html` – SPA principal (área pública + admin).
- `src/styles.css` – estilos mobile-first (azul, cinza, branco).
- `src/app.js` – lógica de UI + integração com Supabase.
- `README.md` – este guia.

Opcional (quando versionado em GitHub):

- `.github/workflows/gh-pages.yml` – workflow para deploy automático no GitHub Pages.

---

### 2. Configuração do Supabase

1. Crie um projeto em `https://supabase.com`.
2. Na aba **Project Settings → API**, anote:
   - **Project URL**
   - **anon public key**
3. Na aba **Authentication → Email**:
   - Ative **Email + Password**.
   - Desative provedores sociais que não serão usados.

#### 2.1. Tabelas

Crie as tabelas abaixo na aba **Table Editor → New Table**.

**`membros`**

- `id` – `uuid`, PK, default `uuid_generate_v4()`.
- `nome` – `text`, not null.
- `tipo` – `text` (`Membro`, `FA`, `Visitante`).
- `data_nascimento` – `date`, not null.
- `aniversario_ajustado` – `date`, nullable.
- `batismo` – `text` (`Videira`, `Outra Igreja`, `Nenhum`).
- `encontro_com_deus` – `boolean`, default `false`.
- `cursos` – `text[]`, default `{}`.

**`agenda`**

- `id` – `bigint`, PK, auto increment.
*-* `data` – `date`, not null.
- `descricao` – `text`, not null.

**`escalas`**

- `id` – `bigint`, PK, auto increment.
- `data` – `date`, not null.
- `quebra_gelo_id` – `uuid`, FK → `membros.id`.
- `louvor_id` – `uuid`, FK → `membros.id`.
- `lanche_id` – `uuid`, FK → `membros.id`.
- `midia_id` – `uuid`, FK → `membros.id`.

**`fotos`**

- `id` – `bigint`, PK, auto increment.
- `url` – `text`, not null.
- `upload_date` – `timestamptz`, default `now()`.

**`presencas`**

- `id` – `bigint`, PK, auto increment.
- `meeting_date` – `date`, not null.
- `member_id` – `uuid`, FK → `membros.id`, nullable.
- `present` – `boolean`, not null.
- `type` – `text` (`membro`, `visitante`).
- `nome_visitante` – `text`, nullable (usado quando `type = 'visitante'`).

---

### 3. Storage (fotos)

1. Na aba **Storage → New bucket**:
   - Nome do bucket: `fotos`
   - Public: **true** (necessário para exibir imagens diretamente no GitHub Pages).
2. Crie uma pasta opcional chamada `celula-raizes/` (ou deixe que o código crie o path automaticamente).

---

### 4. Políticas de segurança (RLS)

Ative **RLS (Row Level Security)** em todas as tabelas.

Para manter a app estática segura com Supabase no frontend:

- O **anon key** será exposto no código, mas:
  - Usuários não autenticados devem ter **apenas SELECT nas tabelas públicas** (`membros`, `agenda`, `escalas`, `fotos`) com filtros adequados.
  - Operações de escrita (INSERT / UPDATE / DELETE) devem ser **restritas a usuários autenticados** (role `authenticated`).

Exemplo de políticas (simplificado; ajuste conforme necessidade):

**Tabela `membros`**

- Política 1 – Select público (somente campos necessários, opcionalmente via view):
  - `USING ( true )` para `SELECT` (ou crie uma view apenas para aniversários/escalas).
- Política 2 – Escrita apenas autenticado:
  - `USING ( auth.role() = 'authenticated' )` para `INSERT/UPDATE/DELETE`.

Repita a lógica para:

- `agenda` – `SELECT` liberado, escrita apenas autenticado.
- `escalas` – `SELECT` liberado, escrita apenas autenticado.
- `fotos` – `SELECT` liberado, escrita apenas autenticado.
- `presencas` – **somente authenticated** em `SELECT/INSERT/UPDATE/DELETE` (dados sensíveis).

> Recomenda-se revisar a documentação oficial de RLS do Supabase para escrever políticas mais específicas (por exemplo, amarrando o admin a um `user_id` da tabela).

---

### 5. Criação do usuário admin

1. Na aba **Authentication → Users → Invite / Add user**.
2. Crie um usuário com e-mail de admin (ex.: `admin@celularaizes.com`) e senha forte.
3. Use essas credenciais apenas na **tela de login da área administrativa**, nunca no código.

Não há necessidade de campo “is_admin” se apenas esse usuário for usado como admin.
Caso queira múltiplos admins, crie uma tabela `admins` ligada a `auth.users` e use RLS para restringir.

---

### 6. Ligando o frontend ao Supabase (chaves sem senha no código)

No arquivo `src/app.js`, o cliente é criado assim:

```js
const SUPABASE_URL = window.SUPABASE_URL || "https://SEU-PROJETO.supabase.co";
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "SEU_ANON_KEY_AQUI";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

**Recomendado em produção:**

- Injetar `window.SUPABASE_URL` e `window.SUPABASE_ANON_KEY` dinamicamente no `index.html` em tempo de deploy (por exemplo, via GitHub Actions com `secrets`), em vez de manter o valor fixo no arquivo.
- Exemplo simplificado no `index.html`:

```html
<script>
  window.SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
  window.SUPABASE_ANON_KEY = "SEU_ANON_KEY_AQUI";
</script>
```

> Nunca salve ou exponha a **senha** do admin em lugar nenhum do código. A autenticação é sempre feita via `supabase.auth.signInWithPassword`.

---

### 7. Fluxo de autenticação segura (Admin)

Na área admin (`index.html` + `src/app.js`):

1. O usuário acessa a aba **Admin**.
2. É exibido o formulário de login:
   - `supabase.auth.signInWithPassword({ email, password })`
3. Se a autenticação for bem-sucedida:
   - O frontend chama `supabase.auth.getSession()` ou usa o listener `supabase.auth.onAuthStateChange`.
   - Apenas se houver `session.user`, o painel admin é exibido.
4. Ao sair:
   - `supabase.auth.signOut()`
   - Painel admin volta a ficar oculto.

**Proteção adicional:**

- Todos os endpoints de escrita (INSERT/UPDATE/DELETE) dependem de políticas RLS que exigem `auth.role() = 'authenticated'`.
- Isso significa que mesmo que alguém tente manipular chamadas pelo console do navegador sem estar logado, o banco não aceitará as mudanças.

---

### 8. Desenvolvimento local

1. Clone ou copie o projeto para sua máquina.
2. Configure `window.SUPABASE_URL` e `window.SUPABASE_ANON_KEY` no `index.html` (ambiente de desenvolvimento).
3. Abra o arquivo `index.html` diretamente no navegador ou sirva com um servidor simples:

```bash
# usando Python, por exemplo
python -m http.server 5173
```

4. Acesse `http://localhost:5173` e teste:
   - Área pública (sem login).
   - Login admin.
   - CRUDs de agenda, escalas, membros, fotos.
   - Registro de presenças e relatórios.

Teste em:

- **Mobile**: DevTools (modo responsivo) e celular real, se possível.
- **Desktop**: diferentes larguras de tela.

---

### 9. Deploy no GitHub Pages

1. Crie um repositório no GitHub, por exemplo, `celula-raizes`.
2. Faça commit dos arquivos (`index.html`, `src/`, `README.md` etc.).
3. **Opção simples (sem workflow)**:
   - Vá em **Settings → Pages**.
   - Selecione branch `main` e pasta `/ (root)` e salve.
4. **Opção com workflow automático** (recomendado):
   - Crie a pasta `.github/workflows/` com um arquivo `gh-pages.yml` usando o template abaixo.

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: .

      - name: Deploy to GitHub Pages
        uses: actions/deploy-pages@v4
```

5. Após o primeiro deploy, o GitHub mostrará a URL pública da aplicação.

---

### 10. Otimizações de performance

- **Lazy-loading de imagens**: atributo `loading="lazy"` nas fotos da galeria.
- **SPA única**: reduz navegações completas; apenas troca de seções com JS.
- **Dependências via CDN**:
  - Supabase JS.
  - Chart.js.
- CSS focado em mobile-first:
  - Layout simples para telas pequenas.
  - Media queries apenas para melhorias em telas maiores.

---

### 11. Guia rápido de funcionalidades (Admin)

- **Conteúdo Público**
  - Adicionar/editar/excluir itens de **agenda**.
  - Registrar **escalas** ligando membros aos papéis (quebra-gelo, louvor, lanche, mídia).
  - Upload de **fotos** para o bucket `fotos` (Supabase Storage).

- **Membros**
  - Campos completos de perfil ministerial.
  - Cursos como múltipla seleção (`Ceifeiros`, `Maturidade`, `CTL`, `Pastoral`).
  - Geração automática de aniversários a partir de `data_nascimento` (com ajuste opcional).

- **Presenças**
  - Marca presença de cada membro por data.
  - Registro de visitantes temporários.

- **Relatórios**
  - Gráfico de presença por encontro.
  - Média geral de presença.
  - Gráfico de presença por membro.

---

### 12. Passo a passo resumido para colocar em produção

1. Criar projeto Supabase + tabelas + bucket + RLS.
2. Criar usuário admin (apenas e-mail/senha, sem expor senha no código).
3. Configurar `window.SUPABASE_URL` e `window.SUPABASE_ANON_KEY` no `index.html` usando os valores do projeto.
4. Testar localmente:
   - Login.
   - CRUDs.
   - Relatórios.
5. Subir para um repositório GitHub.
6. Ativar GitHub Pages (com ou sem workflow).
7. Validar em dispositivos móveis e desktop.

Com isso, você terá uma aplicação estática, moderna e segura para gerenciar a **Célula Raízes**, utilizando Supabase como backend e GitHub Pages como hospedagem.

