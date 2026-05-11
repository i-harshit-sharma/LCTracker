import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRecentAcceptedSubmissions, getLeetCodeProfile } from "./leetcode";

// Mock global fetch
global.fetch = vi.fn();

describe("leetcode api client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRecentAcceptedSubmissions", () => {
    it("should return a list of submissions on success", async () => {
      const mockSubmissions = [
        {
          id: "1",
          title: "Two Sum",
          titleSlug: "two-sum",
          timestamp: "1610000000",
        },
      ];

      (fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            recentAcSubmissionList: mockSubmissions,
          },
        }),
      });

      const result = await getRecentAcceptedSubmissions("testuser");
      expect(result).toEqual(mockSubmissions);
      expect(fetch).toHaveBeenCalledWith(
        "https://leetcode.com/graphql",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("recentAcSubmissions"),
        }),
      );
    });

    it("should return an empty array on failure", async () => {
      (fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await getRecentAcceptedSubmissions("testuser");
      expect(result).toEqual([]);
    });
  });

  describe("getLeetCodeProfile", () => {
    it("should return profile data on success", async () => {
      const mockProfile = {
        matchedUser: {
          username: "testuser",
          profile: {
            realName: "Test User",
            userAvatar: "https://avatar.com",
            aboutMe: "I love code",
          },
          submitStats: {
            acSubmissionNum: [
              { difficulty: "All", count: 100 },
              { difficulty: "Easy", count: 50 },
              { difficulty: "Medium", count: 30 },
              { difficulty: "Hard", count: 20 },
            ],
          },
        },
      };

      (fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: mockProfile,
        }),
      });

      const result = await getLeetCodeProfile("testuser");
      expect(result).toEqual({
        username: "testuser",
        realName: "Test User",
        userAvatar: "https://avatar.com",
        totalSolved: 100,
        easySolved: 50,
        mediumSolved: 30,
        hardSolved: 20,
        aboutMe: "I love code",
        isPrivate: false,
      });
    });

    it("should return null if user not found", async () => {
      (fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            matchedUser: null,
          },
        }),
      });

      const result = await getLeetCodeProfile("nonexistent");
      expect(result).toBeNull();
    });
  });
});
