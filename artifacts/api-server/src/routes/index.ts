import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import branchesRouter from "./branches";
import roomsRouter from "./rooms";
import productsRouter from "./products";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(branchesRouter);
router.use(roomsRouter);
router.use(productsRouter);

export default router;
