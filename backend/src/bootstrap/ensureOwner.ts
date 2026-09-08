import bcrypt from 'bcryptjs';
import { pool } from '../db/pool';

/**
 * Cria (ou atualiza a senha de) o usuário owner a partir de variáveis de
 * ambiente, se BOOTSTRAP_OWNER_EMAIL e BOOTSTRAP_OWNER_PASSWORD estiverem
 * definidas. Existe porque hospedagens compartilhadas (ex.: Hostinger)
 * costumam não dar acesso a terminal/SSH para rodar scripts/create-owner.ts
 * manualmente — isso roda automaticamente a cada boot do servidor.
 * Seguro rodar sempre: é um upsert por e-mail (ON DUPLICATE KEY UPDATE).
 */
export async function ensureOwnerFromEnv(): Promise<void> {
  const email = process.env.BOOTSTRAP_OWNER_EMAIL;
  const password = process.env.BOOTSTRAP_OWNER_PASSWORD;
  const name = process.env.BOOTSTRAP_OWNER_NAME || 'Admin';
  if (!email || !password) return;

  const passwordHash = await bcrypt.hash(password, 10);
  await pool.execute(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES (?, ?, ?, 'owner')
     ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash)`,
    [name, email, passwordHash]
  );
  console.log(`[bootstrap] usuário owner garantido: ${email}`);
}
