/**
 * Top-up staff seed: bring each branch up to target headcount.
 * Targets: 3 managers, 25 hostesses, 10 general, 3 drivers, 5 kitchen per branch.
 * Run: pnpm --filter @workspace/api-server exec tsx src/scripts/seed-staff-topup.ts
 */
import { pool } from "@workspace/db";

const BRANCHES = [
  { id: "d44ca290-a086-439d-9657-07fc5ebb689c", code: "KL01" },
  { id: "6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c", code: "KL02" },
  { id: "bb000001-0000-0000-0000-000000000003", code: "KL03" },
  { id: "bb000001-0000-0000-0000-000000000004", code: "KL04" },
  { id: "bb000001-0000-0000-0000-000000000005", code: "KL05" },
  { id: "bb000001-0000-0000-0000-000000000006", code: "KL06" },
  { id: "bb000001-0000-0000-0000-000000000007", code: "KL07" },
  { id: "bb000001-0000-0000-0000-000000000008", code: "KL08" },
  { id: "bb000001-0000-0000-0000-000000000009", code: "KL09" },
  { id: "bb000001-0000-0000-0000-000000000010", code: "KL10" },
];

const TARGET = { manager: 3, hostess: 25, general: 10, driver: 3, kitchen: 5 };

// ─── Extended name pools (different from original seed) ────────────

const MORE_HOSTESS: [string, string][] = [
  // Chinese-Malaysian
  ["Xiao Mei Tang", "Xiaomei"], ["Ling Ling Wu", "Lingling"], ["Yan Er Xiao", "Yaner"],
  ["Shu Qi Pan", "Shuqi"], ["Bing Bing Zhong", "Bingbing"], ["Jing Jing Zhu", "Jingjing"],
  ["Rui Rui Hu", "Ruirui"], ["Dan Dan Wei", "Dandan"], ["Yi Yi Xu", "Yiyi"],
  ["Qi Qi Zhang", "Qiqi"], ["Lan Lan Feng", "Lanlan"], ["Mei Meng Deng", "Meimeng"],
  ["Huan Huan Yu", "Huanhuan"], ["Xue Xue Han", "Xuexue"], ["Jia Jia Meng", "Jiajia"],
  ["Yue Yue Shao", "Yueyue"], ["Ting Ting Cui", "Tingting"], ["Hua Hua Xian", "Huahua"],
  // More Thai
  ["Prae Siriphan", "Prae"], ["Mild Natpagon", "Mild"], ["Fai Jirapha", "Fai"],
  ["Nui Pimchanok", "Nui"], ["Kik Warunee", "Kik"], ["Tam Suphansa", "Tam"],
  ["Pang Chanapa", "Pang"], ["Maprang Apinya", "Maprang"], ["Benz Narirat", "Benz"],
  ["Cake Siranee", "Cake"], ["Game Wipawan", "Game"], ["Film Wichuda", "Film"],
  // More Vietnamese
  ["Ha Phan", "Ha"], ["Yen Vo", "Yen"], ["Dao Thi Hoa", "Dao"],
  ["Thanh Nguyen", "Thanh"], ["Bich Tran", "Bich"], ["Cam Ly Le", "Cam"],
  ["Thuy Dung Pham", "Thuy"], ["Ngoc Anh Bui", "Ngoc"], ["Kim Oanh Ly", "Kim"],
  ["Tra My Hoang", "Tra"], ["Kieu Anh Vu", "Kieu"], ["Phuong Thao Do", "Thao"],
  // More Filipino
  ["Jessa Villanueva", "Jessa"], ["Irene Flores", "Irene"], ["Karen Dela Torre", "Karen"],
  ["Maribel Ocampo", "Maribel"], ["Nora Aguilar", "Nora"], ["Ruby Espinosa", "Ruby"],
  ["Wilma Jimenez", "Wilma"], ["Elena Padilla", "Elena"], ["Leonor Valdez", "Leonor"],
  ["Tessie Aquino", "Tessie"], ["Carmen Peralta", "Carmen"], ["Josie Magpayo", "Josie"],
  // More Malay
  ["Nur Syazwani Azman", "Syazwani"], ["Siti Hajar Mohd", "Hajar"],
  ["Amirah Binti Yusop", "Amirah"], ["Nadia Binti Saad", "Nadia"],
  ["Hidayah Binti Samad", "Hidayah"], ["Suhaila Binti Rahmat", "Suhaila"],
  ["Faizah Binti Zainol", "Faizah"], ["Marsya Binti Kamal", "Marsya"],
  // More Korean / Japanese
  ["Soo Jin Bae", "Soojin"], ["Ji Soo Han", "Jisoo"], ["Yoo Jung Im", "Yoojung"],
  ["Chae Won Song", "Chaewon"], ["Ga Eun Kwak", "Gaeun"], ["Hyun Soo Nam", "Hyunsoo"],
  ["Akari Fujita", "Akari"], ["Yui Shimizu", "Yui"], ["Mei Ogawa", "Mei"],
  ["Haruka Inoue", "Haruka"], ["Rika Kimura", "Rika"], ["Saki Matsuda", "Saki"],
  // Western
  ["Natalie Evans", "Nat"], ["Brooke Harrison", "Brooke"], ["Jasmine Cooper", "Jazz"],
  ["Claire Morgan", "Claire"], ["Tiffany Reed", "Tiff"], ["Vanessa Price", "Vee"],
  ["Sabrina Watson", "Brina"], ["Leila Brooks", "Lei"], ["Naomi Kelly", "Naomi"],
  ["Jade Sanders", "Jade"], ["Crystal Morgan", "Crystal"], ["Amber Foster", "Amber"],
];

