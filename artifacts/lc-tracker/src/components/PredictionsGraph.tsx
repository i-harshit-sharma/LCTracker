import { useMemo, useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useGetLeaderboard,
  getGetLeaderboardQueryOptions,
  useGetPreferences,
} from "@workspace/api-client-react";
import { useQueries } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  AlertTriangle,
  History,
  Info,
  Eye,
  EyeOff,
  CheckSquare,
  Square,
  Clock,
  Timer,
  CalendarDays,
} from "lucide-react";
import {
  subWeeks,
  startOfWeek,
  format,
  differenceInDays,
  addWeeks,
  addDays,
} from "date-fns";

interface OvertakingEvent {
  user1: string;
  user2: string;
  day: number;
  total: number;
}

interface UserStat {
  username: string;
  growthRate: number;
  velocity: number;
  total: number;
  gap: number;
  gapTrend: "closing" | "widening" | "stable";
  requiredDailyRate: number;
  overtakeDate: string | null;
  lastSolvedAt: string | null;
  avgTimeBetweenSolves: number | null;
}

interface PredictionChallenge {
  leaderUsername: string;
  neededVelocity: number;
  neededGrowthRate: number;
  currentVelocity: number;
  neededDailyVelocity: number;
}

interface ProcessedPredictionData {
  chartData: any[];
  events: OvertakingEvent[];
  stats: UserStat[];
  challenge: PredictionChallenge | null;
}

const colors = ["#f97316", "#06b6d4", "#10b981", "#6366f1", "#f43f5e"];

