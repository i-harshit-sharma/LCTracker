import { Link } from "wouter";
import { ExternalLink, Trophy, Activity, TrendingUp, Users, Flame, CheckCircle2, User, X, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { Navbar } from "@/components/Navbar";
import {
  useGetActivityStats,
  useGetLeaderboard,
  useListActivity,
  useGetDbProfileSummary,
  getGetDbProfileSummaryQueryKey,
  useSaveProfileToDb,
  useGetLeetcodeProfile,
  getGetLeetcodeProfileQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useState, useRef, useCallback, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMyProfile } from "@/hooks/use-my-profile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function generateWeeks() {
  const weeks = [];
  const startUTC = new Date(Date.UTC(2026, 3, 27)); // April 27, 2026
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  
  let current = new Date(startUTC);
  let weekNum = 1;
  while (current <= todayUTC) {
    const end = new Date(current);
    end.setUTCDate(end.getUTCDate() + 6);
    
    const startStr = current.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    
    // Unshift to put the most recent week at the top
    weeks.unshift({
      value: `week-${current.toISOString().split("T")[0]}`,
      label: `Week ${weekNum} (${startStr} - ${endStr})`
    });
    
    current.setUTCDate(current.getUTCDate() + 7);
    weekNum++;
  }
  return weeks;
}

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{label}</span>
          <Icon className="h-4 w-4 text-primary opacity-70" />
        </div>
        {loading ? (
          <Skeleton className="h-7 w-16 mt-1" />
        ) : (
          <p className="text-2xl font-bold" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
            {value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Banner that lets the user set/update their own LC username */
function MyProfileBanner({
  myUsername,
  setMyUsername,
}: {
  myUsername: string | null;
  setMyUsername: (u: string | null) => void;
}) {
  const [editing, setEditing] = useState(!myUsername);
  const [draft, setDraft] = useState(myUsername ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed) {
      setMyUsername(trimmed);
      setEditing(false);
    }
  }, [draft, setMyUsername]);

  const cancel = useCallback(() => {
    if (myUsername) {
      setDraft(myUsername);
      setEditing(false);
    }
  }, [myUsername]);

  const startEdit = () => {
    setDraft(myUsername ?? "");
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const clear = () => {
    setMyUsername(null);
    setDraft("");
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  if (!editing && myUsername) {
    return (
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/20 bg-primary/5 text-sm"
        data-testid="my-profile-banner"
      >
        <User className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-muted-foreground">Viewing as</span>
        <span className="font-semibold text-primary font-mono">@{myUsername}</span>
        <button
          onClick={startEdit}
          className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
          title="Change username"
          data-testid="my-profile-edit-btn"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          onClick={clear}
          className="text-muted-foreground hover:text-destructive transition-colors"
          title="Clear"
          data-testid="my-profile-clear-btn"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); commit(); }}
      className="flex items-center gap-2"
      data-testid="my-profile-form"
    >
      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Input
        ref={inputRef}
        id="my-lc-username"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Your LeetCode username"
        className="h-7 text-xs w-44 font-mono"
        autoComplete="off"
        spellCheck={false}
        data-testid="my-profile-input"
      />
      <Button
        type="submit"
        size="sm"
        className="h-7 px-3 text-xs glow-orange"
        disabled={!draft.trim()}
        data-testid="my-profile-save-btn"
      >
        Save
      </Button>
      {myUsername && (
        <button
          type="button"
          onClick={cancel}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          title="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </form>
  );
}

export default function DashboardPage() {
  const [lbScope, setLbScope] = useState<"following" | "global">("following");
  const [lbPeriod, setLbPeriod] = useState<string>("week");
  const [actFilter, setActFilter] = useState<"all" | "unsolved">("all");
  const weeks = generateWeeks();
  const { data: stats, isLoading: statsLoading } = useGetActivityStats();
  const { data: leaderboard, isLoading: lbLoading } = useGetLeaderboard({ scope: lbScope, period: lbPeriod as any });
  const { myUsername, setMyUsername, isLoading: profileLoading } = useMyProfile();
  const { data: activity, isLoading: actLoading } = useListActivity({ 
    limit: 30,
    ...(myUsername ? { myUsername } : {})
  });

  const queryClient = useQueryClient();

  // DB-only fetch of the viewer's own profile — never touches the live LeetCode
  // API and never inserts the user into the global leetcode_profiles table.
  // Returns undefined (silently) when the user hasn't been crawled yet.
  const { data: myDbSummary, refetch: refetchDbSummary } = useGetDbProfileSummary(
    myUsername!,
    { period: lbPeriod as any },
    {
      query: {
        enabled: !!myUsername,
        queryKey: getGetDbProfileSummaryQueryKey(myUsername!, { period: lbPeriod as any }),
        // 404 means "not in DB" — treat as undefined, don't throw
        retry: false,
      },
    },
  );

  // Mutation to seed the viewer's profile into the DB (no follow row created)
  const { mutate: saveToDb, isPending: isSaving, isSuccess: savedOk, isError: saveError } =
    useSaveProfileToDb({
      mutation: {
        onSuccess: () => {
          // Invalidate the db-summary query so the leaderboard row refreshes
          queryClient.invalidateQueries({
            queryKey: getGetDbProfileSummaryQueryKey(myUsername!, { period: lbPeriod as any }),
          });
        },
      },
    });

  // Also refetch whenever the save succeeds (belt-and-suspenders)
  useEffect(() => {
    if (savedOk && myUsername) {
      refetchDbSummary();
    }
  }, [savedOk, myUsername, refetchDbSummary]);

  // Fetch the viewer's own LC profile — DB-first, falls back to live LC API
  // only on first encounter. Works as soon as myUsername is set in localStorage,
  // no "Save to DB" or "follow yourself" required.
  const { data: myProfile } = useGetLeetcodeProfile(myUsername!, {
    query: {
      enabled: !!myUsername,
      retry: false,
      queryKey: getGetLeetcodeProfileQueryKey(myUsername!),
    },
  });

  // Build the set of solved slugs for the viewer.
  // Primary: recentProblems from the profile endpoint (last 20 problems in DB).
  // Secondary: activity feed items that belong to the viewer (covers cases
  //   where the viewer IS followed and their solves appear in the feed).
  const mySolvedSlugs = new Set<string>([
    ...(myProfile?.recentProblems?.map((p) => p.problemSlug.toLowerCase()) ?? []),
    ...(Array.isArray(activity)
      ? activity
          .filter(
            (item) =>
              !!myUsername &&
              item.leetcodeUsername.toLowerCase() === myUsername.toLowerCase(),
          )
          .map((item) => item.problemSlug.toLowerCase())
      : []),
  ]);

  const filteredActivity = Array.isArray(activity)
    ? activity.filter((item) => {
      if (actFilter === "unsolved") {
        return !mySolvedSlugs.has(item.problemSlug.toLowerCase());
      }
      return true;
    })
    : [];

  const periodLabels: Record<string, string> = {
    day: "today",
    week: "this week",
    month: "this month",
    year: "this year",
    all: "all time",
  };
  
  const currentPeriodLabel = lbPeriod.startsWith("week-") 
    ? weeks.find(w => w.value === lbPeriod)?.label?.split(" ")[1] ?? "this week"
    : periodLabels[lbPeriod] ?? "this week";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Your network's real-time (within 5 mins) LeetCode activity
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {profileLoading ? (
              <Skeleton className="h-8 w-[200px]" />
            ) : (
              <MyProfileBanner myUsername={myUsername} setMyUsername={setMyUsername} />
            )}
            {/* <Link href="/follows" className="max-sm:hidden">
              <span className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline cursor-pointer">
                <Users className="h-3.5 w-3.5" />
                Manage follows
              </span>
            </Link> */}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Solved today"
            value={stats?.solvedToday ?? 0}
            icon={Flame}
            loading={statsLoading}
          />
          <StatCard
            label="Solved this week"
            value={stats?.solvedThisWeek ?? 0}
            icon={TrendingUp}
            loading={statsLoading}
          />
          <StatCard
            label="Top difficulty"
            value={stats?.topDifficulty ?? "—"}
            icon={Activity}
            loading={statsLoading}
          />
          <StatCard
            label="Most active"
            value={stats?.mostActiveUser ?? "—"}
            icon={Trophy}
            loading={statsLoading}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Activity feed */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Activity Feed
                </CardTitle>
                <div className="flex items-center gap-4">
                  <Tabs
                    value={actFilter}
                    onValueChange={(v) => setActFilter(v as "all" | "unsolved")}
                    className="w-auto"
                  >
                    <TabsList className="h-7 p-0.5 bg-muted/50">
                      <TabsTrigger value="all" className="text-[10px] px-2 h-6">
                        All
                      </TabsTrigger>
                      <TabsTrigger value="unsolved" className="text-[10px] px-2 h-6">
                        Unsolved
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  {myUsername && (
                    <span className="text-[10px] font-normal text-muted-foreground flex items-center gap-1 max-sm:hidden">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      = solved
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {actLoading ? (
                  <div className="divide-y divide-border">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="px-5 py-3 flex gap-3 items-start">
                        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3.5 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredActivity.length === 0 ? (
                  <div className="px-5 py-12 text-center text-muted-foreground text-sm">
                    {actFilter === "unsolved" ? (
                      <>You've solved everything in this feed! ✨</>
                    ) : (
                      <>
                        No activity yet.{" "}
                        <Link href="/follows" className="text-primary hover:underline">
                          Follow some LeetCode users
                        </Link>{" "}
                        to see their activity here.
                      </>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-border max-h-[520px] overflow-y-auto">
                    {filteredActivity.map((item) => {
                      const solved = !!myUsername && mySolvedSlugs.has(item.problemSlug.toLowerCase());
                      return (
                        <div
                          key={item.id}
                          className={`px-5 py-3.5 flex gap-3 items-start transition-colors ${solved
                              ? "bg-green-500/5 hover:bg-green-500/10"
                              : "hover:bg-muted/30"
                            }`}
                          data-testid={`activity-item-${item.id}`}
                        >
                          {item.avatarUrl ? (
                            <img
                              src={item.avatarUrl}
                              alt={item.leetcodeUsername}
                              className="shrink-0 h-8 w-8 rounded-full object-cover border border-border"
                            />
                          ) : (
                            <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                              {item.leetcodeUsername[0].toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                              <Link
                                href={`/profiles/${item.leetcodeUsername}`}
                                className="font-semibold text-sm hover:text-primary transition-colors truncate max-w-[120px]"
                                title={item.leetcodeUsername}
                              >
                                {item.displayName || item.leetcodeUsername}
                              </Link>
                              <span className="text-sm text-muted-foreground">solved</span>
                              <a
                                href={`https://leetcode.com/problems/${item.problemSlug}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-foreground hover:text-primary transition-colors flex items-center gap-0.5"
                                data-testid={`link-problem-${item.id}`}
                              >
                                {item.problemTitle}
                                <ExternalLink className="h-3 w-3 opacity-50" />
                              </a>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <DifficultyBadge difficulty={item.difficulty} />
                              <span className="text-xs text-muted-foreground">
                                {(() => {
                                  const date = new Date(item.solvedAt);
                                  const finalDate = date > new Date() ? new Date() : date;
                                  return formatDistanceToNow(finalDate, { addSuffix: true });
                                })()}
                              </span>
                            </div>
                          </div>
                          {/* Solved tick */}
                          {myUsername && (
                            <div className="shrink-0 flex items-center pt-0.5" title={solved ? "You've solved this!" : "Not solved yet"}>
                              {solved ? (
                                <CheckCircle2
                                  className="h-4 w-4 text-green-500"
                                  data-testid={`solved-tick-${item.id}`}
                                />
                              ) : (
                                <div className="h-4 w-4 rounded-full border border-muted-foreground/25" />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader className="pb-2 flex flex-col gap-2">
                <div className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-primary" />
                    Leaderboard
                  </CardTitle>
                  <Tabs
                    value={lbScope}
                    onValueChange={(v) => setLbScope(v as "following" | "global")}
                    className="w-auto"
                  >
                    <TabsList className="h-7 p-0.5 bg-muted/50">
                      <TabsTrigger value="following" className="text-[10px] px-2 h-6">
                        Following
                      </TabsTrigger>
                      <TabsTrigger value="global" className="text-[10px] px-2 h-6">
                        Global
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <Tabs
                  value={lbPeriod.startsWith("week-") ? "week" : lbPeriod}
                  onValueChange={setLbPeriod}
                  className="w-full"
                >
                  <TabsList className="h-7 p-0.5 bg-muted/50 w-full flex">
                    <TabsTrigger value="day" className="text-[10px] px-2 h-6 flex-1">Day</TabsTrigger>
                    
                    {/* Replaced 'week' trigger with a custom selector */}
                    <div className={`flex-1 flex rounded-sm transition-all ${lbPeriod === "week" || lbPeriod.startsWith("week-") ? "bg-background text-foreground shadow-sm" : "hover:bg-background/50 text-muted-foreground"}`}>
                      <Select value={lbPeriod === "week" ? "week" : lbPeriod} onValueChange={setLbPeriod}>
                        <SelectTrigger className="h-6 w-full px-2 border-0 bg-transparent text-[10px] focus:ring-0 shadow-none font-medium flex justify-center text-center">
                          <SelectValue placeholder="Week" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="week" className="text-xs">Current Week</SelectItem>
                          {weeks.map((w) => (
                            <SelectItem key={w.value} value={w.value} className="text-xs">
                              {w.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <TabsTrigger value="all" className="text-[10px] px-2 h-6 flex-1">All</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent className="p-0">
                {lbLoading ? (
                  <div className="divide-y divide-border">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="px-5 py-3 flex gap-3 items-center">
                        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                        <div className="flex-1 space-y-1">
                          <Skeleton className="h-3.5 w-2/3" />
                          <Skeleton className="h-3 w-1/3" />
                        </div>
                        <Skeleton className="h-5 w-8" />
                      </div>
                    ))}
                  </div>
                ) : !Array.isArray(leaderboard) || leaderboard.length === 0 ? (
                  <div className="px-5 py-10 text-center text-muted-foreground text-sm">
                    {lbScope === "following"
                      ? "Follow some users to see the leaderboard."
                      : "No activity in the database yet."}
                  </div>
                ) : (() => {
                  // Check if the viewer is already in the leaderboard
                  const myLower = myUsername?.toLowerCase();
                  const isMeInBoard = myLower
                    ? leaderboard.some((e) => e.leetcodeUsername.toLowerCase() === myLower)
                    : false;

                  // Build a merged + sorted list that injects the viewer's
                  // self-entry at the correct position when they have DB data.
                  type LbEntry = (typeof leaderboard)[number] & { _isMe?: boolean };
                  let merged: LbEntry[] = leaderboard.map((e) => ({
                    ...e,
                    _isMe: !!myLower && e.leetcodeUsername.toLowerCase() === myLower,
                  }));

                  const showSavePrompt = myUsername && !isMeInBoard && !myDbSummary;

                  if (myUsername && !isMeInBoard && myDbSummary) {
                    const myCount = myDbSummary.solvedInPeriod ?? 0;
                    const selfEntry: LbEntry = {
                      leetcodeUsername: myUsername,
                      displayName: myDbSummary.displayName ?? null,
                      avatarUrl: myDbSummary.avatarUrl ?? null,
                      solvedInPeriod: myCount,
                      _isMe: true,
                    };
                    const insertIdx = merged.findIndex((e) => (e.solvedInPeriod ?? 0) < myCount);
                    if (insertIdx === -1) {
                      merged.push(selfEntry);
                    } else {
                      merged.splice(insertIdx, 0, selfEntry);
                    }
                  }

                  return (
                    <div className="divide-y divide-border max-h-[520px] overflow-y-auto">
                      {merged.map((entry, idx) => {
                        const isMe = !!entry._isMe;
                        return (
                          <div
                            key={entry.leetcodeUsername}
                            className={`px-5 py-3 flex gap-3 items-center transition-colors ${isMe
                                ? "bg-primary/5 ring-1 ring-inset ring-primary/20 hover:bg-primary/10"
                                : "hover:bg-muted/30"
                              }`}
                            data-testid={isMe ? "leaderboard-entry-self" : `leaderboard-entry-${entry.leetcodeUsername}`}
                          >
                            <div
                              className={`shrink-0 flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold ${idx === 0
                                  ? "bg-yellow-400/20 text-yellow-400"
                                  : idx === 1
                                    ? "bg-slate-400/20 text-slate-400"
                                    : idx === 2
                                      ? "bg-orange-700/20 text-orange-700"
                                      : isMe
                                        ? "bg-primary/10 text-primary"
                                        : "bg-muted text-muted-foreground"
                                }`}
                            >
                              {idx + 1}
                            </div>
                            {entry.avatarUrl ? (
                              <img
                                src={entry.avatarUrl}
                                alt={entry.leetcodeUsername}
                                className={`h-8 w-8 rounded-full object-cover ${isMe
                                    ? "ring-2 ring-primary"
                                    : "ring-1 ring-border"
                                  }`}
                              />
                            ) : (
                              <div
                                className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${isMe
                                    ? "bg-primary/20 text-primary ring-2 ring-primary"
                                    : "bg-primary/10 text-primary"
                                  }`}
                              >
                                {entry.leetcodeUsername[0].toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Link
                                  href={`/profiles/${entry.leetcodeUsername}`}
                                  className="font-semibold text-sm hover:text-primary transition-colors truncate"
                                >
                                  {entry.displayName ?? entry.leetcodeUsername}
                                </Link>
                                {isMe && (
                                  <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground leading-none">
                                    You
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {entry.leetcodeUsername}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold text-sm text-primary">
                                {entry.solvedInPeriod}
                              </p>
                              <p className="text-[10px] text-muted-foreground">{currentPeriodLabel}</p>
                            </div>
                          </div>
                        );
                      })}

                      {/* "Save to DB" prompt when viewer has no DB data yet */}
                      {showSavePrompt && (
                        <>
                          <div className="px-4 py-1.5 flex items-center gap-2">
                            <div className="flex-1 border-t border-dashed border-border" />
                            <span className="text-[10px] text-muted-foreground shrink-0">you</span>
                            <div className="flex-1 border-t border-dashed border-border" />
                          </div>
                          <div
                            className="px-5 py-3 flex gap-3 items-center bg-primary/5 ring-1 ring-inset ring-primary/20"
                            data-testid="leaderboard-entry-self-unsaved"
                          >
                            <div className="shrink-0 flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold bg-primary/10 text-primary">
                              —
                            </div>
                            <div className="shrink-0 h-8 w-8 rounded-full bg-primary/20 text-primary ring-2 ring-primary flex items-center justify-center font-bold text-sm">
                              {myUsername![0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Link
                                  href={`/profiles/${myUsername}`}
                                  className="font-semibold text-sm hover:text-primary transition-colors truncate"
                                >
                                  {myUsername}
                                </Link>
                                <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground leading-none">
                                  You
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">click Save to DB →</p>
                            </div>
                            <div className="text-right shrink-0">
                              <button
                                id="save-my-profile-btn"
                                onClick={() => myUsername && saveToDb({ username: myUsername })}
                                disabled={isSaving}
                                className="text-[10px] font-semibold text-primary hover:underline disabled:opacity-50 disabled:cursor-wait text-right"
                                title="Fetch your profile from LeetCode and save to DB"
                              >
                                {isSaving ? "Saving…" : saveError ? "Retry save" : "Save to DB"}
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