const MORE_MANAGER: [string, string][] = [
  ["Charles Tan Boon Hwa", "Charles"], ["Frederick Lim Kok Choy", "Fred"],
  ["Geoffrey Wong Siew Keong", "Geoff"], ["Herbert Lee Ah Kow", "Herb"],
  ["Irwin Ng Chee Keong", "Irwin"], ["Jonathan Ooi Beng Chai", "Jon"],
  ["Leonard Yap Wai Seng", "Leon"], ["Maxwell Goh Chin Weng", "Max"],
  ["Norman Chong Ah Lim", "Norman"], ["Oswald Teh Boon Weng", "Oz"],
  ["Philip Cheah Kah Keong", "Phil"], ["Quentin Ho Kok Leong", "Quentin"],
  ["Ronald Chua Beng Tiong", "Ron"], ["Sebastian Koh Ah Beng", "Seb"],
  ["Theodore Leong Chin Keong", "Theo"], ["Ulysses Chan Kah Wai", "Ulee"],
  ["Valentin Sim Wai Loong", "Val"], ["Wayne Foo Kok Wai", "Wayne"],
  ["Xavier Woo Beng Huat", "Xavier"], ["Yusuf Ang Khee Seng", "Yusuf"],
];

const MORE_DRIVER: [string, string][] = [
  ["Norazmi Bin Yusoff", "Azmi"], ["Farouk Bin Hamzah", "Farouk"],
  ["Zulkarnain Bin Saat", "Zul"], ["Muzaffar Bin Nawi", "Muzaff"],
  ["Shahidan Bin Rusli", "Shahid"], ["Aizuddin Bin Mamat", "Aizud"],
  ["Tarmizi Bin Tahar", "Tarmi"], ["Suffian Bin Samad", "Suffian"],
  ["Firdaus Bin Salam", "Firdaus"], ["Nazri Bin Nazar", "Nazri"],
  ["Harman Singh Gill", "Harman"], ["Balvinder Singh Bassi", "Balvin"],
  ["Gurpreet Singh Brar", "Gurpreet"], ["Sukhdev Singh Dhaliwal", "Sukhdev"],
  ["Raja Mohan Krishnaswamy", "Raja"], ["Siva Kumar Nadarajan", "Siva"],
];

const MORE_KITCHEN: [string, string][] = [
  ["Zahirul Islam Mozumder", "Zahir"], ["Rubel Mia Sarkar", "Rubel"],
  ["Delwar Hossain Sheikh", "Delwar"], ["Faruque Ahmed Bhuiyan", "Faruque"],
  ["Mamun Or Rashid", "Mamun"], ["Sirajul Islam Mullah", "Siraj"],
  ["Nesar Ahmed Chowdhury", "Nesar"], ["Ruhul Amin Laskar", "Ruhul"],
  ["Palani Swamy Velu", "Palani"], ["Marimuthu Arasan", "Mari"],
  ["Thangaraj Pillai", "Thanga"], ["Natarajan Govindan", "Nata"],
  ["Sugumar Rajagopal", "Sugu"], ["Krishnamurthy Naidu", "Krishnam"],
  ["Chandrasekaran Palanisamy", "Chandra"], ["Periasamy Doraiswamy", "Peria"],
  ["Anbalagan Murugesan", "Anbal"], ["Thiyagarajan Sundaram", "Thiyaga"],
  ["Karthikeyan Somasundaram", "Karthi"], ["Sivakumar Ramalingam", "Siva"],
];

