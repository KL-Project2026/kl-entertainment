import { pool } from "@workspace/db";

export async function seedDefaultData(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Organization
    await client.query(`
      INSERT INTO organizations (id, name, slug, base_currency, default_tz, default_lang)
      VALUES (
        '00000000-0000-0000-0000-000000000001',
        'KL Entertainment Group',
        'kl-entertainment',
        'MYR',
        'Asia/Kuala_Lumpur',
        'en'
      )
      ON CONFLICT (id) DO NOTHING
    `);

    // 2. Branches
    await client.query(`
      INSERT INTO branches (id, org_id, name, internal_code, city, country, timezone, currency, is_active)
      VALUES
        (
          'd44ca290-a086-439d-9657-07fc5ebb689c',
          '00000000-0000-0000-0000-000000000001',
          'Club Noir KL', 'KL01', 'Kuala Lumpur', 'MY',
          'Asia/Kuala_Lumpur', 'MYR', true
        ),
        (
          '6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c',
          '00000000-0000-0000-0000-000000000001',
          'Velvet Lounge PJ', 'KL02', 'Petaling Jaya', 'MY',
          'Asia/Kuala_Lumpur', 'MYR', true
        )
      ON CONFLICT (id) DO NOTHING
    `);

    // 3. Demo staff accounts (password hashes pre-generated with bcrypt)
    // admin@klproject.com → Admin@123!
    // kl01/kl02@klproject.com → Manager@123!
    await client.query(`
      INSERT INTO staff (id, full_name, email, password_hash, role, branch_id, is_active)
      VALUES
        (
          'baa4adfd-09ee-457e-bcd5-3fa7e1569616',
          'Super Admin',
          'admin@klproject.com',
          '$2b$10$lliUNyH1Hhwq76rFwzLj.eJhfR5KoH9Qd5bc6KXTnhHMbWxQ3wSJ6',
          'super_admin',
          'd44ca290-a086-439d-9657-07fc5ebb689c',
          true
        ),
        (
          '3b9300ec-caa6-48b6-8ce2-6aa5fcf07363',
          'Club Noir KL Manager',
          'kl01@klproject.com',
          '$2b$10$Wpkr6o8HUo8WRoiZpMFXruhFR0bGrWy2Pdl6UG84Z3zF5m.Qu8B4K',
          'branch_manager',
          'd44ca290-a086-439d-9657-07fc5ebb689c',
          true
        ),
        (
          'cb9837c5-33f1-4c67-8b4a-85e4922258f3',
          'Velvet Lounge PJ Manager',
          'kl02@klproject.com',
          '$2b$10$Wpkr6o8HUo8WRoiZpMFXruhFR0bGrWy2Pdl6UG84Z3zF5m.Qu8B4K',
          'branch_manager',
          '6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c',
          true
        )
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query("COMMIT");
    console.log("[seed] Default organization, branches, and staff seeded successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[seed] Seeding failed:", err);
  } finally {
    client.release();
  }
}
