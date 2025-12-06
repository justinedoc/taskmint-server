import { authenticator, totp } from "otplib";
import { CRYPTO } from "@/index.js";

totp.options = { step: 300 };

class OTPService {
  public generateUserSecret() {
    return authenticator.generateSecret();
  }

  public async generateOtp(secret: string | undefined) {
    if (!secret) throw new Error("Otp secret is required");
    const decryptedSecret = await CRYPTO.decrypt(secret);
    return totp.generate(decryptedSecret);
  }

  public async verifyOtp(otp: number, secret: string | undefined) {
    if (!secret) throw new Error("Otp secret is required");

    const decryptedSecret = await CRYPTO.decrypt(secret);
    return totp.check(otp.toString(), decryptedSecret);
  }
}

const otpService = new OTPService();

export default otpService;
