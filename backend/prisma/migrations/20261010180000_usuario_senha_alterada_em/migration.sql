-- Ultima troca de senha: sessoes (tokens) emitidas antes disso deixam de valer,
-- para que trocar a senha desconecte os outros aparelhos.

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "senha_alterada_em" TIMESTAMP(3);
