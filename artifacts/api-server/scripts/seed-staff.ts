import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";

async function main() {
  const adminHash = await bcrypt.hash("Admin@123!", 10);
  const managerHash = await bcrypt.hash("Manager@123!", 10);

  const { rows: firstBranch } = await pool.query(
    `SELECT id FROM branches ORDER BY created_at LIMIT 1`
  );
  const defaultBranchId = firstBranch[0]?.id;

  await pool.query(
    `INSERT INTO staff (id, branch_id, full_name, email, password_hash, role, is_active)
     SELECT gen_random_uuid(), $2, 'Super Admin', 'admin@klproject.com', $1, 'super_admin', true
     WHERE NOT EXISTS (SELECT 1 FROM staff WHERE email = 'admin@klproject.com')`,
    [adminHash, defaultBranchId]
  );
  console.log("✓ Super admin: admin@klproject.com / Admin@123!");

  const { rows: branches } = await pool.query(
    `SELECT id, name, internal_code FROM branches ORDER BY name`
  );

  for (const branch of branches as { id: string; name: string; internal_code: string }[]) {
    const email = `${branch.internal_code.toLowerCase()}@klproject.com`;
    await pool.query(
      `INSERT INTO staff (id, branch_id, full_name, email, password_hash, role, is_active)
       SELECT gen_random_uuid(), $1, $2, $3::varchar, $4, 'branch_manager', true
       WHERE NOT EXISTS (SELECT 1 FROM staff WHERE email = $3::varchar)`,
      [branch.id, `${branch.name} Manager`, email, managerHash]
    );
    console.log(`✓ Branch manager: ${email} / Manager@123!`);
  }

  await pool.end();
}

main().catch(console.error);
