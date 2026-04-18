require('dotenv').config();
const { Pool } = require('pg');
const { encrypt, decrypt } = require('./db/crypto');

const NEW_TOKEN = '483e22f0a38133d6394733845e9f39b86c45a673962458148627b74863c77d80';

(async () => {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'devuser',
    password: process.env.DB_PASSWORD || 'devpass123',
    database: process.env.DB_NAME || 'devdb',
  });
  const r = await pool.query("SELECT id, env_vars FROM projects WHERE name=$1", ['TwinverseAI']);
  if (!r.rows.length) { console.log('project not found'); process.exit(1); }
  const row = r.rows[0];

  let env;
  const ev = row.env_vars;
  if (typeof ev === 'string') env = JSON.parse(decrypt(ev));
  else if (ev && typeof ev === 'object' && typeof ev.ciphertext === 'string') env = JSON.parse(decrypt(ev.ciphertext));
  else { console.error('unexpected env_vars shape'); process.exit(3); }

  const before = env.OPENCLAW_TOKEN || '(unset)';
  const match = before === NEW_TOKEN;
  console.log('before (masked):', before.slice(0,8) + '...' + before.slice(-4), 'match:', match);
  if (match) { console.log('already correct, no change'); await pool.end(); return; }

  env.OPENCLAW_TOKEN = NEW_TOKEN;
  const ct = encrypt(JSON.stringify(env));
  await pool.query('UPDATE projects SET env_vars=$1::jsonb WHERE id=$2', [JSON.stringify(ct), row.id]);

  const v = await pool.query('SELECT env_vars FROM projects WHERE id=$1', [row.id]);
  const roundtrip = JSON.parse(decrypt(v.rows[0].env_vars));
  const after = roundtrip.OPENCLAW_TOKEN || '';
  console.log('after  (masked):', after.slice(0,8) + '...' + after.slice(-4));
  console.log('total keys:', Object.keys(roundtrip).length);
  console.log('updated OPENCLAW_TOKEN ->', NEW_TOKEN);
  await pool.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(2); });
