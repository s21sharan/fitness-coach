import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "@/lib/encryption";

describe("encryption", () => {
  const key = "a".repeat(64); // 32 bytes hex-encoded

  it("encrypts and decrypts a string", () => {
    const plaintext = "my-secret-password";
    const encrypted = encrypt(plaintext, key);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toContain(":"); // iv:authTag:ciphertext format
    const decrypted = decrypt(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext for same input (random IV)", () => {
    const plaintext = "same-input";
    const a = encrypt(plaintext, key);
    const b = encrypt(plaintext, key);
    expect(a).not.toBe(b);
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encrypt("test", key);
    const tampered = encrypted.slice(0, -2) + "ff";
    expect(() => decrypt(tampered, key)).toThrow();
  });

  it("encrypts and decrypts JSON objects", () => {
    const obj = { email: "user@test.com", password: "pass123" };
    const encrypted = encrypt(JSON.stringify(obj), key);
    const decrypted = JSON.parse(decrypt(encrypted, key));
    expect(decrypted).toEqual(obj);
  });
});
