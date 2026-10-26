import nodemailer from "nodemailer";
import config from "../config";

const isProduction = process.env.NODE_ENV === "production";

export const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: isProduction ? 465 : 587,
  secure: isProduction,
  auth: {
    user: config.smtp.nodemailer_host_email,
    pass: config.smtp.nodemailer_host_pass,
  },
  tls: {
    rejectUnauthorized: false,
  },
});