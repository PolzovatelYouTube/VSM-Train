import { beforeAll, describe, expect, it } from "vitest";

process.env.JWT_SECRET = "test-secret-for-auth";
let auth: typeof import("../server/auth");

beforeAll(async () => {
  auth = await import("../server/auth");
});

describe("authentication primitives", () => {
  it("hashes a password and verifies only the correct value", async () => {
    const hash = await auth.hashPassword("correct horse battery staple");
    expect(hash).not.toContain("correct horse battery staple");
    await expect(auth.verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
    await expect(auth.verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("issues a role-bearing JWT and rejects a tampered token", () => {
    const token = auth.issueToken({ playerId: 7, name: "Тестовый проводник", role: "conductor" });
    expect(auth.verifyToken(token)).toEqual({ playerId: 7, name: "Тестовый проводник", role: "conductor" });
    expect(() => auth.verifyToken(`${token}x`)).toThrow();
  });
});
