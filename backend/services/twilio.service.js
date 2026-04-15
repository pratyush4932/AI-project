import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const isDevelopment = process.env.NODE_ENV === "development";

export const sendOTPService = async (phone) => {
  if (isDevelopment) {
    // Mock OTP in development - use "000000" for all testing
    console.log(`[MOCK OTP] Phone: ${phone}, OTP: 000000`);
    return {
      sid: "VA_mock_" + Date.now(),
      status: "pending",
      to: phone,
    };
  }

  return await client.verify.v2
    .services(process.env.TWILIO_SERVICE_SID)
    .verifications.create({
      to: phone,
      channel: "sms"
    });
};

export const verifyOTPService = async (phone, otp) => {
  if (isDevelopment) {
    // In development, accept any OTP (or specific ones for testing)
    if (otp === "000000" || otp === "123456") {
      console.log(`[MOCK VERIFICATION] Phone: ${phone}, OTP: ${otp}, Status: approved`);
      return {
        sid: "VE_mock_" + Date.now(),
        status: "approved",
        to: phone,
      };
    } else {
      console.log(`[MOCK VERIFICATION] Phone: ${phone}, OTP: ${otp}, Status: pending`);
      return {
        sid: "VE_mock_" + Date.now(),
        status: "pending",
        to: phone,
      };
    }
  }

  return await client.verify.v2
    .services(process.env.TWILIO_SERVICE_SID)
    .verificationChecks.create({
      to: phone,
      code: otp
    });
};