export function PredictionsGraph() {
  const { data: prefs } = useGetPreferences();
  const myUsername = prefs?.leetcodeUsername;

  const [visibleUsers, setVisibleUsers] = useState<Set<string>>(new Set());
  const [hasInitializedVisibility, setHasInitializedVisibility] =
    useState(false);
  const [sortBy, setSortBy] = useState<"velocity" | "required">("velocity");
  const [projectionDays, setProjectionDays] = useState(60);
  const [now, setNow] = useState(() => Date.now());

  // Tick every second for the live "time since last solve" timer
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Generate keys for the last 3 weeks to calculate a moving average velocity
  const historicalWeeks = useMemo(() => {
    const dates = [];
    const now = new Date();
    for (let i = 0; i < 3; i++) {
      const date = subWeeks(now, i);
      const start = startOfWeek(date, { weekStartsOn: 1 }); // Monday
      dates.push(`week-${format(start, "yyyy-MM-dd")}`);
    }
    return dates;
  }, []);

  // Fetch leaderboard for current and previous weeks for FOLLOWED users
  const historicalQueries = useQueries({
    queries: historicalWeeks.map((period) =>
      getGetLeaderboardQueryOptions({ scope: "following", period }),
    ),
  });

  const {
    data: currentLeaderboard,
    isLoading: isCurrentLoading,
    error: currentError,
  } = useGetLeaderboard({
    scope: "following",
    period: "all",
  });

  // Initialize visible users when data loads (restoring from localStorage if available)
  useEffect(() => {
    if (
      currentLeaderboard &&
      Array.isArray(currentLeaderboard) &&
      !hasInitializedVisibility
    ) {
      const saved = localStorage.getItem("lc-tracker-graph-visibility");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setVisibleUsers(new Set(parsed));
          } else {
            setVisibleUsers(
              new Set(currentLeaderboard.map((u) => u.leetcodeUsername)),
            );
          }
        } catch (e) {
          console.error("Failed to parse graph visibility settings", e);
          setVisibleUsers(
            new Set(currentLeaderboard.map((u) => u.leetcodeUsername)),
          );
        }
      } else {
        setVisibleUsers(
          new Set(currentLeaderboard.map((u) => u.leetcodeUsername)),
        );
      }
      setHasInitializedVisibility(true);
    }
  }, [currentLeaderboard, hasInitializedVisibility]);

  // Persist visible users to localStorage
  useEffect(() => {
    if (hasInitializedVisibility) {
      localStorage.setItem(
        "lc-tracker-graph-visibility",
        JSON.stringify(Array.from(visibleUsers)),
      );
    }
  }, [visibleUsers, hasInitializedVisibility]);

  const toggleUserVisibility = useCallback((username: string) => {
    setVisibleUsers((prev) => {
      const next = new Set(prev);
      if (next.has(username)) {
        next.delete(username);
      } else {
        next.add(username);
      }
      return next;
    });
  }, []);

  const showAllUsers = useCallback(() => {
    if (currentLeaderboard && Array.isArray(currentLeaderboard)) {
      setVisibleUsers(
        new Set(currentLeaderboard.map((u) => u.leetcodeUsername)),
      );
    }
  }, [currentLeaderboard]);

  const hideAllUsers = useCallback(() => {
    setVisibleUsers(new Set());
  }, []);

  const isLoading =
    isCurrentLoading || historicalQueries.some((q) => q.isLoading);
  const isError = currentError || historicalQueries.some((q) => q.isError);

  const processedData = useMemo((): ProcessedPredictionData => {
    if (!currentLeaderboard || !Array.isArray(currentLeaderboard)) {
      return { chartData: [], events: [], stats: [], challenge: null };
    }
    if (historicalQueries.some((q) => !q.data)) {
      return { chartData: [], events: [], stats: [], challenge: null };
    }

    const targetDate = new Date("2026-07-15");
    const daysRemaining = Math.max(1, differenceInDays(targetDate, new Date()));

    // Calculate average velocity for each user across historical weeks
    const userVelocityMap = new Map<string, number>();

    historicalQueries.forEach((query) => {
      const weekData = query.data as any[];
      if (Array.isArray(weekData)) {
        weekData.forEach((entry) => {
          const current = userVelocityMap.get(entry.leetcodeUsername) || 0;
          userVelocityMap.set(
            entry.leetcodeUsername,
            current + (entry.solvedInPeriod || 0),
          );
        });
      }
    });

    // Divide by number of weeks to get average velocity
    userVelocityMap.forEach((total, username) => {
      userVelocityMap.set(username, total / historicalWeeks.length);
    });

    // Select users to plot: All followed users
    const plottedUsers = [...currentLeaderboard].filter(
      (u) => u.totalSolved !== null && u.totalSolved !== undefined,
    );

    if (plottedUsers.length === 0) {
      return { chartData: [], events: [], stats: [], challenge: null };
    }

    // Get my current total solved to calculate gaps
    const myTotal =
      currentLeaderboard.find((u) => u.leetcodeUsername === myUsername)
        ?.totalSolved || 0;

    // Calculate stats like growth rate % and gap from me
    const stats = plottedUsers
      .map((user) => {
        const total = user.totalSolved || 0;
        const velocity = userVelocityMap.get(user.leetcodeUsername) || 0;
        const growthRate = (velocity / (total || 1)) * 100;
        const gap = total - myTotal;

        // Calculate daily rate to beat this specific user by July 15, 2026
        const targetDailyVelocity = velocity / 7;
        const myDailyVelocity =
          (userVelocityMap.get(myUsername || "") || 0) / 7;
        const projectedTargetTotal =
          total + targetDailyVelocity * daysRemaining;
        const requiredDailyRate = Math.max(
          0,
          (projectedTargetTotal - myTotal) / daysRemaining,
        );

        // Determine gap trend: is the gap closing or widening relative to me?
        let gapTrend: "closing" | "widening" | "stable" = "stable";
        if (user.leetcodeUsername !== myUsername) {
          const velocityDiff = targetDailyVelocity - myDailyVelocity;
          if (velocityDiff > 0.01) {
            // They're faster → gap is widening (bad for me)
            gapTrend = "widening";
          } else if (velocityDiff < -0.01) {
            // I'm faster → gap is closing (good for me)
            gapTrend = "closing";
          }
        }

        // Calculate overtake date if current speed is higher
        let overtakeDate = null;
        if (myDailyVelocity > targetDailyVelocity && gap > 0) {
          const daysToOvertake = gap / (myDailyVelocity - targetDailyVelocity);
          if (daysToOvertake <= daysRemaining) {
            const date = new Date();
            date.setDate(date.getDate() + Math.ceil(daysToOvertake));
            overtakeDate = format(date, "MMM d, yyyy");
          }
        }

        return {
          username: user.leetcodeUsername,
          growthRate,
          velocity,
          total,
          gap,
          gapTrend,
          requiredDailyRate,
          overtakeDate,
          lastSolvedAt: user.lastSolvedAt ?? null,
          avgTimeBetweenSolves: user.avgTimeBetweenSolves ?? null,
        };
      })
      .sort((a, b) => {
        if (sortBy === "velocity") {
          return b.velocity - a.velocity;
        } else {
          return b.requiredDailyRate - a.requiredDailyRate;
        }
      });

    // Generate chart data (daily projections)
    const totalDays = projectionDays;
    const chartData = [];
    const currentDate = new Date();
    for (let d = 0; d <= totalDays; d++) {
      const date = addDays(currentDate, d);
      const dataPoint: any = {
        day: d === 0 ? "Today" : format(date, "MMM d"),
        rawDate: date,
      };
      plottedUsers.forEach((user) => {
        const currentTotal = user.totalSolved || 0;
        const velocity = userVelocityMap.get(user.leetcodeUsername) || 0;
        const dailyVelocity = velocity / 7;
        dataPoint[user.leetcodeUsername] = Math.round(
          currentTotal + dailyVelocity * d,
        );
      });
      chartData.push(dataPoint);
    }

    // Calculate overtaking events for all plotted users
    const events: OvertakingEvent[] = [];
    for (let i = 0; i < plottedUsers.length; i++) {
      for (let j = i + 1; j < plottedUsers.length; j++) {
        const u1 = plottedUsers[i];
        const u2 = plottedUsers[j];

        const T1 = u1.totalSolved || 0;
        const V1 = userVelocityMap.get(u1.leetcodeUsername) || 0;
        const T2 = u2.totalSolved || 0;
        const V2 = userVelocityMap.get(u2.leetcodeUsername) || 0;

        if (V1 === V2 || Math.abs(V1 - V2) < 0.1) continue;

        // Convert to daily velocities for day-based projections
        const DV1 = V1 / 7;
        const DV2 = V2 / 7;
        const D = (T2 - T1) / (DV1 - DV2);

        if (D > 0 && D <= projectionDays) {
          // Identify who is overtaking whom: the one with higher velocity was behind
          const user1IsOvertaker = DV1 > DV2;

          events.push({
            user1: user1IsOvertaker ? u1.leetcodeUsername : u2.leetcodeUsername,
            user2: user1IsOvertaker ? u2.leetcodeUsername : u1.leetcodeUsername,
            day: D,
            total: T1 + DV1 * D,
          });
        }
      }
    }

    // Calculate overtake challenge for current user
    const leader = [...currentLeaderboard].sort(
      (a, b) => (b.totalSolved || 0) - (a.totalSolved || 0),
    )[0];
    const meStat = stats.find((u) => u.username === myUsername);
    let challenge = null;

    if (leader && meStat && leader.leetcodeUsername !== myUsername) {
      const leaderTotal = leader.totalSolved || 0;
      const leaderVelocity = userVelocityMap.get(leader.leetcodeUsername) || 0;
      const myTotal =
        currentLeaderboard.find((u) => u.leetcodeUsername === myUsername)
          ?.totalSolved || 0;

      const predictedLeaderTotal =
        leaderTotal + (leaderVelocity / 7) * daysRemaining;
      const neededTotal = predictedLeaderTotal + 1;
      const neededVelocity = (neededTotal - myTotal) / (daysRemaining / 7);
      const neededGrowthRate = (neededVelocity / (myTotal || 1)) * 100;
      const neededDailyVelocity = (neededTotal - myTotal) / daysRemaining;

      challenge = {
        leaderUsername: leader.leetcodeUsername,
        neededVelocity,
        neededGrowthRate,
        currentVelocity: meStat.velocity,
        neededDailyVelocity,
      };
    }

    return { chartData, events, stats, challenge };
  }, [
    currentLeaderboard,
    historicalQueries,
    historicalWeeks,
    myUsername,
    sortBy,
    projectionDays,
  ]);

  const {
    chartData: predictionData,
    events: overtakingEvents,
    stats: userStats,
    challenge,
  } = processedData;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const myItem = payload.find((p: any) => p.dataKey === myUsername);
      const myValue = myItem ? myItem.value : 0;

      // Sort payload by value descending
      const sortedPayload = [...payload].sort((a, b) => b.value - a.value);

      return (
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 shadow-xl min-w-[200px]">
          <p className="text-[12px] font-bold mb-2 text-slate-400 flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span>{label}</span>
            <span className="text-[10px] font-normal text-slate-500">
              Solves & Gap
            </span>
          </p>
          <div className="space-y-1.5">
            {sortedPayload.map((entry: any, index: number) => {
              const gap = entry.value - myValue;
              const isMe = entry.dataKey === myUsername;
              const originalIndex = Object.keys(predictionData[0])
                .filter((k) => k !== "day" && k !== "rawDate")
                .indexOf(entry.dataKey);
              const colorIdx =
                originalIndex >= 0 ? originalIndex % colors.length : 0;
              return (
                <div
                  key={index}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: colors[colorIdx] }}
                    />
                    <span
                      className={`text-[12px] truncate ${isMe ? "font-bold text-primary" : "text-slate-200"}`}
                    >
                      @{entry.dataKey}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[12px] font-mono font-bold text-white">
                      {entry.value.toLocaleString()}
                    </span>
                    {!isMe &&
                      (() => {
                        const userStat = userStats.find(
                          (s) => s.username === entry.dataKey,
                        );
                        const trend = userStat?.gapTrend || "stable";
                        const colorClass =
                          trend === "closing"
                            ? "text-emerald-400"
                            : trend === "widening"
                              ? "text-red-400"
                              : "text-slate-400";
                        return (
                          <span
                            className={`text-[10px] font-bold min-w-[40px] text-right ${colorClass}`}
                          >
                            {gap > 0 ? `+${gap}` : gap}
                            <span className="ml-0.5">
                              {trend === "closing"
                                ? "↓"
                                : trend === "widening"
                                  ? "↑"
                                  : ""}
                            </span>
                          </span>
                        );
                      })()}
                    {isMe && (
                      <span className="text-[10px] font-bold text-primary min-w-[40px] text-right">
                        YOU
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="mt-8 border-destructive/20 bg-destructive/5">
        <CardContent className="py-10 flex flex-col items-center justify-center text-center gap-3">
          <AlertTriangle className="h-10 w-10 text-destructive opacity-50" />
          <div>
            <p className="font-semibold text-destructive">
              Failed to load predictions
            </p>
            <p className="text-xs text-muted-foreground">
              The leaderboard data could not be retrieved.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!predictionData.length) {
    return (
      <Card className="mt-8 border-dashed">
        <CardContent className="py-10 flex flex-col items-center justify-center text-center gap-3">
          <Info className="h-10 w-10 text-muted-foreground opacity-50" />
          <div>
            <p className="font-semibold">No data for predictions</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              We need at least some all-time solve data to project future
              growth.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-8 overflow-hidden">
      <CardHeader className="border-b bg-muted/20 flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Growth & Overtaking Predictions
          </CardTitle>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
            <History className="h-3 w-3" />
            Daily projections based on 3-week moving average velocity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-muted/50 border border-border/50">
            {([15, 30, 60] as const).map((days) => {
              const label = days === 60 ? "2 Months" : `${days} Days`;
              return (
                <Button
                  key={days}
                  variant={projectionDays === days ? "default" : "ghost"}
                  size="sm"
                  className={`h-7 text-[10px] px-2.5 ${projectionDays === days ? "shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setProjectionDays(days)}
                >
                  <CalendarDays className="h-3 w-3 mr-1" />
                  {label}
                </Button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[10px] gap-1.5"
            onClick={showAllUsers}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            Show All
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[10px] gap-1.5"
            onClick={hideAllUsers}
          >
            <Square className="h-3.5 w-3.5" />
            Hide All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={predictionData}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1e293b"
                opacity={0.5}
                vertical={false}
              />
              <XAxis
                dataKey="day"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                interval={
                  projectionDays <= 15 ? 1 : projectionDays <= 30 ? 3 : 7
                }
                dy={8}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => val.toLocaleString()}
                dx={-8}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} />
              {Object.keys(predictionData[0])
                .filter(
                  (key) =>
                    key !== "day" && key !== "rawDate" && visibleUsers.has(key),
                )
                .map((username) => {
                  const allUsernames = Object.keys(predictionData[0]).filter(
                    (k) => k !== "day" && k !== "rawDate",
                  );
                  const originalIndex = allUsernames.indexOf(username);
                  const isMe = username === myUsername;
                  const colorVal = colors[originalIndex % colors.length];
                  return (
                    <Line
                      key={username}
                      type="monotone"
                      dataKey={username}
                      stroke={colorVal}
                      strokeWidth={isMe ? 3 : 2}
                      dot={
                        isMe
                          ? { r: 3, fill: colorVal, stroke: colorVal }
                          : false
                      }
                      activeDot={{
                        r: 5,
                        strokeWidth: 1.5,
                        stroke: "#ffffff",
                        fill: colorVal,
                      }}
                      connectNulls
                    />
                  );
                })}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {userStats.length > 0 && (
          <div className="mt-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Velocity & Growth Rate
              </h4>
              <div className="flex items-center gap-1.5 p-1 rounded-lg bg-muted/50 border border-border/50">
                <Button
                  variant={sortBy === "velocity" ? "default" : "ghost"}
                  size="sm"
                  className={`h-7 text-[10px] px-2.5 ${sortBy === "velocity" ? "shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setSortBy("velocity")}
                >
                  Current Speed
                </Button>
                <Button
                  variant={sortBy === "required" ? "default" : "ghost"}
                  size="sm"
                  className={`h-7 text-[10px] px-2.5 ${sortBy === "required" ? "shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setSortBy("required")}
                >
                  Required Speed
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {userStats.map((stat, i) => {
                const isVisible = visibleUsers.has(stat.username);
                return (
                  <button
                    key={stat.username}
                    onClick={() => toggleUserVisibility(stat.username)}
                    className={`p-3 rounded-lg border flex flex-col gap-1 transition-all text-left group ${
                      !isVisible
                        ? "bg-muted/10 border-border/20 opacity-50 grayscale hover:grayscale-0 hover:opacity-80"
                        : stat.username === myUsername
                          ? "bg-primary/10 border-primary/30 ring-1 ring-primary/20 shadow-sm"
                          : "bg-muted/30 border-border/50 hover:bg-muted/50 hover:border-border shadow-sm"
                    } relative`}
                  >
                    {stat.overtakeDate && stat.username !== myUsername && (
                      <div
                        className="absolute top-2 right-2 flex items-center gap-1"
                        title={`On track to overtake by ${stat.overtakeDate}!`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-bold truncate ${isVisible && stat.username === myUsername ? "text-primary" : "text-foreground"}`}
                      >
                        @{stat.username}
                      </span>
                      {isVisible ? (
                        <Eye className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                      ) : (
                        <EyeOff className="h-3 w-3 text-muted-foreground/30" />
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Growth
                      </span>
                      <span
                        className={`text-xs font-mono font-bold ${isVisible ? "text-emerald-500" : "text-muted-foreground"}`}
                      >
                        +{stat.growthRate.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Gap
                      </span>
                      <span
                        className={`text-[10px] font-bold ${stat.gap === 0 ? "text-muted-foreground" : stat.gapTrend === "closing" ? "text-emerald-500" : stat.gapTrend === "widening" ? "text-red-500" : "text-muted-foreground"}`}
                      >
                        {stat.gap === 0
                          ? "You"
                          : `${stat.gap > 0 ? "+" : ""}${stat.gap}`}
                        {stat.gap !== 0 && (
                          <span className="ml-0.5">
                            {stat.gapTrend === "closing"
                              ? "↓"
                              : stat.gapTrend === "widening"
                                ? "↑"
                                : ""}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Speed
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {stat.velocity.toFixed(1)}/wk
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        Last Solve
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold ${(() => {
                          if (!stat.lastSolvedAt)
                            return "text-muted-foreground";
                          const diffH =
                            (now - new Date(stat.lastSolvedAt).getTime()) /
                            (1000 * 60 * 60);
                          if (diffH < 24) return "text-emerald-500";
                          if (diffH < 48) return "text-amber-500";
                          return "text-red-500";
                        })()}`}
                      >
                        {stat.lastSolvedAt
                          ? (() => {
                              const diffMs =
                                now - new Date(stat.lastSolvedAt).getTime();
                              const totalSeconds = Math.floor(diffMs / 1000);
                              const days = Math.floor(totalSeconds / 86400);
                              const hours = Math.floor(
                                (totalSeconds % 86400) / 3600,
                              );
                              const mins = Math.floor(
                                (totalSeconds % 3600) / 60,
                              );
                              const secs = totalSeconds % 60;
                              if (days > 0)
                                return `${days}d ${hours}h ${mins}m`;
                              return `${hours}h ${mins}m ${secs}s`;
                            })()
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-0.5">
                        <Timer className="h-2.5 w-2.5" />
                        Avg Time
                      </span>
                      <span className="text-[10px] font-mono font-medium text-muted-foreground">
                        {stat.avgTimeBetweenSolves != null
                          ? (() => {
                              const h = stat.avgTimeBetweenSolves;
                              if (h < 1) return `${Math.round(h * 60)}m`;
                              if (h < 24) return `${h.toFixed(1)}h`;
                              const days = Math.floor(h / 24);
                              const rem = Math.round(h % 24);
                              return `${days}d ${rem}h`;
                            })()
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1 pt-1 border-t border-border/20">
                      {stat.username === myUsername ? (
                        <>
                          <span className="text-[9px] text-primary uppercase font-bold">
                            Current Speed
                          </span>
                          <span className="text-[10px] font-bold text-primary">
                            {(stat.velocity / 7).toFixed(2)}/d
                          </span>
                        </>
                      ) : stat.overtakeDate ? (
                        <>
                          <span className="text-[9px] text-blue-400 uppercase font-bold">
                            Overtake By
                          </span>
                          <span className="text-[10px] font-bold text-blue-400">
                            {stat.overtakeDate}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-[9px] text-emerald-500/80 uppercase font-bold">
                            To Beat (15 July)
                          </span>
                          <span className="text-[10px] font-bold text-emerald-500">
                            {stat.requiredDailyRate.toFixed(2)}/d
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
