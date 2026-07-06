import { prisma } from './lib/prisma';
import { hashPassword } from './utils/password';

async function main() {
  const local = await prisma.local.upsert({
    where: { codigo: 'FIL001' },
    update: {},
    create: {
      codigo: 'FIL001',
      nome: 'Filial Matriz',
      responsavel: 'Gran Villar',
    },
  });

  const senhaAdmin = await hashPassword('admin123');
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@granvillar.local',
      passwordHash: senhaAdmin,
      type: 'ADMIN_TI',
      localId: local.id,
    },
  });

  const senhaVendedor = await hashPassword('vendedor123');
  const vendedorUser = await prisma.user.upsert({
    where: { username: 'vendedor' },
    update: {},
    create: {
      username: 'vendedor',
      email: 'vendedor@granvillar.local',
      passwordHash: senhaVendedor,
      type: 'VENDEDOR',
      localId: local.id,
    },
  });

  await prisma.vendedor.upsert({
    where: { usuarioId: vendedorUser.id },
    update: {},
    create: {
      usuarioId: vendedorUser.id,
      nomeCompleto: 'Vendedor Demo',
      localId: local.id,
    },
  });

  console.log('Seed concluído.');
  console.log('  Admin TI:  admin / admin123');
  console.log('  Vendedor:  vendedor / vendedor123');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
