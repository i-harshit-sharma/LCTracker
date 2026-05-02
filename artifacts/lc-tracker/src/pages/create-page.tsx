import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Download, ShieldCheck, FileJson, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";

export default function CreatePage() {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [uploadStats, setUploadStats] = useState<{ added: string[]; alreadyFollowing: string[]; notFound: string[] } | null>(null);

  const handleUnlock = () => {
    if (password.trim().length > 0) {
      setIsUnlocked(true);
      toast({
        title: "Session Unlocked",
        description: "You can now perform bulk actions.",
      });
    }
  };

  const onFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStats(null);

    try {
      const text = await file.text();
      const usernames = JSON.parse(text);

      if (!Array.isArray(usernames)) {
        throw new Error("Invalid format: JSON must be an array of strings.");
      }

      const response = await customFetch<{ added: string[]; alreadyFollowing: string[]; notFound: string[] }>("/api/admin/bulk-follow", {
        method: "POST",
        headers: { 
          "X-Admin-Password": password,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ usernames }),
      });

      setUploadStats(response);
      toast({
        title: "Import Complete",
        description: `Successfully added ${response.added.length} users.`,
      });
    } catch (err: any) {
      toast({
        title: "Upload Failed",
        description: err.data?.error || err.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Clear file input
      event.target.value = "";
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await customFetch<string[]>("/api/admin/export-follows", {
        method: "GET",
        headers: { "X-Admin-Password": password }
      });

      const blob = new Blob([JSON.stringify(response, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "followed_users.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Your users list has been downloaded.",
      });
    } catch (err: any) {
      toast({
        title: "Download Failed",
        description: err.data?.error || "Could not fetch users list.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Bulk Management</h1>
            <p className="text-muted-foreground">Import and export your LeetCode tracking list via JSON.</p>
          </div>

          {!isUnlocked ? (
            <Card className="max-w-md mx-auto border-primary/20 bg-primary/5 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Admin Authentication
                </CardTitle>
                <CardDescription>Enter the admin password to access bulk tools.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                  />
                </div>
                <Button onClick={handleUnlock} className="w-full glow-orange">
                  Unlock Tools
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Import Card */}
              <Card className="border-border bg-card/50 backdrop-blur-sm overflow-hidden">
                <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-transparent pointer-events-none" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-primary" />
                    Import Users
                  </CardTitle>
                  <CardDescription>Upload a JSON array of LeetCode usernames.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="group relative border-2 border-dashed border-border rounded-xl p-8 transition-colors hover:border-primary/50 text-center">
                    <input
                      type="file"
                      accept=".json"
                      onChange={onFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      disabled={isUploading}
                    />
                    <div className="space-y-4">
                      <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        {isUploading ? (
                          <Loader2 className="h-6 w-6 text-primary animate-spin" />
                        ) : (
                          <FileJson className="h-6 w-6 text-primary" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Click to upload or drag and drop</p>
                        <p className="text-xs text-muted-foreground">JSON files only (Array of strings)</p>
                      </div>
                    </div>
                  </div>

                  {uploadStats && (
                    <div className="space-y-3 p-4 rounded-lg bg-muted/30 text-xs">
                      <div className="flex items-center justify-between text-green-500">
                        <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Added:</span>
                        <span className="font-mono">{uploadStats.added.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> Already Following:</span>
                        <span className="font-mono">{uploadStats.alreadyFollowing.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-destructive">
                        <span className="flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> Not Found:</span>
                        <span className="font-mono">{uploadStats.notFound.length}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Export Card */}
              <Card className="border-border bg-card/50 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-linear-to-tr from-primary/5 to-transparent pointer-events-none" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-primary" />
                    Export Users
                  </CardTitle>
                  <CardDescription>Download your entire followed users list.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8 py-12 flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Download className="h-8 w-8 text-primary" />
                  </div>
                  <div className="text-center max-w-50">
                    <p className="text-sm font-medium mb-1">Backup your follows</p>
                    <p className="text-xs text-muted-foreground">Get a JSON file containing all usernames you track.</p>
                  </div>
                  <Button 
                    onClick={handleDownload} 
                    disabled={isDownloading}
                    className="w-full glow-orange"
                  >
                    {isDownloading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Download JSON
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {isUnlocked && (
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" onClick={() => { setIsUnlocked(false); setPassword(""); }} className="text-muted-foreground">
                Lock Session
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
