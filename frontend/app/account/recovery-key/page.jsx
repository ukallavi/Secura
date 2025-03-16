'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/authContext';
import { ENDPOINTS, fetchWithAuth } from '@/lib/api-config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Check, Copy, AlertTriangle, Shield } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import AccountLayout from '@/components/account/AccountLayout';

export default function RecoveryKeyPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hasRecoveryKey, setHasRecoveryKey] = useState(false);
  const [recoveryKeyCreatedAt, setRecoveryKeyCreatedAt] = useState(null);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [password, setPassword] = useState('');
  const [passwordForDeletion, setPasswordForDeletion] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showRecoveryKey, setShowRecoveryKey] = useState(false);

  useEffect(() => {
    fetchRecoveryKeyStatus();
  }, []);

  const fetchRecoveryKeyStatus = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth(ENDPOINTS.RECOVERY_KEY_STATUS);
      
      if (response.ok) {
        const data = await response.json();
        setHasRecoveryKey(data.hasRecoveryKey);
        setRecoveryKeyCreatedAt(data.createdAt);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch recovery key status",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetupRecoveryKey = async (e) => {
    e.preventDefault();
    
    if (!password) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter your password",
      });
      return;
    }
    
    try {
      setGenerating(true);
      const response = await fetchWithAuth(ENDPOINTS.SETUP_RECOVERY_KEY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate recovery key');
      }
      
      const data = await response.json();
      setRecoveryKey(data.recoveryKey);
      setShowRecoveryKey(true);
      setHasRecoveryKey(true);
      setRecoveryKeyCreatedAt(new Date().toISOString());
      setShowSetupDialog(false);
      
      toast({
        title: "Recovery Key Generated",
        description: "Your recovery key has been generated successfully.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to generate recovery key",
      });
    } finally {
      setPassword('');
      setGenerating(false);
    }
  };
  
  const handleDeleteRecoveryKey = async (e) => {
    e.preventDefault();
    
    if (!passwordForDeletion) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter your password",
      });
      return;
    }
    
    try {
      setDeleting(true);
      const response = await fetchWithAuth(ENDPOINTS.DELETE_RECOVERY_KEY, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: passwordForDeletion }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete recovery key');
      }
      
      setHasRecoveryKey(false);
      setRecoveryKeyCreatedAt(null);
      setShowDeleteDialog(false);
      
      toast({
        title: "Recovery Key Deleted",
        description: "Your recovery key has been deleted successfully.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete recovery key",
      });
    } finally {
      setPasswordForDeletion('');
      setDeleting(false);
    }
  };
  
  const handleCopyRecoveryKey = () => {
    navigator.clipboard.writeText(recoveryKey);
    toast({
      title: "Recovery Key Copied",
      description: "Your recovery key has been copied to clipboard.",
    });
  };
  
  const handleDoneViewing = () => {
    setShowRecoveryKey(false);
    setRecoveryKey('');
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
  };

  return (
    <AccountLayout
      title="Account Recovery"
      description="Manage your account recovery options"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Account Recovery Key
          </CardTitle>
          <CardDescription>
            A recovery key allows you to regain access to your account if you lose access to your email or two-factor authentication.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-4">Loading...</div>
          ) : hasRecoveryKey ? (
            <div>
              <Alert variant="default" className="mb-4 bg-green-50 text-green-800 border-green-200">
                <Check className="h-4 w-4" />
                <AlertTitle>Recovery Key Set Up</AlertTitle>
                <AlertDescription>
                  You have a recovery key set up for your account. Keep it in a safe place.
                  {recoveryKeyCreatedAt && (
                    <div className="text-sm mt-1">
                      Created on: {formatDate(recoveryKeyCreatedAt)}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
              <p className="text-sm text-gray-500 mb-4">
                If you lose your recovery key, you can delete it and create a new one. 
                Your recovery key is stored securely and is not accessible to anyone, including our support team.
              </p>
            </div>
          ) : (
            <div>
              <Alert variant="default" className="mb-4 bg-amber-50 text-amber-800 border-amber-200">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No Recovery Key</AlertTitle>
                <AlertDescription>
                  You don't have a recovery key set up. Setting up a recovery key is recommended for account security.
                </AlertDescription>
              </Alert>
              <p className="text-sm text-gray-500 mb-4">
                A recovery key provides an additional way to recover your account if you lose access to your email or two-factor authentication.
                The key is only shown once when created, so make sure to store it in a secure location.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end gap-4">
          {hasRecoveryKey ? (
            <Button 
              variant="destructive" 
              onClick={() => setShowDeleteDialog(true)}
            >
              Delete Recovery Key
            </Button>
          ) : (
            <Button 
              onClick={() => setShowSetupDialog(true)}
            >
              Set Up Recovery Key
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Setup Recovery Key Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Up Recovery Key</DialogTitle>
            <DialogDescription>
              Enter your password to generate a recovery key. This key will be shown only once, so make sure to save it in a secure location.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSetupRecoveryKey}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowSetupDialog(false)}
                disabled={generating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={generating}>
                {generating ? 'Generating...' : 'Generate Recovery Key'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Recovery Key Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Recovery Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete your recovery key? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDeleteRecoveryKey}>
            <div className="grid gap-4 py-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>
                  Deleting your recovery key will remove this recovery option from your account.
                </AlertDescription>
              </Alert>
              <div className="grid gap-2">
                <Label htmlFor="passwordForDeletion">Confirm Password</Label>
                <Input
                  id="passwordForDeletion"
                  type="password"
                  value={passwordForDeletion}
                  onChange={(e) => setPasswordForDeletion(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                variant="destructive" 
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Recovery Key'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Show Recovery Key Dialog */}
      {showRecoveryKey && (
        <Dialog open={showRecoveryKey} onOpenChange={setShowRecoveryKey}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Your Recovery Key</DialogTitle>
              <DialogDescription>
                This is your recovery key. It will be shown only once. Copy it and store it in a secure location.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Alert variant="default" className="bg-amber-50 text-amber-800 border-amber-200">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Important</AlertTitle>
                <AlertDescription>
                  This key will only be shown once. If you lose it, you'll need to generate a new one.
                </AlertDescription>
              </Alert>
              <div className="grid gap-2">
                <Label>Recovery Key</Label>
                <div className="relative">
                  <Input
                    value={recoveryKey}
                    readOnly
                    className="pr-10 font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-7 w-7"
                    onClick={handleCopyRecoveryKey}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={handleDoneViewing}>
                I've Saved My Recovery Key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AccountLayout>
  );
}