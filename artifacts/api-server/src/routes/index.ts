import { Router, type IRouter } from "express";
import healthRouter from "./health";
import followsRouter from "./follows";
import notificationsRouter from "./notifications";
import activityRouter from "./activity";
import profilesRouter from "./profiles";
import preferencesRouter from "./preferences";
import pushRouter from "./push";

const router: IRouter = Router();

router.use(healthRouter);
router.use(followsRouter);
router.use(notificationsRouter);
router.use(activityRouter);
router.use(profilesRouter);
router.use(preferencesRouter);
router.use(pushRouter);

export default router;

