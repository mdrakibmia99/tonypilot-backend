import config from "../config";
import { transporter } from "../config/transporter";


export const sendEmail = async (
  to: string,
  subject: string,
  html: string
) => {

  console.log("Sending email...");

  await transporter.sendMail({
    from: config.smtp.nodemailer_host_email,
    to,
    subject,
    html,
  });

  console.log("Email sent");
};