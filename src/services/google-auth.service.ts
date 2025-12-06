import { OAuth2Client } from "google-auth-library";
import env from "@/lib/env-validator.js";

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export interface GoogleUserProfile {
  id: string;
  email: string;
  name: string;
  picture: string;
}

class GoogleAuthService {
  public async verifyIdToken(idToken: string): Promise<GoogleUserProfile> {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.sub || !payload.email) {
      throw new Error("Invalid Google ID token payload.");
    }

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name || payload.email,
      picture: payload.picture || "",
    };
  }

  public async exchangeCodeForProfile(
    code: string,
  ): Promise<GoogleUserProfile> {
    const { tokens } = await client.getToken(code);

    const idToken = tokens.id_token;
    if (!idToken) {
      throw new Error("Failed to retrieve ID Token from Google.");
    }

    return this.verifyIdToken(idToken);
  }
}

const googleAuthService = new GoogleAuthService();
export default googleAuthService;
