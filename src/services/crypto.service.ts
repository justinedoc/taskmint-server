import { webcrypto as crypto } from "node:crypto";
import env from "@/lib/env-validator.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

class CryptoService {
  key: crypto.CryptoKey;

  constructor(key: crypto.CryptoKey) {
    this.key = key;
  }

  /**
   * Creates and initializes a CryptoService instance.
   * @param secretKeyHex A 64-character hex string representing the 256-bit encryption key.
   */

  public static async create(secretKeyHex: string): Promise<CryptoService> {
    if (!secretKeyHex || secretKeyHex.length !== 64) {
      throw new Error(
        "Invalid ENCRYPTION_KEY: Must be a 64-character hex string (32 bytes).",
      );
    }

    const keyBuffer = Buffer.from(secretKeyHex, "hex");

    // Import the raw key material into a CryptoKey object that the Web Crypto API can use.
    const key = await crypto.subtle.importKey(
      "raw", // The format of the key material
      keyBuffer,
      { name: "AES-GCM" }, // The algorithm this key will be used for
      false, // Whether the key can be extracted from the CryptoKey object (false is more secure)
      ["encrypt", "decrypt"], // The operations this key is allowed to perform
    );

    return new CryptoService(key);
  }

  /**
   * Encrypts a string and returns a single, easy-to-store string.
   * @param text The plaintext string to encrypt.
   * @returns A base64-encoded string in the format "iv:encryptedData".
   */
  public async encrypt(text: string | undefined): Promise<string> {
    if (!text) throw new Error("Text to be encrypted can't be empty");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const dataToEncrypt = encoder.encode(text);

    const encryptedDataBuffer = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      this.key,
      dataToEncrypt,
    );

    const ivB64 = Buffer.from(iv).toString("base64");
    const encryptedB64 = Buffer.from(encryptedDataBuffer).toString("base64");

    return `${ivB64}:${encryptedB64}`;
  }

  /**
   * Decrypts a string that was encrypted by this service.
   * @param encryptedText The "iv:encryptedData" string.
   * @returns The original plaintext string.
   */
  public async decrypt(encryptedText: string): Promise<string> {
    const parts = encryptedText.split(":");
    if (parts.length !== 2) {
      throw new Error(
        "Invalid encrypted text format. Expected 'iv:encryptedData'.",
      );
    }
    const [ivB64, encryptedB64] = parts;

    if (typeof ivB64 !== "string" || typeof encryptedB64 !== "string") {
      throw new Error(
        "Invalid encrypted text format. IV or encrypted data missing.",
      );
    }

    const iv = Buffer.from(ivB64, "base64");
    const encryptedData = Buffer.from(encryptedB64, "base64");

    try {
      const decryptedDataBuffer = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: iv,
        },
        this.key,
        encryptedData,
      );
      return decoder.decode(decryptedDataBuffer);
    } catch {
      throw new Error(
        "Failed to decrypt: Data may be tampered with or the key is incorrect.",
      );
    }
  }
}

let cryptoService: CryptoService;

export const getCryptoService = async (): Promise<CryptoService> => {
  if (!cryptoService) {
    const secretKey = env.ENCRYPTION_KEY;
    cryptoService = await CryptoService.create(secretKey);
  }
  return cryptoService;
};

// To generate a new key for your .env file, you can run this once:
//
// import { webcrypto as crypto } from "node:crypto";
// const newKey = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
// console.log(`Your new ENCRYPTION_KEY is: ${newKey}`);
