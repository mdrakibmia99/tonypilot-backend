import twilio from 'twilio';
import httpStatus from 'http-status';
import config from '../config';
import AppError from '../error/AppError';

// Twilio credentials
const accountSid = config?.twilio?.account_sid;
const authToken = config?.twilio?.auth_token;
const twilioPhone = config?.twilio?.phone_number;
// Create a Twilio client
const TwilioClient = twilio(accountSid, authToken);

const NumberVerifyOtp = async (phoneNumber: string,otp:string) => {
    if (!phoneNumber) {
        throw new AppError(httpStatus.BAD_REQUEST, 'phone number is required');
    }



    try {
        // // Send the SMS
       const message = await TwilioClient.messages.create({
            body: `Your OTP is: ${otp}`,
            from: twilioPhone,
            to: phoneNumber,
        });
        if(!message){
            throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to send OTP');
        }
        return otp;
        // res.status(200).json({ message: "OTP sent successfully", otp }); // For dev, include OTP (remove in prod)
    } catch (error: any) {
        throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, `Failed to send OTP: ${error.message}`);
    }
};

export { NumberVerifyOtp };