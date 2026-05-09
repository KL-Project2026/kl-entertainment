import { Router, type IRouter } from "express";
import { authenticate } from "../middleware/auth";
import { blockInvestor } from "../middleware/rbac";
import healthRouter from "./health";
import authRouter from "./auth";
import branchesRouter from "./branches";
import roomsRouter from "./rooms";
import productsRouter from "./products";
import reservationsRouter from "./reservations";
import ordersRouter from "./orders";
import receiptsRouter from "./receipts";
import staffAvailabilityRouter from "./staff-availability";
import staffRouter from "./staff";
import schedulesRouter from "./schedules";
import agentsRouter from "./agents";
import shareholdersRouter from "./shareholders";
import investorRouter from "./investor";
import reportsRouter from "./reports";
import currencyRouter from "./currency";
import customerAuthRouter from "./customer-auth";
import customerBookingsRouter from "./customer-bookings";
import webhooksRouter from "./webhooks";
import attendanceApiRouter from "./attendance-api";
import availabilityRouter from "./availability";
import folioRouter from "./folio";
import paymentsApiRouter from "./payments-api";
import tablesApiRouter from "./tables-api";
import managerRouter from "./manager";
import hostessPortalRouter from "./hostess-portal";
import driverRouter from "./driver";
import hostessProfilesRouter from "./hostess-profiles";
import agencyMgmtRouter from "./agency-mgmt";
import roomTablesRouter from "./room-tables";
import settingsMenuConfigRouter from "./settings-menu-config";
import menuRouter from "./menu";
import hostessAssignmentsRouter from "./hostessAssignments";
import agencyReconciliationRouter from "./agencyReconciliation";
import ledgerRouter from "./ledger";
import adminUsersRouter from "./admin/users";
import dashboardsRouter from "./dashboards";
import profileRouter from "./profile";

const router: IRouter = Router();

// ── Phase 9: investor RBAC hotfix ────────────────────────────────────────────
// Express router.use(path) uses prefix matching, so "/branches" covers
// "/branches", "/branches/:id", "/branches/:id/rooms", etc.
// Must be registered BEFORE the individual sub-routers.
// investor role is only allowed: /investor/*, /profile/*, /auth/*, /currency/*
//
// SOURCE OF TRUTH: docs/OPERATIONS_WORKFLOW.md §15 + lib/shared/route-permissions.ts
// The list below maps API mount paths (Express); the shared map is by frontend
// page paths. When adding/removing operational mounts, update both.
const INVESTOR_BLOCKED_PREFIXES = [
  "/staff",
  "/branches",
  "/rooms",
  "/agents",
  "/products",
  "/tables",
  "/reservations",
  "/orders",
  "/receipts",
  "/schedules",
  "/shareholders",
  "/reports",
  "/attendance",
  "/availability",
  "/folio",
  "/payments",
  "/manager",
  "/hostess-portal",
  "/driver",
  "/hostess-profiles",
  "/agency-mgmt",
  "/room-tables",
  "/settings-menu-config",
  "/menu",
  "/hostess-assignments",
  "/agency-reconciliation",
  "/ledger",
  "/admin",
  "/dashboards",
];
router.use(INVESTOR_BLOCKED_PREFIXES, authenticate, blockInvestor);
// ─────────────────────────────────────────────────────────────────────────────

router.use(healthRouter);
router.use(authRouter);
router.use(branchesRouter);
router.use(roomsRouter);
router.use(productsRouter);
router.use(reservationsRouter);
router.use(ordersRouter);
router.use(receiptsRouter);
router.use(staffAvailabilityRouter);
router.use(staffRouter);
router.use(schedulesRouter);
router.use(agentsRouter);
router.use(shareholdersRouter);
router.use(investorRouter);
router.use(reportsRouter);
router.use(currencyRouter);
router.use(customerAuthRouter);
router.use(customerBookingsRouter);
router.use(webhooksRouter);
router.use(attendanceApiRouter);
router.use(availabilityRouter);
router.use(folioRouter);
router.use(paymentsApiRouter);
router.use(tablesApiRouter);
router.use(managerRouter);
router.use(hostessPortalRouter);
router.use(driverRouter);
router.use(hostessProfilesRouter);
router.use(agencyMgmtRouter);
router.use(roomTablesRouter);
router.use(settingsMenuConfigRouter);
router.use(menuRouter);
router.use(hostessAssignmentsRouter);
router.use(agencyReconciliationRouter);
router.use(ledgerRouter);
router.use(adminUsersRouter);
router.use(dashboardsRouter);
router.use(profileRouter);

export default router;
