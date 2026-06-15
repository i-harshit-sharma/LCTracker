import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./pushNotification", () => {
  return {
    sendPushNotificationsForUser: vi.fn(),
  };
});

import { runPollCycle } from "./poller";
import * as leetcode from "./leetcode";

// Define mock variables with 'mock' prefix so Vitest hoists them
const mockSelectDistinctFrom = vi.fn();
const mockSelectFromWhere = vi.fn();
const mockUpdateSetWhere = vi.fn();

vi.mock("@workspace/db", () => {
  return {
    db: {
      selectDistinct: vi.fn().mockImplementation(() => ({
        from: mockSelectDistinctFrom,
      })),
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: mockSelectFromWhere,
        })),
      })),
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation(() => ({
          where: mockUpdateSetWhere,
        })),
      })),
    },
    followsTable: { leetcodeUsername: "leetcodeUsername" },
    leetcodeProfilesTable: { username: "username" },
    solvedProblemsTable: { problemSlug: "problemSlug" },
    notificationsTable: { id: "id" },
    scannerMetadataTable: { key: "key" },
    userPreferencesTable: {
      userId: "userId",
      leetcodeUsername: "leetcodeUsername",
      isVerified: "isVerified",
    },
    eq: () => ({}),
    inArray: () => ({}),
    and: () => ({}),
  };
});

vi.mock("./leetcode", () => {
  return {
    getRecentAcceptedSubmissions: vi.fn().mockResolvedValue([]),
    getLeetCodeProfile: vi.fn(),
    getLeetCodeFollowing: vi.fn().mockResolvedValue([]),
    getProblemDifficulty: vi.fn().mockResolvedValue("Easy"),
    getSubmissionDetails: vi.fn(),
    getLatestSubmissionId: vi.fn().mockResolvedValue(null),
    sleep: vi.fn(),
    INTER_USER_DELAY_MS: 0,
  };
});

vi.mock("./posthog", () => {
  return {
    default: {
      capture: vi.fn(),
    },
  };
});

describe("poller privacy check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectDistinctFrom.mockResolvedValue([]);
    mockSelectFromWhere.mockResolvedValue([]);
    mockUpdateSetWhere.mockResolvedValue([]);
  });

  it("should mark a verified user as unverified if their profile is private", async () => {
    // Mock verified users
    mockSelectFromWhere.mockResolvedValue([
      { userId: "user-123", leetcodeUsername: "privateuser" },
    ]);

    // Mock LeetCode profile response to be private
    vi.spyOn(leetcode, "getLeetCodeProfile").mockResolvedValue({
      username: "privateuser",
      realName: null,
      userAvatar: null,
      totalSolved: null,
      easySolved: null,
      mediumSolved: null,
      hardSolved: null,
      aboutMe: null,
      isPrivate: true,
    });

    await runPollCycle();

    // Verify database was updated to set isVerified = false
    expect(mockUpdateSetWhere).toHaveBeenCalled();
  });

  it("should not mark a verified user as unverified if their profile is public", async () => {
    // Mock verified users
    mockSelectFromWhere.mockResolvedValue([
      { userId: "user-456", leetcodeUsername: "publicuser" },
    ]);

    // Mock LeetCode profile response to be public
    vi.spyOn(leetcode, "getLeetCodeProfile").mockResolvedValue({
      username: "publicuser",
      realName: "Public User",
      userAvatar: "https://avatar.com",
      totalSolved: 10,
      easySolved: 5,
      mediumSolved: 3,
      hardSolved: 2,
      aboutMe: "Hello",
      isPrivate: false,
    });

    await runPollCycle();

    // Verify database was NOT updated
    expect(mockUpdateSetWhere).not.toHaveBeenCalled();
  });

  it("should ignore users without a leetcode username", async () => {
    // Mock verified user without a username
    mockSelectFromWhere.mockResolvedValue([
      { userId: "user-789", leetcodeUsername: null },
    ]);

    await runPollCycle();

    // Verify getLeetCodeProfile was not called and DB not updated
    expect(leetcode.getLeetCodeProfile).not.toHaveBeenCalled();
    expect(mockUpdateSetWhere).not.toHaveBeenCalled();
  });
});
