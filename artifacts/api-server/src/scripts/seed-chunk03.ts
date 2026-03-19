import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    // Fetch branch IDs
    const { rows: branches } = await client.query(`SELECT id, internal_code FROM branches ORDER BY internal_code`);
    if (branches.length === 0) throw new Error("No branches found — run Chunk 01 seed first");
    
    const branch1 = branches[0];
    const branch2 = branches[1] || branches[0];
    
    console.log(`Seeding against branch: ${branch1.internal_code} (${branch1.id})`);

    // Fetch a staff user for created_by
    const { rows: staff } = await client.query(`SELECT id FROM staff LIMIT 1`);
    const staffId = staff[0]?.id;

    // Fetch product groups
    const { rows: groups } = await client.query(`SELECT id FROM product_groups WHERE branch_id = $1 LIMIT 1`, [branch1.id]);
    let groupId = groups[0]?.id;

    if (!groupId) {
      const { rows: newGroup } = await client.query(
        `INSERT INTO product_groups (id, org_id, branch_id, name, sort_order, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', $1, '{"en":"Beverages","zh":"饮料","ms":"Minuman","ko":null,"ja":null,"th":null}', 1, true, now(), now())
         RETURNING id`,
        [branch1.id]
      );
      groupId = newGroup[0].id;
    }

    // Fetch product type
    const { rows: types } = await client.query(`SELECT id FROM product_types WHERE group_id = $1 LIMIT 1`, [groupId]);
    let typeId = types[0]?.id;

    if (!typeId) {
      const { rows: newType } = await client.query(
        `INSERT INTO product_types (id, group_id, name, sort_order, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, '{"en":"Alcohol","zh":"酒精","ms":"Alkohol","ko":null,"ja":null,"th":null}', 1, true, now(), now())
         RETURNING id`,
        [groupId]
      );
      typeId = newType[0].id;
    }

    // Seed products
    const products = [
      { sku: "BEV-BEER-001", name: '{"en":"Tiger Beer (Can)","zh":"老虎啤酒","ms":"Tiger Beer","ko":null,"ja":null,"th":null}', unit: "can", price: 25, taxable: true },
      { sku: "BEV-BEER-002", name: '{"en":"Heineken (Bottle)","zh":"喜力啤酒","ms":"Heineken Botol","ko":null,"ja":null,"th":null}', unit: "bottle", price: 30, taxable: true },
      { sku: "BEV-SPIRIT-001", name: '{"en":"Chivas Regal 12Y","zh":"芝华士12年","ms":"Chivas Regal 12Y","ko":null,"ja":null,"th":null}', unit: "bottle", price: 380, taxable: true },
      { sku: "BEV-SPIRIT-002", name: '{"en":"Hennessy VSOP","zh":"轩尼诗VSOP","ms":"Hennessy VSOP","ko":null,"ja":null,"th":null}', unit: "bottle", price: 520, taxable: true },
      { sku: "BEV-SOFT-001", name: '{"en":"Red Bull","zh":"红牛","ms":"Red Bull","ko":null,"ja":null,"th":null}', unit: "can", price: 18, taxable: true },
      { sku: "BEV-SOFT-002", name: '{"en":"Mineral Water","zh":"矿泉水","ms":"Air Mineral","ko":null,"ja":null,"th":null}', unit: "bottle", price: 8, taxable: false },
      { sku: "FOOD-001", name: '{"en":"Fruit Platter","zh":"水果拼盘","ms":"Platter Buah","ko":null,"ja":null,"th":null}', unit: "plate", price: 88, taxable: true },
      { sku: "FOOD-002", name: '{"en":"Chips & Nuts Mix","zh":"薯片坚果拼盘","ms":"Kerepek & Kacang","ko":null,"ja":null,"th":null}', unit: "plate", price: 35, taxable: true },
      { sku: "FOOD-003", name: '{"en":"Ice Bucket","zh":"冰桶","ms":"Baldi Ais","ko":null,"ja":null,"th":null}', unit: "bucket", price: 15, taxable: false },
    ];

    let insertedProducts = 0;
    for (const p of products) {
      const exists = await client.query(`SELECT id FROM products WHERE sku = $1`, [p.sku]);
      if (exists.rows.length === 0) {
        await client.query(
          `INSERT INTO products (id, type_id, sku, name, unit, unit_price, tax_applicable, sort_order, is_active, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3::jsonb, $4, $5, $6, $7, true, now(), now())`,
          [typeId, p.sku, p.name, p.unit, p.price, p.taxable, insertedProducts + 1]
        );
        insertedProducts++;
      }
    }
    console.log(`✓ Products: inserted ${insertedProducts} new`);

    // Seed sample reservations
    const { rows: rooms } = await client.query(
      `SELECT id, name, room_type FROM rooms WHERE branch_id = $1 ORDER BY name LIMIT 6`,
      [branch1.id]
    );

    if (rooms.length === 0) {
      console.log("⚠ No rooms found for branch — skipping reservations");
      return;
    }

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const reservations = [
      {
        no: `RES${Date.now().toString().slice(-6)}A`,
        customer: "Wong Wai Kit", phone: "+60123456789",
        guests: 4, status: "confirmed",
        start: `${todayStr}T19:00:00`, end: `${todayStr}T22:00:00`, duration: 3,
        room: rooms[0]?.id, deposit: 200, deposit_paid: true, deposit_method: "cash",
        channel: "phone",
      },
      {
        no: `RES${Date.now().toString().slice(-6)}B`,
        customer: "Lee Mei Ling", phone: "+60198765432",
        guests: 6, status: "checked_in",
        start: `${todayStr}T20:00:00`, end: `${todayStr}T23:00:00`, duration: 3,
        room: rooms[1]?.id, deposit: 300, deposit_paid: true, deposit_method: "bank_transfer",
        channel: "whatsapp", checked_in_at: new Date().toISOString(),
      },
      {
        no: `RES${Date.now().toString().slice(-6)}C`,
        customer: "Ahmad Faizal", phone: "+60112233445",
        guests: 2, status: "tentative",
        start: `${todayStr}T21:00:00`, end: `${todayStr}T23:00:00`, duration: 2,
        room: rooms[2]?.id, deposit: 0, deposit_paid: false, deposit_method: null,
        channel: "walk_in",
      },
      {
        no: `RES${Date.now().toString().slice(-6)}D`,
        customer: "Tan Siew Fong", phone: "+60167890123",
        guests: 8, status: "confirmed",
        start: `${todayStr}T18:30:00`, end: `${todayStr}T22:30:00`, duration: 4,
        room: rooms[3]?.id, deposit: 500, deposit_paid: true, deposit_method: "ewallet",
        channel: "app", confirmed_at: new Date().toISOString(),
      },
    ];

    let insertedRes = 0;
    for (const r of reservations) {
      const exists = await client.query(`SELECT id FROM reservations WHERE reservation_no = $1`, [r.no]);
      if (exists.rows.length === 0) {
        await client.query(
          `INSERT INTO reservations (
            id, org_id, branch_id, reservation_no, customer_name, customer_phone,
            guest_count, status, reservation_date, start_time, end_time, duration_hours,
            room_id, booking_channel, is_outcall, deposit_amount, deposit_paid, deposit_method,
            confirmed_at, checked_in_at, created_by, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), '00000000-0000-0000-0000-000000000001', $1, $2, $3, $4,
            $5, $6, $7::date, $8::timestamptz, $9::timestamptz, $10,
            $11, $12, false, $13, $14, $15,
            $16::timestamptz, $17::timestamptz, $18, now(), now()
          )`,
          [
            branch1.id, r.no, r.customer, r.phone,
            r.guests, r.status, todayStr, r.start, r.end, r.duration,
            r.room, r.channel, r.deposit, r.deposit_paid, r.deposit_method,
            r.confirmed_at || null, r.checked_in_at || null, staffId,
          ]
        );
        insertedRes++;
      }
    }
    console.log(`✓ Reservations: inserted ${insertedRes} new for today (${todayStr})`);
    console.log("✅ Chunk 03 seed complete!");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => { console.error("Seed failed:", e.message); process.exit(1); });
