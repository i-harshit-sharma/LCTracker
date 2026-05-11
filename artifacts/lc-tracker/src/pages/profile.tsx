import { Link, useParams } from "wouter";
import {
  ExternalLink,
  ArrowLeft,
  Target,
  UserPlus,
  UserMinus,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Navbar } from "@/components/Navbar";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { useToast } from "@/hooks/use-toast";
import {
  useGetLeetcodeProfile,
  useListFollows,
  useCreateFollow,
  useDeleteFollow,
  getGetLeetcodeProfileQueryKey,
  getListFollowsQueryKey,
  getGetLeaderboardQueryKey,
  getGetActivityStatsQueryKey,
  getListActivityQueryKey,
  useGetProfileHeatmap,
  type LeetcodeFollowingEntry,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { usePostHog } from "@posthog/react";
import React from "react";
import { Heatmap } from "@/components/Heatmap";

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number | null;
  color: string;
}) {
  return (
    <div
      className={`flex flex-col items-center py-3 px-4 rounded-xl border ${color}`}
    >
      <span className="text-2xl font-bold">{value ?? "—"}</span>
      <span className="text-xs text-muted-foreground mt-0.5">{label}</span>
    </div>
  );
}

function FollowingCard({
  entry,
  isFollowing,
  followId,
  onFollow,
  onUnfollow,
  isPendingFollow,
  isPendingUnfollow,
}: {
  entry: LeetcodeFollowingEntry;
  isFollowing: boolean;
  followId?: number;
  onFollow: (username: string) => void;
  onUnfollow: (id: number) => void;
  isPendingFollow: boolean;
  isPendingUnfollow: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
      {entry.avatarUrl ? (
        <img
          src={entry.avatarUrl}
          alt={entry.username}
          className="h-9 w-9 rounded-full object-cover ring-1 ring-border shrink-0"
        />
      ) : (
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
          {entry.username[0].toUpperCase()}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <Link href={`/profiles/${entry.username}`}>
          <span className="text-sm font-medium hover:text-primary transition-colors cursor-pointer block truncate">
            {entry.displayName ?? entry.username}
          </span>
        </Link>
        <span className="text-xs text-muted-foreground font-mono block truncate">
          @{entry.username}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <a
          href={`https://leetcode.com/${entry.username}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>

        {isFollowing ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
            disabled={isPendingUnfollow}
            onClick={() => followId !== undefined && onUnfollow(followId)}
          >
            <UserMinus className="h-3 w-3 mr-1" />
            {isPendingUnfollow ? "..." : "Unfollow"}
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-7 px-2.5 text-xs glow-orange"
            disabled={isPendingFollow}
            onClick={() => onFollow(entry.username)}
          >
            <UserPlus className="h-3 w-3 mr-1" />
            {isPendingFollow ? "..." : "Follow"}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const posthog = usePostHog();
  const { username } = useParams<{ username: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: profile,
    isLoading,
    isError,
  } = useGetLeetcodeProfile(username!, {
    query: {
      enabled: !!username,
      queryKey: getGetLeetcodeProfileQueryKey(username!),
    },
  });

  const { data: follows } = useListFollows();
  const createFollow = useCreateFollow();
  const deleteFollow = useDeleteFollow();

  const existingFollow = Array.isArray(follows)
    ? follows.find(
        (f) => f.leetcodeUsername.toLowerCase() === username?.toLowerCase(),
      )
    : undefined;
  const isFollowing = !!existingFollow;

  // Track which following username is currently having a follow/unfollow action
  const [pendingFollowUsername, setPendingFollowUsername] = React.useState<
    string | null
  >(null);
  const [pendingUnfollowUsername, setPendingUnfollowUsername] = React.useState<
    string | null
  >(null);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListFollowsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetActivityStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListActivityQueryKey() });
  };

  const handleFollow = () => {
    if (!username) return;
    createFollow.mutate(
      { data: { leetcodeUsername: username } },
      {
        onSuccess: () => {
          posthog?.capture("follow_user", { leetcodeUsername: username });
          toast({ title: `Now following @${username}` });
          invalidateAll();
        },
        onError: (err: any) => {
          toast({
            title: "Failed to follow",
            description: err?.data?.error ?? "Something went wrong.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleUnfollow = () => {
    if (!existingFollow) return;
    deleteFollow.mutate(
      { id: existingFollow.id },
      {
        onSuccess: () => {
          posthog?.capture("unfollow_user", { leetcodeUsername: username });
          toast({ title: `Unfollowed @${username}` });
          invalidateAll();
        },
        onError: () => {
          toast({ title: "Failed to unfollow", variant: "destructive" });
        },
      },
    );
  };

  const handleFollowEntry = (entryUsername: string) => {
    setPendingFollowUsername(entryUsername);
    createFollow.mutate(
      { data: { leetcodeUsername: entryUsername } },
      {
        onSuccess: () => {
          toast({ title: `Now following @${entryUsername}` });
          setPendingFollowUsername(null);
          invalidateAll();
          // Refresh profile to get updated query key
          queryClient.invalidateQueries({
            queryKey: getGetLeetcodeProfileQueryKey(username!),
          });
        },
        onError: (err: any) => {
          toast({
            title: "Failed to follow",
            description: err?.data?.error ?? "Something went wrong.",
            variant: "destructive",
          });
          setPendingFollowUsername(null);
        },
      },
    );
  };

  const handleUnfollowEntry = (id: number, entryUsername: string) => {
    setPendingUnfollowUsername(entryUsername);
    deleteFollow.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: `Unfollowed @${entryUsername}` });
          setPendingUnfollowUsername(null);
          invalidateAll();
        },
        onError: () => {
          toast({ title: "Failed to unfollow", variant: "destructive" });
          setPendingUnfollowUsername(null);
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 py-6">
        <Link href="/dashboard">
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 cursor-pointer">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to dashboard
          </span>
        </Link>

        {isLoading ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          </div>
        ) : isError || !profile ? (
          <div className="py-20 text-center">
            <p className="text-muted-foreground">Profile not found.</p>
            <Link href="/dashboard">
              <span className="text-primary hover:underline cursor-pointer text-sm mt-2 block">
                Go back
              </span>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Profile header */}
            <Card>
              <CardContent className="pt-6 pb-6">
                <div className="flex items-start gap-4">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.leetcodeUsername}
                      className="h-16 w-16 rounded-full object-cover ring-2 ring-border"
                      data-testid="img-profile-avatar"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">
                      {profile.leetcodeUsername[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1
                        className="text-xl font-bold"
                        data-testid="text-profile-display-name"
                      >
                        {profile.displayName ?? profile.leetcodeUsername}
                      </h1>
                      <a
                        href={`https://leetcode.com/${profile.leetcodeUsername}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors"
                        data-testid="link-lc-profile-external"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                    <p className="text-sm text-muted-foreground font-mono">
                      @{profile.leetcodeUsername}
                    </p>
                  </div>

                  {/* Follow / Unfollow button */}
                  {follows !== undefined &&
                    (isFollowing ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleUnfollow}
                        disabled={deleteFollow.isPending}
                        data-testid="button-unfollow-profile"
                        className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                      >
                        <UserMinus className="h-3.5 w-3.5 mr-1.5" />
                        {deleteFollow.isPending ? "..." : "Unfollow"}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={handleFollow}
                        disabled={createFollow.isPending}
                        data-testid="button-follow-profile"
                        className="shrink-0 glow-orange"
                      >
                        <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                        {createFollow.isPending ? "..." : "Follow"}
                      </Button>
                    ))}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                  <StatPill
                    label="Total Solved"
                    value={profile.totalSolved ?? null}
                    color="border-primary/20 bg-primary/5"
                  />
                  <StatPill
                    label="Easy"
                    value={profile.easySolved ?? null}
                    color="border-green-500/20 bg-green-500/5"
                  />
                  <StatPill
                    label="Medium"
                    value={profile.mediumSolved ?? null}
                    color="border-orange-500/20 bg-orange-500/5"
                  />
                  <StatPill
                    label="Hard"
                    value={profile.hardSolved ?? null}
                    color="border-red-500/20 bg-red-500/5"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Consistency Heatmap */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  Consistency
                  <span className="text-xs font-normal text-muted-foreground ml-auto">
                    Last 365 days
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                <HeatmapWrapper username={username!} />
              </CardContent>
            </Card>

            {/* Following section */}
            {profile.following.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Following
                    <span className="ml-auto text-xs font-normal text-muted-foreground">
                      {profile.following.length} user
                      {profile.following.length !== 1 ? "s" : ""}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {profile.following.map((entry) => {
                      const followRecord = follows?.find(
                        (f) =>
                          f.leetcodeUsername.toLowerCase() ===
                          entry.username.toLowerCase(),
                      );
                      return (
                        <FollowingCard
                          key={entry.username}
                          entry={entry}
                          isFollowing={!!followRecord}
                          followId={followRecord?.id}
                          onFollow={handleFollowEntry}
                          onUnfollow={(id) =>
                            handleUnfollowEntry(id, entry.username)
                          }
                          isPendingFollow={
                            pendingFollowUsername === entry.username
                          }
                          isPendingUnfollow={
                            pendingUnfollowUsername === entry.username
                          }
                        />
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent problems */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Recent solved problems
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!profile.recentProblems?.length ? (
                  <div className="px-5 py-10 text-center text-muted-foreground text-sm">
                    No problems tracked yet. Check back after the next poll
                    cycle.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {profile.recentProblems.map((problem) => (
                      <div
                        key={problem.id}
                        className="px-5 py-3.5 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                        data-testid={`problem-row-${problem.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2">
                            {problem.problemSlug.startsWith("private-") ||
                            problem.problemSlug.startsWith("unknown-") ? (
                              <span className="text-sm font-medium">
                                {problem.problemTitle}
                              </span>
                            ) : (
                              <a
                                href={`https://leetcode.com/problems/${problem.problemSlug}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1 group"
                                data-testid={`link-problem-${problem.id}`}
                              >
                                {problem.problemTitle}
                                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                              </a>
                            )}
                            {problem.submissionId &&
                              !problem.submissionId.startsWith("private-") &&
                              !problem.submissionId.startsWith("unknown-") && (
                                <a
                                  href={`https://leetcode.com/problems/${problem.problemSlug}/submissions/${problem.submissionId}/`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-primary/60 hover:text-primary hover:underline"
                                >
                                  (Submission)
                                </a>
                              )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(problem.solvedAt), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                        <DifficultyBadge difficulty={problem.difficulty} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

function HeatmapWrapper({ username }: { username: string }) {
  const { data: heatmapData, isLoading } = useGetProfileHeatmap(username);

  return (
    <Heatmap
      data={Array.isArray(heatmapData) ? heatmapData : []}
      isLoading={isLoading}
    />
  );
}

// React must be in scope for useState
