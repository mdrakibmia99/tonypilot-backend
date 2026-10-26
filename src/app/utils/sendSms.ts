export interface ISmsPayload {
  phoneNumber?: string;
  message: string;
}

const sendSms = async (_payload: ISmsPayload): Promise<void> => {
  // SMS provider integration placeholder
};

export default sendSms;