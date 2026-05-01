import { Router, type IRouter } from "express";
import healthRouter from "./health";
import followsRouter from "./follows";
import notificationsRouter from "./notifications";
import activityRouter from "./activity";
import profilesRouter from "./profiles";

const router: IRouter = Router();

router.use(healthRouter);
router.use(followsRouter);
router.use(notificationsRouter);
router.use(activityRouter);
router.use(profilesRouter);

export default router;
