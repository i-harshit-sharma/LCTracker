import { useGetPreferences, useGetProfileHeatmap, useGetLeaderboard, getGetProfileHeatmapQueryKey, getGetLeaderboardQueryKey } from "@workspace/api-client-react";
import { Navbar } from "@/components/Navbar";
import { ContributionCity } from "@/components/ContributionCity";
import { CommunityCity } from "@/components/CommunityCity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Info, User, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

export default function SkylinePage() {
  const [activeTab, setActiveTab] = useState("personal");
  const { data: prefs, isLoading: isLoadingPrefs } = useGetPreferences();
  const username = prefs?.leetcodeUsername;

  const { data: heatmapData, isLoading: isLoadingHeatmap } = useGetProfileHeatmap(username!, {
    query: {
      enabled: !!username && activeTab === "personal",
      queryKey: getGetProfileHeatmapQueryKey(username!),
    },
  });

  const { data: leaderboard, isLoading: isLoadingLeaderboard } = useGetLeaderboard({ 
    scope: "global", 
    period: "all" 
  }, {
    query: {
      enabled: activeTab === "community",
      queryKey: getGetLeaderboardQueryKey({ scope: "global", period: "all" }),
    }
  });

  const isLoading = activeTab === "personal" 
    ? (isLoadingPrefs || (username && isLoadingHeatmap))
    : isLoadingLeaderboard;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Skyline Visualizer</h1>
              <p className="text-muted-foreground mt-1">
                3D architectural representations of LeetCode progress.
              </p>
            </div>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="personal" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Your Skyline
                </TabsTrigger>
                <TabsTrigger value="community" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Community
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Tabs value={activeTab} className="w-full">
            <TabsContent value="personal" className="mt-0 border-none p-0">
              {!username && !isLoadingPrefs ? (
                <Alert variant="destructive">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Not Connected</AlertTitle>
                  <AlertDescription>
                    Please connect your LeetCode account in the dashboard to view your skyline.
                  </AlertDescription>
                </Alert>
              ) : isLoading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary opacity-50" />
                  <p className="text-sm text-muted-foreground animate-pulse">Constructing your city...</p>
                </div>
              ) : (
                <Card className="border-none bg-transparent shadow-none">
                  <CardContent className="p-0">
                    <ContributionCity data={Array.isArray(heatmapData) ? heatmapData : []} />
                    
                    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Personal Journey</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          Watch your personal growth over the last 365 days. Each building's height represents your daily dedication.
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Dynamic Environment</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          The city is alive with breathing animations and interactive controls. Explore your progress from any angle.
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Color Legend</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          Brighter buildings indicate higher solve counts. Maintain your streak to see your skyline glow.
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="community" className="mt-0 border-none p-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary opacity-50" />
                  <p className="text-sm text-muted-foreground animate-pulse">Gathering the community...</p>
                </div>
              ) : (
                <Card className="border-none bg-transparent shadow-none">
                  <CardContent className="p-0">
                    <CommunityCity data={Array.isArray(leaderboard) ? leaderboard : []} />
                    
                    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Global Leaderboard</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          See the top performers of all time. Each skyscraper represents a developer's total solves in the community.
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Detailed Insights</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          Hover over any building to see the user's name, avatar, and exact problem count for the period.
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Top Performers</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          Gold, Silver, and Bronze colors highlight the current leaders. Can you make it to the top three?
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
