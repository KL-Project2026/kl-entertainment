import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import branchesRouter from "./branches";
import roomsRouter from "./rooms";
import productsRouter from "./products";
import reservationsRouter from "./reservations";
import ordersRouter from "./orders";
import receiptsRouter from "./receipts";
import staffAvailabilityRouter from "./staff-availability";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(branchesRouter);
router.use(roomsRouter);
router.use(productsRouter);
router.use(reservationsRouter);
router.use(ordersRouter);
router.use(receiptsRouter);
router.use(staffAvailabilityRouter);

export default router;
