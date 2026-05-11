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
  useGetPreferences
} from "@workspace/api-client-react";
import { useQueries } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, AlertTriangle, History, Info, Eye, EyeOff, CheckSquare, Square } from "lucide-react";
import { subWeeks, startOfWeek, format, differenceInDays, addWeeks } from "date-fns";

interface OvertakingEvent {
  user1: string;
  user2: string;
  week: number;
  total: number;
}

interface UserStat {
  username: string;
  growthRate: number;
  velocity: number;
  total: number;
  gap: number;
  requiredDailyRate: number;
  overtakeDate: string | null;
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

export function PredictionsGraph() {
  const { data: prefs } = useGetPreferences();
  const myUsername = prefs?.leetcodeUsername;

  const [visibleUsers, setVisibleUsers] = useState<Set<string>>(new Set());
  const [hasInitializedVisibility, setHasInitializedVisibility] = useState(false);

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
    queries: historicalWeeks.map(period => 
      getGetLeaderboardQueryOptions({ scope: "following", period })
    )
  });

  const { data: currentLeaderboard, isLoading: isCurrentLoading, error: currentError } = useGetLeaderboard({ 
    scope: "following", 
    period: "all" 
  });

  // Initialize visible users when data loads (restoring from localStorage if available)
  useEffect(() => {
    if (currentLeaderboard && Array.isArray(currentLeaderboard) && !hasInitializedVisibility) {
      const saved = localStorage.getItem("lc-tracker-graph-visibility");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setVisibleUsers(new Set(parsed));
          } else {
            setVisibleUsers(new Set(currentLeaderboard.map(u => u.leetcodeUsername)));
          }
        } catch (e) {
          console.error("Failed to parse graph visibility settings", e);
          setVisibleUsers(new Set(currentLeaderboard.map(u => u.leetcodeUsername)));
        }
      } else {
        setVisibleUsers(new Set(currentLeaderboard.map(u => u.leetcodeUsername)));
      }
      setHasInitializedVisibility(true);
    }
  }, [currentLeaderboard, hasInitializedVisibility]);

  // Persist visible users to localStorage
  useEffect(() => {
    if (hasInitializedVisibility) {
      localStorage.setItem("lc-tracker-graph-visibility", JSON.stringify(Array.from(visibleUsers)));
    }
  }, [visibleUsers, hasInitializedVisibility]);

  const toggleUserVisibility = useCallback((username: string) => {
    setVisibleUsers(prev => {
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
      setVisibleUsers(new Set(currentLeaderboard.map(u => u.leetcodeUsername)));
    }
  }, [currentLeaderboard]);

  const hideAllUsers = useCallback(() => {
    setVisibleUsers(new Set());
  }, []);

  const isLoading = isCurrentLoading || historicalQueries.some(q => q.isLoading);
  const isError = currentError || historicalQueries.some(q => q.isError);

  const processedData = useMemo((): ProcessedPredictionData => {
    if (!currentLeaderboard || !Array.isArray(currentLeaderboard)) {
      return { chartData: [], events: [], stats: [], challenge: null };
    }
    if (historicalQueries.some(q => !q.data)) {
      return { chartData: [], events: [], stats: [], challenge: null };
    }

    const targetDate = new Date("2026-07-15");
    const daysRemaining = Math.max(1, differenceInDays(targetDate, new Date()));

    // Calculate average velocity for each user across historical weeks
    const userVelocityMap = new Map<string, number>();
    
    historicalQueries.forEach(query => {
      const weekData = query.data as any[];
      if (Array.isArray(weekData)) {
        weekData.forEach(entry => {
          const current = userVelocityMap.get(entry.leetcodeUsername) || 0;
          userVelocityMap.set(entry.leetcodeUsername, current + (entry.solvedInPeriod || 0));
        });
      }
    });

    // Divide by number of weeks to get average velocity
    userVelocityMap.forEach((total, username) => {
      userVelocityMap.set(username, total / historicalWeeks.length);
    });

    // Select users to plot: All followed users
    const plottedUsers = [...currentLeaderboard]
      .filter(u => u.totalSolved !== null && u.totalSolved !== undefined);

    if (plottedUsers.length === 0) {
      return { chartData: [], events: [], stats: [], challenge: null };
    }

    // Get my current total solved to calculate gaps
    const myTotal = currentLeaderboard.find(u => u.leetcodeUsername === myUsername)?.totalSolved || 0;

    // Calculate stats like growth rate % and gap from me
    const stats = plottedUsers.map(user => {
      const total = user.totalSolved || 0;
      const velocity = userVelocityMap.get(user.leetcodeUsername) || 0;
      const growthRate = (velocity / (total || 1)) * 100;
      const gap = total - myTotal;
      
      // Calculate daily rate to beat this specific user by July 15, 2026
      const targetDailyVelocity = velocity / 7;
      const myDailyVelocity = (userVelocityMap.get(myUsername || "") || 0) / 7;
      const projectedTargetTotal = total + (targetDailyVelocity * daysRemaining);
      const requiredDailyRate = Math.max(0, (projectedTargetTotal - myTotal) / daysRemaining);

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
        requiredDailyRate,
        overtakeDate
      };
    }).sort((a, b) => b.growthRate - a.growthRate);

    // Generate chart data
    const totalWeeks = 8;
    const chartData = [];
    const now = new Date();
    for (let w = 0; w <= totalWeeks; w++) {
      const date = addWeeks(now, w);
      const dataPoint: any = { 
        week: w === 0 ? "Now" : format(date, "MMM d"),
        rawDate: date,
      };
      plottedUsers.forEach(user => {
        const currentTotal = user.totalSolved || 0;
        const velocity = userVelocityMap.get(user.leetcodeUsername) || 0;
        dataPoint[user.leetcodeUsername] = Math.round(currentTotal + velocity * w);
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

        const W = (T2 - T1) / (V1 - V2);
        
        if (W > 0 && W <= 8) {
          // Identify who is overtaking whom: the one with higher velocity was behind
          const user1IsOvertaker = V1 > V2;
          
          events.push({
            user1: user1IsOvertaker ? u1.leetcodeUsername : u2.leetcodeUsername,
            user2: user1IsOvertaker ? u2.leetcodeUsername : u1.leetcodeUsername,
            week: W,
            total: T1 + V1 * W
          });
        }
      }
    }

    // Calculate overtake challenge for current user
    const leader = [...currentLeaderboard].sort((a, b) => (b.totalSolved || 0) - (a.totalSolved || 0))[0];
    const meStat = stats.find(u => u.username === myUsername);
    let challenge = null;

    if (leader && meStat && leader.leetcodeUsername !== myUsername) {
      const leaderTotal = leader.totalSolved || 0;
      const leaderVelocity = userVelocityMap.get(leader.leetcodeUsername) || 0;
      const myTotal = currentLeaderboard.find(u => u.leetcodeUsername === myUsername)?.totalSolved || 0;
      
      const predictedLeaderTotal = leaderTotal + (leaderVelocity / 7 * daysRemaining);
      const neededTotal = predictedLeaderTotal + 1;
      const neededVelocity = (neededTotal - myTotal) / (daysRemaining / 7);
      const neededGrowthRate = (neededVelocity / (myTotal || 1)) * 100;
      const neededDailyVelocity = (neededTotal - myTotal) / daysRemaining;

      challenge = {
        leaderUsername: leader.leetcodeUsername,
        neededVelocity,
        neededGrowthRate,
        currentVelocity: meStat.velocity,
        neededDailyVelocity
      };
    }

    return { chartData, events, stats, challenge };
  }, [currentLeaderboard, historicalQueries, historicalWeeks, myUsername]);

  const { chartData: predictionData, events: overtakingEvents, stats: userStats, challenge } = processedData;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const myItem = payload.find((p: any) => p.dataKey === myUsername);
      const myValue = myItem ? myItem.value : 0;
      
      // Sort payload by value descending
      const sortedPayload = [...payload].sort((a, b) => b.value - a.value);

      return (
        <div className="bg-slate-950/95 border border-slate-800 rounded-xl p-3 shadow-2xl backdrop-blur-sm min-w-[220px]">
          <p className="text-[12px] font-bold mb-3 text-slate-400 flex items-center justify-between border-b border-slate-800 pb-2">
            <span>{label}</span>
            <span className="text-[10px] font-normal text-slate-500">Solves & Gap</span>
          </p>
          <div className="space-y-2">
            {sortedPayload.map((entry: any, index: number) => {
              const gap = entry.value - myValue;
              const isMe = entry.dataKey === myUsername;
              return (
                <div key={index} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className={`text-[12px] truncate ${isMe ? "font-black text-primary" : "text-slate-200"}`}>
                      @{entry.dataKey}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[12px] font-mono font-bold text-white">{entry.value.toLocaleString()}</span>
                    {!isMe && (
                      <span className={`text-[10px] font-bold min-w-[40px] text-right ${gap > 0 ? "text-orange-400" : "text-blue-400"}`}>
                        {gap > 0 ? `+${gap}` : gap}
                      </span>
                    )}
                    {isMe && <span className="text-[10px] font-bold text-primary min-w-[40px] text-right">YOU</span>}
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
            <p className="font-semibold text-destructive">Failed to load predictions</p>
            <p className="text-xs text-muted-foreground">The leaderboard data could not be retrieved.</p>
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
              We need at least some all-time solve data to project future growth.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const colors = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#f43f5e"];

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
            Linear projections based on 3-week moving average velocity
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        {challenge && (
          <div className="mb-8 p-4 rounded-xl bg-primary/10 border border-primary/20 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-foreground">Target: Overtake @{challenge.leaderUsername}</h4>
                <p className="text-xs text-muted-foreground">Required effort to become #1 in 8 weeks</p>
              </div>
            </div>
            
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Required Growth</p>
                <p className="text-xl font-black text-primary">+{challenge.neededGrowthRate.toFixed(2)}%</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Target Velocity</p>
                <p className="text-xl font-black text-foreground">{challenge.neededVelocity.toFixed(1)}<span className="text-xs font-normal text-muted-foreground ml-1">/wk</span></p>
              </div>
              <div className="hidden md:block h-10 w-px bg-border" />
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Required Daily</p>
                <p className="text-xl font-black text-emerald-500">
                  {challenge.neededDailyVelocity.toFixed(2)}
                  <span className="text-xs font-normal text-muted-foreground ml-1">/day</span>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="h-100 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={predictionData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis 
                dataKey="week" 
                stroke="#94a3b8" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#94a3b8" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => val.toLocaleString()}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36}/>
              {Object.keys(predictionData[0])
                .filter(key => key !== "week" && visibleUsers.has(key))
                .map((username) => {
                  const allUsernames = Object.keys(predictionData[0]).filter(k => k !== "week");
                  const originalIndex = allUsernames.indexOf(username);
                  return (
                    <Line
                      key={username}
                      type="monotone"
                      dataKey={username}
                      stroke={colors[originalIndex % colors.length]}
                      strokeWidth={username === myUsername ? 4 : 2}
                      dot={username === myUsername ? { r: 6 } : { r: 4 }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  );
                })}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {userStats.length > 0 && (
          <div className="mt-8 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2 px-1">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Velocity & Growth Rate
            </h4>
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
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-bold truncate ${isVisible && stat.username === myUsername ? "text-primary" : "text-foreground"}`}>
                        @{stat.username}
                      </span>
                      {isVisible ? (
                        <Eye className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                      ) : (
                        <EyeOff className="h-3 w-3 text-muted-foreground/30" />
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">Growth</span>
                      <span className={`text-xs font-mono font-bold ${isVisible ? "text-emerald-500" : "text-muted-foreground"}`}>
                        +{stat.growthRate.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">Gap</span>
                      <span className={`text-[10px] font-bold ${stat.gap > 0 ? "text-orange-500" : stat.gap < 0 ? "text-blue-500" : "text-muted-foreground"}`}>
                        {stat.gap === 0 ? "You" : `${stat.gap > 0 ? "+" : ""}${stat.gap}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">Speed</span>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {stat.velocity.toFixed(1)}/wk
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1 pt-1 border-t border-border/20">
                      {stat.username === myUsername ? (
                        <>
                          <span className="text-[9px] text-primary uppercase font-bold">Current Speed</span>
                          <span className="text-[10px] font-bold text-primary">
                            {(stat.velocity / 7).toFixed(2)}/d
                          </span>
                        </>
                      ) : stat.overtakeDate ? (
                        <>
                          <span className="text-[9px] text-blue-400 uppercase font-bold">Overtake By</span>
                          <span className="text-[10px] font-bold text-blue-400">
                            {stat.overtakeDate}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-[9px] text-emerald-500/80 uppercase font-bold">To Beat (15 July)</span>
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

        {overtakingEvents.filter(e => visibleUsers.has(e.user1) && visibleUsers.has(e.user2)).length > 0 && (
          <div className="mt-8 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2 px-1">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Overtaking Alerts
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {overtakingEvents
                .filter(e => visibleUsers.has(e.user1) && visibleUsers.has(e.user2))
                .map((event, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-orange-500/5 border border-orange-500/10 text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        <span className="text-primary">@{event.user1}</span> will overtake <span className="text-blue-400">@{event.user2}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Estimated around {format(addWeeks(new Date(), event.week), "MMMM d, yyyy")}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                        Est. {Math.round(event.total)} solves
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
