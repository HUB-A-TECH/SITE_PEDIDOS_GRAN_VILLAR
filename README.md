# Sistema de Pedidos — Gran Villar

Sistema web responsivo para pedidos de temperos: vendedores montam o pedido do
cliente no celular; a administração (comercial e TI) acompanha, revisa e aprova.

## O que o sistema faz

- **Vendedor:** escolhe o cliente do seu setor, monta o pedido a partir do *mix* do
  cliente (preço da tabela do cliente; o vendedor só pode baixar o preço), vê o
  histórico de compras, escreve anotações de visita, envia o pedido e baixa PDF/TXT.
- **Admin Comercial:** vê e revisa os pedidos enviados, aprova, administra setores,
  clientes, mix, produtos, categorias e tabelas de preço.
- **Comercial + Vendedor:** uma conta só para quem faz as duas funções. Na tela
  inicial há dois botões, **Comercial** e **Vendedor**, para trocar de modo (entra
  como Comercial). Cada pessoa tem o próprio login, sem senha compartilhada.
- **Admin TI:** tudo do comercial, mais usuários e "Dados da Empresa" (filiais).
  Na tela **Usuários** escolhe o perfil de cada pessoa por botões (Vendedor,
  Comercial, Comercial + Vendedor, Admin TI) e pode mudar o perfil de quem já está
  cadastrado entre os três primeiros, sem perder pedidos nem carteira.
- **Minha Conta:** cada pessoa troca seus dados, usuário e senha.

### Como funciona o "Comercial + Vendedor"

Não é um tipo novo no banco: é uma conta `ADMIN_COMERCIAL` com cadastro de vendedor
**ativo** (`backend/src/lib/perfil.ts`). A sessão está sempre em um modo só
(o `type` do token), então as permissões continuam as mesmas: no modo vendedor a
pessoa vê só a carteira dela; no modo comercial, o painel do comercial. A troca é
`POST /api/auth/modo` e encerra o token anterior. Quando o Admin TI tira a função de
vendedor, o cadastro de vendedor fica inativo (os pedidos antigos continuam ligados
a ele) e a sessão aberta no modo que deixou de valer cai na hora.

## Estrutura

```
.
├── backend/             API Node + Express + Prisma (PostgreSQL)
│   ├── src/modules/     um módulo por assunto (rotas -> controller -> service)
│   ├── prisma/          schema e migrations
│   ├── scripts/         ferramentas manuais (definir senha, importar produtos, seeds de demonstração)
│   └── tests/           testes automáticos (vitest + supertest) e ferramentas de medição
├── frontend/            App React + Vite + Tailwind
│   └── scripts/         orçamento de tamanho do site
├── docker-compose.yml   PostgreSQL para desenvolvimento
└── render.yaml          configuração do Render (site no ar)
```

## Pré-requisitos

- Node.js 20+ (ver `.node-version`)
- PostgreSQL — via **Docker** (`docker compose up -d db`) **ou** instalação local
  **ou** um banco na nuvem (Neon). Basta apontar a `DATABASE_URL`.

## Como rodar (desenvolvimento)

### 1. Backend
```bash
cd backend
cp .env.example .env        # e edite JWT_SECRET e DATABASE_URL
npm install
npm run prisma:migrate      # cria as tabelas (NUNCA em um banco que já está no ar)
npm run seed                # cria usuários de teste
npm run dev                 # http://localhost:3333
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

## Testes e conferências

```bash
cd backend && npm test      # permissões, sessão, perfis, fluxo do pedido, limites (usa o banco do .env)
npm run auditar             # (na raiz) build + orçamento de tamanho + todos os testes
```

Os testes mexem **só** no cliente de teste "Mercado X" e em usuários descartáveis
`TESTE_zz_*`, e apagam o que criam. Mesmo assim, só rode contra um banco em que isso
seja aceitável. Depois de subir uma versão, `backend/tests/ferramentas/conferir-no-ar.mjs`
faz uma conferência de leitura no site no ar.

## Usuários de teste (após o seed)

| Usuário     | Senha            | Perfil          |
|-------------|------------------|-----------------|
| `admin`     | `admin123`       | Admin TI        |
| `comercial` | `comercial123`   | Admin Comercial |
| `vendedor`  | `vendedor123`    | Vendedor        |

> **Troque essas senhas antes de qualquer uso real** (`backend/scripts/definir-senha.mjs`).

## Decisões técnicas

- **Autenticação:** JWT em **cookie HttpOnly** (não localStorage), válido por 8 h.
  Trocar a senha, desativar a conta ou mudar o perfil derruba as sessões abertas.
- **Logout:** revoga o `jti` do token na tabela `tokens_revogados`.
- **Senhas:** hash com `bcryptjs`. Limite de tentativas no login e em Minha Conta.
- **Desempenho em rede fraca:** telas de administração carregam sob demanda, o site
  fica em cache longo, e as rotas do pedido fazem poucas idas ao banco.
- **Segurança do navegador (CSP):** o site só pode chamar a própria API e as duas
  fontes de CEP (ViaCEP e BrasilAPI), liberadas em `backend/src/app.ts`.
- **Dev:** o Vite faz proxy de `/api` para o backend, mantendo o cookie same-origin.
