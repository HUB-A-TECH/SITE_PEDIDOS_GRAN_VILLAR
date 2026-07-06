# Sistema de Pedidos — Gran Villar

Sistema web responsivo para gerenciamento de pedidos de temperos.
Este repositório está na **Fase 1 (Fundação)**: autenticação e login funcional.

## Estrutura

```
.
├── backend/          API Node + Express + Prisma (PostgreSQL)
├── frontend/         App React + Vite + Tailwind
├── docker-compose.yml   PostgreSQL para desenvolvimento
└── PLANEJAMENTO_*.md    Documento de planejamento (na pasta Downloads)
```

## Pré-requisitos

- Node.js 18+ (testado com v24)
- PostgreSQL — via **Docker** (`docker compose up -d db`) **ou** instalação local
  **ou** um banco na nuvem (Neon/Supabase). Basta apontar a `DATABASE_URL`.

## Como rodar (desenvolvimento)

### 1. Banco de dados
Escolha uma opção e ajuste `backend/.env` (`DATABASE_URL`):

- **Docker:** `docker compose up -d db` (usa as credenciais do `docker-compose.yml`)
- **Nuvem (Neon/Supabase):** cole a connection string no `.env`

### 2. Backend
```bash
cd backend
cp .env.example .env        # e edite JWT_SECRET e DATABASE_URL
npm install
npm run prisma:migrate      # cria as tabelas
npm run seed                # cria usuários de teste
npm run dev                 # http://localhost:3333
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

## Usuários de teste (após o seed)

| Usuário    | Senha         | Perfil          |
|------------|---------------|-----------------|
| `admin`    | `admin123`    | Admin TI        |
| `vendedor` | `vendedor123` | Vendedor        |

> Troque essas senhas antes de qualquer uso real.

## Decisões técnicas (Fase 1)

- **Autenticação:** JWT em **cookie HttpOnly + SameSite=Strict** (não localStorage).
- **Logout:** revoga o `jti` do token na tabela `tokens_revogados`.
- **Senhas:** hash com `bcryptjs` (10 rounds).
- **Dev:** o Vite faz proxy de `/api` para o backend, mantendo o cookie same-origin.
