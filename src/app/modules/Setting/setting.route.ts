import { Router } from "express";
import auth from "../../middleware/auth";
import { USER_ROLE } from "../user/user.constants";
import SettingController from "./setting.controller";
import validateRequest from "../../middleware/validateRequest";
import { settingValidation } from "./setting.validation";

const router = Router();

router.patch(
    "/update-help-center",
    validateRequest(settingValidation.updateSettingValidationSchema),
    auth(USER_ROLE.ADMIN,USER_ROLE.SUPER_ADMIN),
    SettingController.updateSetting
);

router.get(
    "/help-center",
    SettingController.getSetting
);

export const SettingRoutes = router;
