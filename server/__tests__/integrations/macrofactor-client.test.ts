import { describe, it, expect, vi, beforeEach } from "vitest";
import { MacroFactorClient } from "../../src/integrations/macrofactor-client.js";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("MacroFactorClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("login", () => {
    it("authenticates with Firebase and returns client", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          idToken: "test-id-token",
          refreshToken: "test-refresh-token",
          localId: "user-123",
          expiresIn: "3600",
        }),
      });

      const client = await MacroFactorClient.login("test@example.com", "password", "fake-api-key");
      expect(client).toBeInstanceOf(MacroFactorClient);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("identitytoolkit.googleapis.com"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "X-Ios-Bundle-Identifier": "com.sbs.diet",
          }),
        }),
      );
    });

    it("throws on invalid credentials", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: { message: "INVALID_PASSWORD" } }),
      });

      await expect(
        MacroFactorClient.login("test@example.com", "wrong", "fake-api-key"),
      ).rejects.toThrow("INVALID_PASSWORD");
    });
  });

  describe("getNutrition", () => {
    it("fetches and parses nutrition data for a date range", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          idToken: "token", refreshToken: "refresh", localId: "uid-1", expiresIn: "3600",
        }),
      });

      const client = await MacroFactorClient.login("e", "p", "key");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          fields: {
            "0429": {
              mapValue: {
                fields: {
                  calories: { stringValue: "2200" },
                  protein: { stringValue: "180" },
                  carbs: { stringValue: "220" },
                  fat: { stringValue: "70" },
                  fiber: { stringValue: "30" },
                },
              },
            },
          },
        }),
      });

      const data = await client.getNutrition("2026-04-29", "2026-04-29");
      expect(data).toHaveLength(1);
      expect(data[0]).toEqual({
        date: "2026-04-29",
        calories: 2200,
        protein: 180,
        carbs: 220,
        fat: 70,
        fiber: 30,
      });
    });
  });

  describe("getWeightEntries", () => {
    it("fetches and parses weight entries", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          idToken: "token", refreshToken: "refresh", localId: "uid-1", expiresIn: "3600",
        }),
      });

      const client = await MacroFactorClient.login("e", "p", "key");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          fields: {
            "0429": {
              mapValue: {
                fields: {
                  weight: { doubleValue: 82.5 },
                },
              },
            },
          },
        }),
      });

      const entries = await client.getWeightEntries("2026-04-29", "2026-04-29");
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual({ date: "2026-04-29", weight_kg: 82.5 });
    });
  });
});
