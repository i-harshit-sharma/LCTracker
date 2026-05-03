import { useState } from "react";
import { useGetPreferences, useUpdatePreferences, useVerifyLeetcodeUsername } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Copy, ExternalLink, Loader2, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function VerificationPage() {
  const { data: prefs, isLoading, refetch } = useGetPreferences();
  const updatePrefs = useUpdatePreferences();
  const verify = useVerifyLeetcodeUsername();
  const { toast } = useToast();
  const [username, setUsername] = useState("");

  const handleUpdateUsername = async () => {
    if (!username.trim()) return;
    try {
      await updatePrefs.mutateAsync({ 
        data: { leetcodeUsername: username.trim() } as any 
      });
      toast({ title: "Username updated", description: "Now please verify your account." });
      refetch();
    } catch (err: any) {
      toast({ 
        variant: "destructive", 
        title: "Update failed", 
        description: err.response?.data?.error || "Could not update username" 
      });
    }
  };

  const handleVerify = async () => {
    try {
      await verify.mutateAsync();
      toast({ 
        title: "Verification successful!", 
        description: "Your account has been verified." 
      });
      refetch();
    } catch (err: any) {
      toast({ 
        variant: "destructive", 
        title: "Verification failed", 
        description: err.response?.data?.error || "Could not verify account. Please check the token." 
      });
    }
  };

  const copyToken = () => {
    if (prefs?.verificationToken) {
      navigator.clipboard.writeText(prefs.verificationToken);
      toast({ title: "Copied", description: "Verification string copied to clipboard." });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Step 1: Add Username
  if (!prefs?.leetcodeUsername) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md border-border/40 shadow-2xl bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-bold tracking-tight">Welcome to LeetCode Sync Hub</CardTitle>
            <CardDescription className="text-muted-foreground">
              To get started, please enter your LeetCode username.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">LeetCode Username</Label>
              <Input
                id="username"
                placeholder="e.g. bobby_leetcode"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-background/50"
              />
            </div>
            <Alert variant="default" className="bg-primary/5 border-primary/20 text-primary-foreground/90">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-primary font-semibold">Public Profile Required</AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground">
                Your LeetCode profile must be public so we can verify ownership and track your progress.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full font-semibold shadow-lg shadow-primary/20" 
              onClick={handleUpdateUsername}
              disabled={updatePrefs.isPending || !username.trim()}
            >
              {updatePrefs.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Username
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Step 2: Verify Ownership
  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-lg border-border/40 shadow-2xl bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Lock className="w-6 h-6 text-primary" />
            Verify Your Account
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Prove ownership of <strong>{prefs.leetcodeUsername}</strong> by adding a verification string to your profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 space-y-3">
              <Label className="text-sm font-medium text-primary uppercase tracking-wider">Verification String</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-background/80 px-4 py-3 rounded-lg border font-mono text-sm break-all shadow-inner select-all">
                  {prefs.verificationToken}
                </code>
                <Button variant="outline" size="icon" onClick={copyToken} className="shrink-0 hover:bg-primary/10">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-4 text-sm">
              <h4 className="font-semibold flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">1</div>
                How to verify:
              </h4>
              <ul className="space-y-3 pl-7 list-disc text-muted-foreground">
                <li>
                  Go to your{" "}
                  <a 
                    href={`https://leetcode.com/${prefs.leetcodeUsername}/`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    LeetCode Profile <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>Edit your <strong>"About"</strong> or <strong>"Bio"</strong> section.</li>
                <li>Paste the verification string shown above into your bio.</li>
                <li>Save your profile changes on LeetCode.</li>
                <li>Click the <strong>"Verify My Account"</strong> button below.</li>
              </ul>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button 
            className="w-full text-lg font-bold h-12 shadow-xl shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]" 
            onClick={handleVerify}
            disabled={verify.isPending}
          >
            {verify.isPending ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-5 w-5" />
            )}
            Verify My Account
          </Button>
          <Button 
            variant="ghost" 
            className="w-full text-muted-foreground hover:text-foreground"
            onClick={() => {
              updatePrefs.mutate({ data: { leetcodeUsername: null } as any });
              setUsername("");
            }}
          >
            Change Username
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
