import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db/pool';

/**
 * Cria (ou atualiza a senha de) o primeiro usuário do painel admin. Não há
 * tela de cadastro — o primeiro acesso é sempre criado por aqui.
 *
 * Uso:
 *   npx ts-node scripts/create-owner.ts "Nome" email@exemplo.com senha123
 */
async function main() {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.error('Uso: npx ts-node scripts/create-owner.ts "Nome" email@exemplo.com senha123');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await pool.execute(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES (?, ?, ?, 'owner')
     ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash)`,
    [name, email, passwordHash]
  );

  console.log(`Usuário owner criado/atualizado: ${email}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
