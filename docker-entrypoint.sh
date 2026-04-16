#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Ensuring admin user and placeholder data..."
node -e "
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const { rows } = await pool.query(\"SELECT id FROM users WHERE email = 'admin@crm.local'\");
  if (rows.length === 0) {
    const hash = await bcrypt.hash(process.env.ADMIN_DEFAULT_PASSWORD || 'changeme', 10);
    await pool.query(
      'INSERT INTO users (email, password, role, created_at, updated_at) VALUES (\$1, \$2, \$3, NOW(), NOW())',
      ['admin@crm.local', hash, 'admin']
    );
    console.log('  Created admin user: admin@crm.local');
  } else {
    console.log('  Admin user already exists');
  }
  await pool.query(\"INSERT INTO clients (id, name, created_at, updated_at) VALUES (0, '未知', NOW(), NOW()) ON CONFLICT (id) DO NOTHING\");
  await pool.end();
})();
"

echo "Checking if staff migration is needed..."
STAFF_COUNT=$(node -e "const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query('SELECT COUNT(*)::int as c FROM staff').then(r=>{console.log(r.rows[0].c);p.end()})")
CASE_COUNT=$(node -e "const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query('SELECT COUNT(*)::int as c FROM cases').then(r=>{console.log(r.rows[0].c);p.end()})")

if [ "$STAFF_COUNT" = "0" ] && [ "$CASE_COUNT" != "0" ]; then
  echo "Staff table empty but cases exist — running staff migration..."
  npx tsx prisma/migrate-staff.ts
else
  echo "Staff migration skipped (staff: $STAFF_COUNT, cases: $CASE_COUNT)"
fi

echo "Starting application..."
exec node server.js
