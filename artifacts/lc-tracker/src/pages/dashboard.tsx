import { Link } from "wouter";
import { ExternalLink, Trophy, Activity, TrendingUp, Users, Flame } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { Navbar } from "@/components/Navbar";
import {
  useGetActivityStats,
  useGetLeaderboard,
  useListActivity,
} from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

export default function DashboardPage() {
  const [lbScope, setLbScope] = useState<"following" | "global">("following");
  const [lbPeriod, setLbPeriod] = useState<"day" | "week" | "month" | "year" | "all">("week");
  const { data: stats, isLoading: statsLoading } = useGetActivityStats();
  const { data: leaderboard, isLoading: lbLoading } = useGetLeaderboard({ scope: lbScope, period: lbPeriod });
  const { data: activity, isLoading: actLoading } = useListActivity({ limit: 30 });

  const periodLabels: Record<string, string> = {
    day: "today",
    week: "this week",
    month: "this month",
    year: "this year",
    all: "all time",
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Your network's real-time (within 5 mins) LeetCode activity
            </p>
          </div>
          <Link href="/follows" className="max-sm:hidden">
            <span className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline cursor-pointer">
              <Users className="h-3.5 w-3.5" />
              Manage follows
            </span>
          </Link>
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
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Activity Feed
                </CardTitle>
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
                ) : !Array.isArray(activity) || activity.length === 0 ? (
                  <div className="px-5 py-12 text-center text-muted-foreground text-sm">
                    No activity yet.{" "}
                    <Link href="/follows" className="text-primary hover:underline">
                      Follow some LeetCode users
                    </Link>{" "}
                    to see their activity here.
                  </div>
                ) : (
                  <div className="divide-y divide-border max-h-[520px] overflow-y-auto">
                    {activity.map((item) => (
                      <div
                        key={item.id}
                        className="px-5 py-3.5 flex gap-3 items-start hover:bg-muted/30 transition-colors"
                        data-testid={`activity-item-${item.id}`}
                      >
                        <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {item.leetcodeUsername[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <Link
                              href={`/profiles/${item.leetcodeUsername}`}
                              className="font-semibold text-sm hover:text-primary transition-colors"
                            >
                              {item.leetcodeUsername}
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
                      </div>
                    ))}
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
                  value={lbPeriod}
                  onValueChange={(v) => setLbPeriod(v as "day" | "week" | "month" | "year" | "all")}
                  className="w-full"
                >
                  <TabsList className="h-7 p-0.5 bg-muted/50 w-full flex">
                    <TabsTrigger value="day" className="text-[10px] px-2 h-6 flex-1">Day</TabsTrigger>
                    <TabsTrigger value="week" className="text-[10px] px-2 h-6 flex-1">Week</TabsTrigger>
                    <TabsTrigger value="month" className="text-[10px] px-2 h-6 flex-1">Month</TabsTrigger>
                    <TabsTrigger value="year" className="text-[10px] px-2 h-6 flex-1">Year</TabsTrigger>
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
                ) : (
                  <div className="divide-y divide-border">
                    {leaderboard.map((entry, idx) => (
                      <div
                        key={entry.leetcodeUsername}
                        className="px-5 py-3 flex gap-3 items-center hover:bg-muted/30 transition-colors"
                        data-testid={`leaderboard-entry-${entry.leetcodeUsername}`}
                      >
                        <div
                          className={`shrink-0 flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold ${idx === 0
                            ? "bg-yellow-400/20 text-yellow-400"
                            : idx === 1
                              ? "bg-slate-400/20 text-slate-400"
                              : idx === 2
                                ? "bg-orange-700/20 text-orange-700"
                                : "bg-muted text-muted-foreground"
                            }`}
                        >
                          {idx + 1}
                        </div>
                        {entry.avatarUrl ? (
                          <img
                            src={entry.avatarUrl}
                            alt={entry.leetcodeUsername}
                            className="h-8 w-8 rounded-full object-cover ring-1 ring-border"
                          />
                        ) : (
                          <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {entry.leetcodeUsername[0].toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/profiles/${entry.leetcodeUsername}`}
                            className="font-semibold text-sm hover:text-primary transition-colors block truncate"
                          >
                            {entry.displayName ?? entry.leetcodeUsername}
                          </Link>
                          <p className="text-xs text-muted-foreground truncate">
                            {entry.leetcodeUsername}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-sm text-primary">
                            {entry.solvedInPeriod}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{periodLabels[lbPeriod]}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
