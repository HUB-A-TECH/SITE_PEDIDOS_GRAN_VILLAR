# Sistema de Pedidos — Gran Villar

Sistema web responsivo para pedidos de temperos: vendedores montam o pedido do
cliente no celular; a administração (comercial e TI) acompanha, revisa e aprova.

## O que o sistema faz

- **Vendedor:** escolhe o cliente do seu setor, monta o pedido a partir do *mix* do
  cliente (preço da tabela do cliente; o vendedor só pode baixar o preço), vê o
  histórico de compras, escreve anotações de visita, envia o pedido e baixa PDF/TXT.
- **Admin Comercial:** vê e revisa os pedidos enviados, aprova, administra setores,
  clientes, mix, produtos, categorias e tabelas de preço.
- **Admin TI:** tudo do comercial, mais usuários e "Dados da Empresa" (filiais).
- **Minha Conta:** cada pessoa troca seus dados, usuário e senha.

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
cd backend && npm test      # permissões, sessão, fluxo do pedido, limites (usa o banco do .env)
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
  Trocar a senha ou desativar a conta derruba as sessões abertas.
- **Logout:** revoga o `jti` do token na tabela `tokens_revogados`.
- **Senhas:** hash com `bcryptjs`. Limite de tentativas no login e em Minha Conta.
- **Desempenho em rede fraca:** telas de administração carregam sob demanda, o site
  fica em cache longo, e as rotas do pedido fazem poucas idas ao banco.
- **Dev:** o Vite faz proxy de `/api` para o backend, mantendo o cookie same-origin.