const MORE_GENERAL: [string, string][] = [
  ["Ahmad Faris Bin Nordin", "Faris"], ["Mohd Azri Bin Ramlan", "Azri"],
  ["Nur Amirul Bin Rashid", "Amirul"], ["Mohd Ridzuan Bin Anuar", "Ridzuan"],
  ["Zulaikha Binti Hamid", "Zulaika"], ["Hasnita Binti Zainol", "Hasnita"],
  ["Faridah Binti Zakaria", "Faridah"], ["Ramlah Binti Mohamad", "Ramlah"],
  ["Wilson Raj Kumar", "Wilson"], ["Krishnan Mathivanan", "Krish"],
  ["Punitha Selvam", "Punitha"], ["Kavitha Raman", "Kav"],
  ["Hong Kiat Tan", "Hong"], ["Boon Keng Ng", "Boon"],
  ["Geok Eng Lim", "Geok"], ["Ah Kow Wong", "Ah Kow"],
  ["Mei Yoke Koh", "Mei Yoke"], ["Siew Choo Lee", "Siew"],
  ["Peter Joaquin Cruz", "Pete"], ["Maria Elena Santos", "Mara"],
  ["Rodel Bautista Jr", "Rodel"], ["Cecilia Manansala", "Cece"],
];

// ─── Helpers ───────────────────────────────────────────────────────
let femaleIdx = 30; // start from a different offset to avoid photo duplication
let maleIdx   = 50;

function femalePhoto(): string {
  return `https://randomuser.me/api/portraits/women/${(femaleIdx++ % 99)}.jpg`;
}
function malePhoto(): string {
  return `https://randomuser.me/api/portraits/men/${(maleIdx++ % 99)}.jpg`;
}
function phone(): string {
  const prefix = ["011", "012", "013", "014", "016", "017", "018", "019"][Math.floor(Math.random() * 8)]!;
  const num = Math.floor(Math.random() * 90000000 + 10000000);
  return `+60${prefix}-${String(num).slice(0, 4)}-${String(num).slice(4, 8)}`;
}
function hireDate(): string {
  const start = new Date("2023-01-01").getTime();
  const end   = new Date("2026-02-01").getTime();
  return new Date(start + Math.random() * (end - start)).toISOString().split("T")[0]!;
}
function salary(role: string): number {
  switch (role) {
    case "manager":  return 3500 + Math.floor(Math.random() * 1500);
    case "hostess":  return 800  + Math.floor(Math.random() * 400);
    case "driver":   return 2200 + Math.floor(Math.random() * 600);
    case "kitchen":  return 1800 + Math.floor(Math.random() * 700);
    default:         return 1800 + Math.floor(Math.random() * 600);
  }
}

