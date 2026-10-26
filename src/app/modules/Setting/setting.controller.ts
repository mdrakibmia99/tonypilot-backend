import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import httpStatus from "http-status";
import { settingService } from "./setting.service";

const updateSetting = catchAsync(async (req: Request, res: Response) => {
  const result = await settingService.updateSetting(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Setting updated successfully",
    data: result,
  });
});

const getSetting = catchAsync(async (req: Request, res: Response) => {
  const result = await settingService.getSetting();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Setting fetched successfully",
    data: result,
  });
});

export default {
  updateSetting,
  getSetting,
};
