/**
 * Seed 1-month schedules for ALL active staff across ALL branches.
 * Role-based KTV shift patterns:
 *   hostess        → 6 days/week (off Wed), 20:00–03:00 overnight
 *   branch_manager → 5 days/week (off Sun+Mon), 18:00–02:00 overnight
 *   manager        → 5 days/week (off Sun+Mon), 18:00–02:00 overnight
 *   kitchen        → 6 days/week (off Wed), 15:00–23:00
 *   driver         → 6 days/week (off Mon), split AM/PM by index
 *   hall           → 6 days/week (off Mon), 17:00–02:00 overnight
 *   general        → 5 days/week (Mon–Fri), 09:00–18:00
 *   admin / super_admin / investor → skip
 */

import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
const EFFECTIVE_FROM = "2026-03-20";
const EFFECTIVE_TO   = "2026-04-20";

interface ShiftDay {
  dow: number;
  start: string;
  end: string;
  overnight: boolean;
}

function hosessShifts(): ShiftDay[] {
  // 6 days: Sun Mon Tue Thu Fri Sat — off Wed(3)
  return [
    { dow: 0, start: "21:00", end: "04:00", overnight: true  }, // Sun
    { dow: 1, start: "20:00", end: "03:00", overnight: true  }, // Mon
    { dow: 2, start: "20:00", end: "03:00", overnight: true  }, // Tue
    { dow: 4, start: "20:00", end: "03:00", overnight: true  }, // Thu
    { dow: 5, start: "21:00", end: "04:00", overnight: true  }, // Fri
    { dow: 6, start: "21:00", end: "04:00", overnight: true  }, // Sat
  ];
}

function managerShifts(): ShiftDay[] {
  // 5 days: Tue-Sat — off Sun(0) Mon(1)
  return [
    { dow: 2, start: "18:00", end: "02:00", overnight: true },
    { dow: 3, start: "18:00", end: "02:00", overnight: true },
    { dow: 4, start: "18:00", end: "02:00", overnight: true },
    { dow: 5, start: "18:00", end: "02:00", overnight: true },
    { dow: 6, start: "18:00", end: "02:00", overnight: true },
  ];
}

function kitchenShifts(): ShiftDay[] {
  // 6 days: Sun Mon Tue Thu Fri Sat — off Wed(3)
  return [
    { dow: 0, start: "15:00", end: "23:00", overnight: false },
    { dow: 1, start: "15:00", end: "23:00", overnight: false },
    { dow: 2, start: "15:00", end: "23:00", overnight: false },
    { dow: 4, start: "15:00", end: "23:00", overnight: false },
    { dow: 5, start: "16:00", end: "00:00", overnight: true  },
    { dow: 6, start: "16:00", end: "00:00", overnight: true  },
  ];
}

function driverShiftsAM(): ShiftDay[] {
  // AM drivers: 6 days (off Mon), 10:00-19:00
  return [
    { dow: 0, start: "10:00", end: "19:00", overnight: false },
    { dow: 2, start: "10:00", end: "19:00", overnight: false },
    { dow: 3, start: "10:00", end: "19:00", overnight: false },
    { dow: 4, start: "10:00", end: "19:00", overnight: false },
    { dow: 5, start: "10:00", end: "19:00", overnight: false },
    { dow: 6, start: "10:00", end: "19:00", overnight: false },
  ];
}

function driverShiftsPM(): ShiftDay[] {
  // PM drivers: 6 days (off Mon), 19:00-03:00 overnight
  return [
    { dow: 0, start: "19:00", end: "03:00", overnight: true },
    { dow: 2, start: "19:00", end: "03:00", overnight: true },
    { dow: 3, start: "19:00", end: "03:00", overnight: true },
    { dow: 4, start: "19:00", end: "03:00", overnight: true },
    { dow: 5, start: "19:00", end: "03:00", overnight: true },
    { dow: 6, start: "19:00", end: "03:00", overnight: true },
  ];
}

