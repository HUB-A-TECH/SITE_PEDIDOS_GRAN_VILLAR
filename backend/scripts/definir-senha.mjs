// Define/troca a senha de um usuário existente.
// Uso: node scripts/definir-senha.mjs <username> <novaSenha>

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const [, , username, senha] = process.argv;

if (!username || !senha) {
  console.error('Uso: node scripts/definir-senha.mjs <username> <novaSenha>');
  process.exit(1);
}
if (senha.length < 6) {
  console.error('A senha deve ter ao menos 6 caracteres.');
  process.exit(1);
}

const hash = await bcrypt.hash(senha, 10);
try {
  await prisma.user.update({ where: { username }, data: { passwordHash: hash } });
  console.log(`Senha do usuário "${username}" atualizada com sucesso.`);
} catch {
  console.error(`Usuário "${username}" não encontrado.`);
  process.exit(1);
}
await prisma.$disconnect();
