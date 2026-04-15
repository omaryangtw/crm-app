#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Ensuring admin user exists..."
# Use raw SQL via node + pg (already in node_modules) to create admin if not exists
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

  // Ensure placeholder 'unknown' client exists (id=0) for orphan cases/contacts
  await pool.query(
    \"INSERT INTO clients (id, name, created_at, updated_at) VALUES (0, '未知', NOW(), NOW()) ON CONFLICT (id) DO NOTHING\"
  );

  await pool.end();
})();
"

echo "Starting application..."
exec node server.js
