import { Router, type IRouter } from "express";
import healthRouter from "./health";
import followsRouter from "./follows";
import notificationsRouter from "./notifications";
import activityRouter from "./activity";
import profilesRouter from "./profiles";
import preferencesRouter from "./preferences";
import pushRouter from "./push";
import logsRouter from "./logs";
import adminRouter from "./admin";
import pollerRouter from "./poller";

const router: IRouter = Router();

router.use(healthRouter);
router.use(followsRouter);
router.use(notificationsRouter);
router.use(activityRouter);
router.use(profilesRouter);
router.use(preferencesRouter);
router.use(pushRouter);
router.use(logsRouter);
router.use(adminRouter);
router.use(pollerRouter);

export default router;

