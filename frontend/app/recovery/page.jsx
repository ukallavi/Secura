'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Key, AlertTriangle } from 'lucide-react';
import { ENDPOINTS, fetchWithCSRF } from '@/lib/api-config';
import { useToast } from '@/hooks/use-toast';

export default function RecoveryPage() {
  const [email, setEmail] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryInitiated, setRecoveryInitiated] = useState(false);
  const [activeTab, setActiveTab] = useState('backup-codes');
  const router = useRouter();
  const { toast } = useToast();

  // Initiate recovery via email
  const initiateEmailRecovery = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!email) {
        throw new Error('Please enter your email address');
      }
      
      const response = await fetchWithCSRF(`${ENDPOINTS.TWO_FACTOR_EMAIL_RECOVERY}/recover`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to initiate recovery');
      }
      
      // Set the masked recovery email if provided
      if (data.recoveryEmail) {
        setRecoveryEmail(data.recoveryEmail);
      }
      
      setRecoveryInitiated(true);
      
      toast({
        title: "Recovery code sent",
        description: "Check your recovery email for the code",
      });
    } catch (err) {
      setError(err.message || 'An error occurred');
      
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || 'Failed to initiate recovery',
      });
    } finally {
      setLoading(false);
    }
  };

  // Verify recovery code
  const verifyEmailRecovery = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!email || !recoveryCode) {
        throw new Error('Email and recovery code are required');
      }
      
      const response = await fetchWithCSRF(`${ENDPOINTS.TWO_FACTOR_EMAIL_RECOVERY}/verify-token`, {
        method: 'POST',
        body: JSON.stringify({ email, token: recoveryCode }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Invalid recovery code');
      }
      
      // Store the encryption key if provided
      if (data.encryptionSalt) {
        localStorage.setItem('encryptionSalt', data.encryptionSalt);
      }
      
      toast({
        title: "Recovery successful",
        description: "You have successfully recovered your account",
      });
      
      // Redirect to main page
      router.push('/main/passwords');
    } catch (err) {
      setError(err.message || 'An error occurred');
      
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || 'Failed to verify recovery code',
      });
    } finally {
      setLoading(false);
    }
  };

  // Verify backup code
  const verifyBackupCode = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!email || !backupCode) {
        throw new Error('Email and backup code are required');
      }
      
      const response = await fetchWithCSRF(`${ENDPOINTS.TWO_FACTOR_BACKUP_CODES}/verify`, {
        method: 'POST',
        body: JSON.stringify({ email, code: backupCode }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Invalid backup code');
      }
      
      // Store the encryption key if provided
      if (data.encryptionSalt) {
        localStorage.setItem('encryptionSalt', data.encryptionSalt);
      }
      
      toast({
        title: "Recovery successful",
        description: "You have successfully recovered your account",
      });
      
      // Redirect to main page
      router.push('/main/passwords');
    } catch (err) {
      setError(err.message || 'An error occurred');
      
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || 'Failed to verify backup code',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Account Recovery</h1>
          <p className="text-sm text-muted-foreground">
            Recover access to your account
          </p>
        </div>
        
        <Tabs defaultValue="backup-codes" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="backup-codes">Backup Codes</TabsTrigger>
            <TabsTrigger value="email-recovery">Email Recovery</TabsTrigger>
          </TabsList>
          
          <TabsContent value="backup-codes">
            <Card>
              <CardHeader>
                <CardTitle>Backup Code Recovery</CardTitle>
                <CardDescription>
                  Use one of your backup codes to recover your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recovery-email">Email</Label>
                  <Input
                    id="recovery-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="backup-code">Backup Code</Label>
                  <Input
                    id="backup-code"
                    placeholder="XXXX-XXXX"
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value)}
                  />
                </div>
                
                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  onClick={verifyBackupCode}
                  disabled={loading || !email || !backupCode}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Key className="mr-2 h-4 w-4" />
                      Recover with Backup Code
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="email-recovery">
            <Card>
              <CardHeader>
                <CardTitle>Email Recovery</CardTitle>
                <CardDescription>
                  Recover your account using your recovery email
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={recoveryInitiated}
                  />
                </div>
                
                {recoveryInitiated && (
                  <>
                    <Alert>
                      <AlertDescription>
                        A recovery code has been sent to {recoveryEmail || "your recovery email"}
                      </AlertDescription>
                    </Alert>
                    
                    <div className="space-y-2">
                      <Label htmlFor="recovery-code">Recovery Code</Label>
                      <Input
                        id="recovery-code"
                        placeholder="Enter recovery code"
                        value={recoveryCode}
                        onChange={(e) => setRecoveryCode(e.target.value)}
                      />
                    </div>
                  </>
                )}
                
                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <CardFooter>
                {recoveryInitiated ? (
                  <div className="flex space-x-2 w-full">
                    <Button
                      variant="outline"
                      onClick={() => setRecoveryInitiated(false)}
                      disabled={loading}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={verifyEmailRecovery}
                      disabled={loading || !recoveryCode}
                      className="flex-1"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        'Verify Code'
                      )}
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    onClick={initiateEmailRecovery}
                    disabled={loading || !email}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Send Recovery Code
                      </>
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
        
        <p className="px-8 text-center text-sm text-muted-foreground">
          Remember your password?{" "}
          <a href="/login" className="underline underline-offset-4 hover:text-primary">
            Back to login
          </a>
        </p>
      </div>
    </div>
  );
}
