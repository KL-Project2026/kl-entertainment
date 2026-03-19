import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { ROLES } from "../config/constants";
import { getStaffEarningsSummary } from "../services/commission-service";

const router: IRouter = Router();

function formatStaff(row: Record<string, unknown>) {
  return {
    id: row.id,
    branchId: row.branch_id,
    employeeCode: row.employee_code ?? null,
    fullName: row.full_name,
    legalName: row.legal_name ?? null,
    nationality: row.nationality ?? null,
    phone: row.phone ?? null,
    whatsapp: row.whatsapp ?? null,
    email: row.email ?? null,
    role: row.role,
    employmentType: row.employment_type,
    hireDate: row.hire_date ?? null,
    contractStart: row.contract_start ?? null,
    contractEnd: row.contract_end ?? null,
    baseSalary: row.base_salary ? parseFloat(row.base_salary as string) : null,
    salaryCurrency: row.salary_currency ?? "MYR",
    commissionConfig: row.commission_config ?? null,
    incentiveConfig: row.incentive_config ?? null,
    penaltyApplies: row.penalty_applies ?? false,
    agentId: row.agent_id ?? null,
    agentName: row.agent_name ?? null,
    profilePhoto: row.profile_photo ?? null,
    bankName: row.bank_name ?? null,
    bankAccount: row.bank_account ?? null,
    preferredCurrency: row.preferred_currency ?? "MYR",
    notes: row.notes ?? null,
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
  };
}

