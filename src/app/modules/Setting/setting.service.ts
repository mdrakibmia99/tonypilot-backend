import httpStatus from "http-status";
import AppError from "../../error/AppError";
import Setting from "./setting.model";
import { ISetting } from "./setting.interface";

const updateSetting = async (payload: Partial<ISetting>) => {
  const setting = await Setting.findOneAndUpdate(
    {},
    { $set: payload },
    { new: true, runValidators: true, upsert: true }
  );

  return setting;
};

const getSetting = async () => {
  const setting = await Setting.findOne();

  if (!setting) {
    const defaultSetting = await Setting.create({
      phone: "N/A",
      email: "N/A",
      location: "N/A",
    });
    return defaultSetting;
  }

  return setting;
};

export const settingService = {
  updateSetting,
  getSetting,
};