function hallShifts(): ShiftDay[] {
  // 6 days (off Mon), 17:00-02:00 overnight
  return [
    { dow: 0, start: "17:00", end: "02:00", overnight: true },
    { dow: 2, start: "17:00", end: "02:00", overnight: true },
    { dow: 3, start: "17:00", end: "02:00", overnight: true },
    { dow: 4, start: "17:00", end: "02:00", overnight: true },
    { dow: 5, start: "17:00", end: "02:00", overnight: true },
    { dow: 6, start: "17:00", end: "02:00", overnight: true },
  ];
}

function generalShifts(): ShiftDay[] {
  // Mon-Fri, 09:00-18:00
  return [
    { dow: 1, start: "09:00", end: "18:00", overnight: false },
    { dow: 2, start: "09:00", end: "18:00", overnight: false },
    { dow: 3, start: "09:00", end: "18:00", overnight: false },
    { dow: 4, start: "09:00", end: "18:00", overnight: false },
    { dow: 5, start: "09:00", end: "18:00", overnight: false },
  ];
}

function getShifts(role: string, idx: number): ShiftDay[] {
  switch (role) {
    case "hostess":        return hosessShifts();
    case "branch_manager": return managerShifts();
    case "manager":        return managerShifts();
    case "kitchen":        return kitchenShifts();
    case "driver":         return idx % 2 === 0 ? driverShiftsAM() : driverShiftsPM();
    case "hall":           return hallShifts();
    case "general":        return generalShifts();
    default:               return []; // admin, super_admin, investor → skip
  }
}

async function main() {
  const client = await pool.connect();
  try {
    const { rows: staffRows } = await client.query(`
      SELECT id, branch_id, role, full_name
      FROM staff
      WHERE is_active = true AND deleted_at IS NULL
        AND role NOT IN ('admin','super_admin','investor')
      ORDER BY branch_id, role, full_name
    `);

    console.log(`Found ${staffRows.length} active staff to schedule`);

    // Clear existing schedules in this date range to avoid conflicts
    await client.query(`
      DELETE FROM staff_schedules
      WHERE effective_from >= $1 AND effective_from <= $2
    `, [EFFECTIVE_FROM, EFFECTIVE_TO]);
    console.log("Cleared existing schedules for this period");

    let inserted = 0;
    const roleIdx: Record<string, number> = {};

    for (const staff of staffRows as { id: string; branch_id: string; role: string; full_name: string }[]) {
      const role = staff.role;
      roleIdx[role] = (roleIdx[role] ?? 0);
      const idx = roleIdx[role]++;

      const shifts = getShifts(role, idx);
      for (const shift of shifts) {
        await client.query(`
          INSERT INTO staff_schedules
            (staff_id, branch_id, day_of_week, shift_start, shift_end, is_overnight, effective_from, effective_to)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT DO NOTHING
        `, [
          staff.id,
          staff.branch_id,
          shift.dow,
          shift.start,
          shift.end,
          shift.overnight,
          EFFECTIVE_FROM,
          EFFECTIVE_TO,
        ]);
        inserted++;
      }
    }

    console.log(`✅ Inserted ${inserted} schedule entries for ${staffRows.length} staff`);
    console.log(`   Period: ${EFFECTIVE_FROM} → ${EFFECTIVE_TO}`);

    // Summary by role
    const { rows: summary } = await client.query(`
      SELECT s.role, COUNT(DISTINCT ss.staff_id) as staff_count, COUNT(ss.id) as shift_count
      FROM staff_schedules ss
      JOIN staff s ON s.id = ss.staff_id
      WHERE ss.effective_from = $1
      GROUP BY s.role ORDER BY s.role
    `, [EFFECTIVE_FROM]);
    console.log("\nSchedule summary:");
    for (const row of summary as { role: string; staff_count: string; shift_count: string }[]) {
      console.log(`  ${row.role.padEnd(16)} ${row.staff_count.toString().padStart(3)} staff, ${row.shift_count.toString().padStart(4)} shifts`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
