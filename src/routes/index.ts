import { Router } from "express";
import type { Router as ExpressRouter } from "express";

import healthRoutes from "./health.routes.ts";
import authRoutes from "./auth.routes.ts";
import aiRouter from "./ai.routes.ts";
import paymentRouter from "./payment.routes.ts";

const v1Routes: ExpressRouter = Router();
v1Routes.use("/auth", authRoutes);
v1Routes.use("/health", healthRoutes);
v1Routes.use("/ai", aiRouter);
v1Routes.use("/payment", paymentRouter);

export default v1Routes;