// ─── Main ─────────────────────────────────────────────────────────
async function main() {
  const client = await pool.connect();
  let inserted = 0;
  let skipped  = 0;

  try {
    // Get current counts per branch/role
    const { rows: counts } = await client.query(`
      SELECT branch_id, role, COUNT(*) as cnt
      FROM staff
      WHERE is_active = true AND deleted_at IS NULL
        AND role IN ('manager','hostess','general','driver','kitchen')
      GROUP BY branch_id, role
    `);

    const countMap: Record<string, Record<string, number>> = {};
    for (const row of counts as { branch_id: string; role: string; cnt: string }[]) {
      if (!countMap[row.branch_id]) countMap[row.branch_id] = {};
      countMap[row.branch_id]![row.role] = parseInt(row.cnt);
    }

    // Get max employee code sequence per branch to avoid collisions
    const { rows: maxCodes } = await client.query(`
      SELECT branch_id, MAX(
        CAST(NULLIF(regexp_replace(employee_code, '^[A-Z0-9]+-[A-Z]+-', ''), '') AS INT)
      ) as max_seq
      FROM staff
      WHERE employee_code ~ '^KL[0-9]+-[A-Z]+-[0-9]+'
      GROUP BY branch_id
    `);
    const seqMap: Record<string, number> = {};
    for (const row of maxCodes as { branch_id: string; max_seq: string }[]) {
      seqMap[row.branch_id] = parseInt(row.max_seq ?? "0");
    }

    // Pool iterators (start at high offset to avoid name collisions)
    let mgrI = 0, hstI = 0, genI = 0, drvI = 0, kthI = 0;

    for (const branch of BRANCHES) {
      const cur = countMap[branch.id] ?? {};
      const seq = (n: number) => {
        seqMap[branch.id] = (seqMap[branch.id] ?? 0) + 1;
        return String(seqMap[branch.id]).padStart(3, "0");
      };

      const insert = async (
        namePool: [string, string][],
        poolIdx: number,
        role: string,
        roleAbbr: string,
        isHostess: boolean,
      ) => {
        const [fullName, nick] = namePool[poolIdx % namePool.length]!;
        const code = `${branch.code}-${roleAbbr}-${seq(0)}`;
        const photo = isHostess ? femalePhoto() : malePhoto();
        try {
          const res = await client.query(
            `INSERT INTO staff (
              branch_id, employee_code, full_name, legal_name, phone,
              role, employment_type, hire_date, base_salary, salary_currency,
              profile_photo, nationality, is_active, notes
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'MYR',$10,$11,true,$12)
            ON CONFLICT (employee_code) DO NOTHING
            RETURNING id`,
            [
              branch.id, code, fullName, fullName, phone(),
              role, role === "hostess" ? "part_time" : "full_time",
              hireDate(), salary(role),
              photo, "Malaysian",
              `Nickname: ${nick}`,
            ],
          );
          if (res.rowCount && res.rowCount > 0) inserted++;
          else skipped++;
        } catch (e) {
          console.error(`  [error] ${code} ${fullName}:`, (e as Error).message);
        }
      };

      // Fill up to targets
      const need = (role: string) => Math.max(0, (TARGET as Record<string, number>)[role]! - (cur[role] ?? 0));

      const managerNeed = need("manager");
      const hostessNeed = need("hostess");
      const generalNeed = need("general");
      const driverNeed  = need("driver");
      const kitchenNeed = need("kitchen");

      if (managerNeed > 0 || hostessNeed > 0 || generalNeed > 0 || driverNeed > 0 || kitchenNeed > 0) {
        console.log(`${branch.code}: +${managerNeed}mgr +${hostessNeed}hst +${generalNeed}gen +${driverNeed}drv +${kitchenNeed}kth`);
      }

      for (let i = 0; i < managerNeed; i++) await insert(MORE_MANAGER,  mgrI++, "manager", "MGR", false);
      for (let i = 0; i < hostessNeed; i++) await insert(MORE_HOSTESS,  hstI++, "hostess", "HST", true);
      for (let i = 0; i < generalNeed; i++) await insert(MORE_GENERAL,  genI++, "general", "STF", false);
      for (let i = 0; i < driverNeed;  i++) await insert(MORE_DRIVER,   drvI++, "driver",  "DRV", false);
      for (let i = 0; i < kitchenNeed; i++) await insert(MORE_KITCHEN,  kthI++, "kitchen", "KTH", false);
    }

    console.log(`\n✅ Inserted: ${inserted}, Skipped: ${skipped}`);

    // Final summary
    const { rows: summary } = await client.query(`
      SELECT b.internal_code,
        SUM(CASE WHEN s.role='manager' THEN 1 ELSE 0 END) AS managers,
        SUM(CASE WHEN s.role='hostess' THEN 1 ELSE 0 END) AS hostesses,
        SUM(CASE WHEN s.role='general' THEN 1 ELSE 0 END) AS general,
        SUM(CASE WHEN s.role='driver'  THEN 1 ELSE 0 END) AS drivers,
        SUM(CASE WHEN s.role='kitchen' THEN 1 ELSE 0 END) AS kitchen,
        COUNT(*) AS total
      FROM staff s
      JOIN branches b ON b.id = s.branch_id
      WHERE s.is_active=true AND s.deleted_at IS NULL
        AND s.role IN ('manager','hostess','general','driver','kitchen')
      GROUP BY b.internal_code ORDER BY b.internal_code
    `);

    console.log("\nFinal per-branch counts:");
    console.log("Branch  Mgr  Hst  Gen  Drv  Kth  Total");
    for (const r of summary as Record<string, string>[]) {
      console.log(
        `${r.internal_code}   ${r.managers.padStart(3)}  ${r.hostesses.padStart(3)}  ${r.general.padStart(3)}  ${r.drivers.padStart(3)}  ${r.kitchen.padStart(3)}  ${r.total}`
      );
    }

    const { rows: totalRows } = await client.query(`SELECT COUNT(*) as cnt FROM staff WHERE is_active=true AND deleted_at IS NULL`);
    console.log(`\nTotal active staff in DB: ${(totalRows[0] as { cnt: string }).cnt}`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