// List staff
router.get(
  "/staff",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { branch_id, role, employment_type, active } = req.query as Record<string, string>;
      const conditions: string[] = ["s.deleted_at IS NULL"];
      const params: unknown[] = [];
      let p = 1;

      if (branch_id) { conditions.push(`s.branch_id = $${p++}`); params.push(branch_id); }
      if (role) { conditions.push(`s.role = $${p++}`); params.push(role); }
      if (employment_type) { conditions.push(`s.employment_type = $${p++}`); params.push(employment_type); }
      if (active !== undefined) { conditions.push(`s.is_active = $${p++}`); params.push(active === "true"); }

      const { rows } = await pool.query(
        `SELECT s.*, a.name AS agent_name
         FROM staff s
         LEFT JOIN agents a ON a.id = s.agent_id
         WHERE ${conditions.join(" AND ")}
         ORDER BY s.full_name`,
        params
      );

      res.json({ data: (rows as Record<string, unknown>[]).map(formatStaff) });
    } catch (err) {
      console.error("List staff error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Create staff
router.post(
  "/staff",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (!body.fullName || !body.role || !body.branchId) {
        res.status(400).json({ error: "REQUIRED_FIELDS_MISSING" });
        return;
      }

      // Auto-generate employee code
      const { rows: codeRows } = await pool.query(
        "SELECT COUNT(*) FROM staff WHERE branch_id = $1",
        [body.branchId]
      );
      const count = parseInt((codeRows[0] as Record<string, string>).count) + 1;
      const { rows: branchRows } = await pool.query("SELECT internal_code FROM branches WHERE id = $1", [body.branchId]);
      const code = branchRows.length
        ? `${(branchRows[0] as Record<string, string>).internal_code}-S${String(count).padStart(3, "0")}`
        : `S${String(count).padStart(5, "0")}`;

      const { rows } = await pool.query(
        `INSERT INTO staff (branch_id, employee_code, full_name, legal_name, nationality,
           phone, whatsapp, email, role, employment_type, hire_date, contract_start, contract_end,
           base_salary, salary_currency, commission_config, incentive_config, penalty_applies,
           agent_id, profile_photo, bank_name, bank_account, preferred_currency, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
         RETURNING *`,
        [
          body.branchId, code, body.fullName, body.legalName ?? null, body.nationality ?? null,
          body.phone ?? null, body.whatsapp ?? null, body.email ?? null,
          body.role, body.employmentType ?? "full_time",
          body.hireDate ?? null, body.contractStart ?? null, body.contractEnd ?? null,
          body.baseSalary ?? null, body.salaryCurrency ?? "MYR",
          body.commissionConfig ? JSON.stringify(body.commissionConfig) : null,
          body.incentiveConfig ? JSON.stringify(body.incentiveConfig) : null,
          body.penaltyApplies ?? false,
          body.agentId ?? null, body.profilePhoto ?? null,
          body.bankName ?? null, body.bankAccount ?? null,
          body.preferredCurrency ?? "MYR", body.notes ?? null,
        ]
      );

      res.status(201).json({ data: formatStaff(rows[0] as Record<string, unknown>) });
    } catch (err) {
      console.error("Create staff error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Get single staff
router.get(
  "/staff/:id",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT s.*, a.name AS agent_name FROM staff s LEFT JOIN agents a ON a.id = s.agent_id WHERE s.id = $1 AND s.deleted_at IS NULL`,
        [req.params.id]
      );
      if (!rows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      res.json({ data: formatStaff(rows[0] as Record<string, unknown>) });
    } catch (err) {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Update staff
router.put(
  "/staff/:id",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const { rows } = await pool.query(
        `UPDATE staff SET
           full_name = COALESCE($1, full_name),
           legal_name = COALESCE($2, legal_name),
           nationality = COALESCE($3, nationality),
           phone = COALESCE($4, phone),
           whatsapp = COALESCE($5, whatsapp),
           email = COALESCE($6, email),
           role = COALESCE($7, role),
           employment_type = COALESCE($8, employment_type),
           hire_date = COALESCE($9, hire_date),
           base_salary = COALESCE($10, base_salary),
           salary_currency = COALESCE($11, salary_currency),
           commission_config = COALESCE($12, commission_config),
           penalty_applies = COALESCE($13, penalty_applies),
           agent_id = COALESCE($14, agent_id),
           notes = COALESCE($15, notes),
           preferred_currency = COALESCE($16, preferred_currency)
         WHERE id = $17 AND deleted_at IS NULL RETURNING *`,
        [
          body.fullName ?? null, body.legalName ?? null, body.nationality ?? null,
          body.phone ?? null, body.whatsapp ?? null, body.email ?? null,
          body.role ?? null, body.employmentType ?? null, body.hireDate ?? null,
          body.baseSalary ?? null, body.salaryCurrency ?? null,
          body.commissionConfig ? JSON.stringify(body.commissionConfig) : null,
          body.penaltyApplies ?? null, body.agentId ?? null, body.notes ?? null,
          body.preferredCurrency ?? null,
          req.params.id,
        ]
      );
      if (!rows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      res.json({ data: formatStaff(rows[0] as Record<string, unknown>) });
    } catch (err) {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Deactivate staff
router.put(
  "/staff/:id/deactivate",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        "UPDATE staff SET is_active = false, deleted_at = NOW() WHERE id = $1 RETURNING id",
        [req.params.id]
      );
      if (!rows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Get staff earnings summary
router.get(
  "/staff/:id/earnings",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { from, to } = req.query as Record<string, string>;
      const today = new Date().toISOString().split("T")[0];
      const fromDate = from ?? new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const toDate = to ?? today;

      const summary = await getStaffEarningsSummary(req.params.id, fromDate, toDate);
      res.json({ data: summary });
    } catch (err) {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Clock in
router.post(
  "/staff/:id/clock-in",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const staffId = req.params.id;
      const today = new Date().toISOString().split("T")[0];
      const now = new Date();
      const dayOfWeek = now.getDay();

      // Get staff record to find branch
      const { rows: staffRows } = await pool.query(
        "SELECT id, branch_id, penalty_applies FROM staff WHERE id = $1 AND deleted_at IS NULL",
        [staffId]
      );
      if (!staffRows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      const staffRow = staffRows[0] as Record<string, unknown>;
      const branchId = (body.branchId as string) || staffRow.branch_id as string;

      // Get scheduled shift for today
      const { rows: schedRows } = await pool.query(
        `SELECT * FROM staff_schedules
         WHERE staff_id = $1 AND day_of_week = $2
           AND effective_from <= $3 AND (effective_to IS NULL OR effective_to >= $3)
         LIMIT 1`,
        [staffId, dayOfWeek, today]
      );
      const schedule = schedRows[0] as Record<string, unknown> | undefined;

      let lateMinutes = 0;
      let penaltyAmount = 0;
      let status = "present";

      if (schedule) {
        const scheduledStart = new Date(`${today}T${schedule.shift_start}`);
        const diffMs = now.getTime() - scheduledStart.getTime();
        lateMinutes = Math.max(0, Math.floor(diffMs / 60000));

        if (lateMinutes > 10) {
          status = "late";
          if (staffRow.penalty_applies && lateMinutes > 30) {
            penaltyAmount = 50.0;
          }
        }
      }

      await pool.query(
        `INSERT INTO attendance (staff_id, branch_id, work_date, scheduled_start, scheduled_end,
                                  clock_in, status, late_minutes, penalty_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (staff_id, work_date) DO UPDATE
           SET clock_in = $6, status = $7, late_minutes = $8, penalty_amount = $9`,
        [
          staffId, branchId, today,
          schedule ? `${today}T${schedule.shift_start}` : null,
          schedule ? `${today}T${schedule.shift_end}` : null,
          now, status, lateMinutes, penaltyAmount,
        ]
      );

      res.json({ data: { clockedInAt: now, status, lateMinutes, penaltyAmount } });
    } catch (err) {
      console.error("Clock in error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Clock out
router.post(
  "/staff/:id/clock-out",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const { rows } = await pool.query(
        `UPDATE attendance SET clock_out = NOW()
         WHERE staff_id = $1 AND work_date = $2
         RETURNING clock_out`,
        [req.params.id, today]
      );
      if (!rows.length) { res.status(404).json({ error: "NO_CLOCK_IN_FOUND" }); return; }
      res.json({ data: { clockedOutAt: (rows[0] as Record<string, unknown>).clock_out } });
    } catch (err) {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Get attendance log for a staff member
router.get(
  "/staff/:id/attendance",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { from, to } = req.query as Record<string, string>;
      const today = new Date().toISOString().split("T")[0];
      const fromDate = from ?? new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const toDate = to ?? today;

      const { rows } = await pool.query(
        `SELECT * FROM attendance
         WHERE staff_id = $1 AND work_date BETWEEN $2 AND $3
         ORDER BY work_date DESC`,
        [req.params.id, fromDate, toDate]
      );

      res.json({
        data: (rows as Record<string, unknown>[]).map((r) => ({
          id: r.id,
          staffId: r.staff_id,
          branchId: r.branch_id,
          workDate: r.work_date,
          scheduledStart: r.scheduled_start ?? null,
          scheduledEnd: r.scheduled_end ?? null,
          clockIn: r.clock_in ?? null,
          clockOut: r.clock_out ?? null,
          status: r.status,
          lateMinutes: parseInt(r.late_minutes as string) || 0,
          penaltyAmount: parseFloat(r.penalty_amount as string) || 0,
          penaltyReason: r.penalty_reason ?? null,
          notes: r.notes ?? null,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

export default router;
