// Importa produtos de uma planilha de preços (formato "CÁLCULO DE PEDIDO").
// Uso: node scripts/importar-produtos.mjs "caminho/da/planilha.xlsx" [--limpar-teste]
//
// A planilha tem 2 blocos de colunas por linha (COD, PRODUTOS, UND, VALOR, SOMA).
// A categoria é deduzida pelo nome; a unidade padrão é UND.

import xlsx from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const arquivo = process.argv[2];
const limparTeste = process.argv.includes('--limpar-teste');
if (!arquivo) {
  console.error('Informe o caminho da planilha .xlsx');
  process.exit(1);
}

const semAcento = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

// Regras de dedução (checadas nesta ordem). Palavra inteira (\b) para evitar
// falsos positivos (ex.: CHIA não vira CHÁ).
const REGRAS = [
  ['ALHOS', [/\bALHO/]],
  ['SAIS', [/\bSAL\b/, /\bSAIS\b/, /\bFLOR DE SAL\b/]],
  ['CHAS', [/\bCHA\b/, /HIBISCUS/, /CAMOMILA/, /MELISSA/, /BOLDO/, /CAVALINHA/, /CARQUEJA/, /\bSENE\b/, /ESPINHEIRA/, /GINKGO/, /GINSENG/, /GUACO/, /CIDREIRA/, /ERVA DOCE/, /QUEBRA PEDRA/, /SETE SANGRIAS/, /GRAVIOLA/, /SUCUPIRA/, /CENTELHA/]],
  ['PIMENTAS', [/PIMENTA/, /PEPER/, /PEPPER/, /CALABRESA/, /\bCHILI/, /\bCHILLI/, /DEFUMAD/]],
  ['ERVAS', [/OREGANO/, /SALSA/, /SALSINHA/, /CEBOLINHA/, /CHEIRO VERDE/, /MANJERICAO/, /ALECRIM/, /TOMILHO/, /LOURO/, /COENTRO/, /HORTELA/, /ALFAZEMA/, /MANJERONA/, /SALVIA/, /\bENDRO\b/, /ESTRAGAO/, /ERVAS FINAS/, /ERVA DE/, /MENTA/]],
  ['ESPECIARIAS', [/CANELA/, /CRAVO/, /NOZ MOSC/, /\bNOZ\b/, /GENGIBRE/, /CURRY/, /COLORIF/, /COLORII/, /COLORAU/, /URUCUM/, /ACAFRAO/, /CURCUMA/, /PAPRICA/, /\bANIS\b/, /\bANIZ\b/, /ESTRELADO/, /COMINHO/, /CARDAMOMO/, /ZIMBRO/, /GARAM/, /MASALA/, /PAGE/, /GERGELIM/, /SEMENTE DE ANIS/]],
];

function deduzirCategoria(nome) {
  const n = semAcento(nome);
  for (const [cat, padroes] of REGRAS) {
    if (padroes.some((re) => re.test(n))) return cat;
  }
  return 'OUTROS';
}

function extrairProdutos(caminho) {
  const wb = xlsx.readFile(caminho);
  const ws = wb.Sheets['Planilha1'] ?? wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const lista = [];
  const vistos = new Set();
  const add = (cod, nome, valor) => {
    cod = String(cod).trim();
    nome = String(nome).trim().replace(/\s+/g, ' ');
    if (!cod || !nome || cod.toUpperCase() === 'COD') return;
    const preco = Number(valor);
    if (!Number.isFinite(preco) || preco <= 0) return;
    if (vistos.has(cod)) return;
    vistos.add(cod);
    lista.push({ codigo: cod, nome, preco, categoria: deduzirCategoria(nome) });
  };
  for (const r of rows) {
    add(r[1], r[2], r[4]); // bloco esquerdo
    add(r[6], r[7], r[9]); // bloco direito
  }
  return lista;
}

async function main() {
  const produtos = extrairProdutos(arquivo);
  console.log(`Extraídos ${produtos.length} produtos.`);

  const contagem = {};
  for (const p of produtos) contagem[p.categoria] = (contagem[p.categoria] ?? 0) + 1;
  console.log('Distribuição por categoria:', contagem);

  let criados = 0;
  let atualizados = 0;
  for (const p of produtos) {
    const existente = await prisma.produto.findUnique({ where: { codigo: p.codigo } });
    await prisma.produto.upsert({
      where: { codigo: p.codigo },
      update: { nome: p.nome, preco: p.preco, categoria: p.categoria },
      create: {
        codigo: p.codigo,
        nome: p.nome,
        categoria: p.categoria,
        preco: p.preco,
        unidadeMedida: 'UND',
      },
    });
    if (existente) atualizados++;
    else criados++;
  }
  console.log(`Importação: ${criados} criados, ${atualizados} atualizados.`);

  if (limparTeste) {
    // Remove os produtos de teste (e rascunhos que os referenciam).
    await prisma.pedido.deleteMany({ where: { status: 'RASCUNHO' } });
    const del = await prisma.produto.deleteMany({
      where: { codigo: { in: ['ALH001', 'PIM001', 'SAL001'] } },
    });
    console.log(`Limpeza de teste: ${del.count} produtos de teste removidos.`);
  }

  const total = await prisma.produto.count();
  console.log(`Total de produtos no catálogo agora: ${total}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
