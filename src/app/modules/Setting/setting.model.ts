import { Schema, model } from "mongoose";
import { ISetting } from "./setting.interface";

const settingSchema = new Schema<ISetting>(
  {
    phone: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      default: "",
    },
    location: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

const Setting = model<ISetting>("Setting", settingSchema);
export default Setting;
