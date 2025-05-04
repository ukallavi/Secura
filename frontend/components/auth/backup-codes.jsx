'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Copy, RefreshCw } from 'lucide-react';
import { ENDPOINTS, fetchWithCSRF } from '@/lib/api-config';
import { useToast } from '@/hooks/use-toast';

export function BackupCodesDialog({ twoFactorEnabled = false }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [backupCodes, setBackupCodes] = useState([]);
  const { toast } = useToast();

  // We don't fetch backup codes anymore since they're only available when generated
  // Instead, we'll show a message explaining that the user needs to generate new codes
  const initializeBackupCodes = () => {
    // Don't initialize if 2FA is not enabled
    if (!twoFactorEnabled) {
      setBackupCodes([]);
      return;
    }
    
    // Set initial state - no codes to display
    setBackupCodes([]);
  };

  // Generate new backup codes
  const generateBackupCodes = async () => {
    // Don't generate if 2FA is not enabled
    if (!twoFactorEnabled) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Two-factor authentication must be enabled to generate backup codes",
      });
      return;
    }
    
    try {
      setGenerating(true);
      setError(null);
      setBackupCodes([]); // Clear any existing codes
      
      // fetchWithCSRF already returns the parsed JSON data
      const data = await fetchWithCSRF(`${ENDPOINTS.TWO_FACTOR_BACKUP_CODES}/generate`, {
        method: 'POST'
      });
      
      console.log('Generated backup codes response:', data);
      
      if (data.codes && data.codes.length > 0) {
        // Store the newly generated codes
        setBackupCodes(data.codes);
        
        toast({
          title: "Backup codes generated",
          description: "New backup codes have been generated. Please save them securely as you won't be able to view them again.",
        });
      } else {
        throw new Error('No backup codes were generated');
      }
    } catch (err) {
      console.error('Error generating backup codes:', err);
      
      // If the error is because 2FA is not enabled, show a specific message
      if (err.type === 'VALIDATION_ERROR' && 
          err.message?.includes('Two-factor authentication must be enabled')) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Two-factor authentication must be enabled to generate backup codes",
        });
      } else {
        // Show other errors
        setError(err.message || 'Failed to generate backup codes');
        
        toast({
          variant: "destructive",
          title: "Error",
          description: err.message || 'Failed to generate backup codes',
        });
      }
    } finally {
      setGenerating(false);
    }
  };

  // Copy backup codes to clipboard
  const copyToClipboard = () => {
    const codesText = backupCodes.map(code => code.code).join('\n');
    
    navigator.clipboard.writeText(codesText)
      .then(() => {
        toast({
          title: "Copied to clipboard",
          description: "Your backup codes have been copied to the clipboard.",
        });
      })
      .catch(error => {
        console.error('Error copying to clipboard:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to copy backup codes to clipboard.",
        });
      });
  };

  // Handle dialog open
  const handleOpenChange = (newOpen) => {
    setOpen(newOpen);
    
    // Add debugging for 2FA state
    console.log('BackupCodesDialog - 2FA enabled state:', twoFactorEnabled);
    
    if (newOpen) {
      initializeBackupCodes();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">Manage Backup Codes</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Two-Factor Authentication Backup Codes</DialogTitle>
          <DialogDescription>
            Use these backup codes to sign in if you lose access to your authenticator app.
            Each code can only be used once.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {!twoFactorEnabled ? (
            <Alert>
              <AlertDescription>
                Two-factor authentication must be enabled to generate backup codes
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {loading || generating ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2">{generating ? 'Generating new codes...' : 'Loading...'}</span>
                </div>
              ) : error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : backupCodes.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">
                    Backup codes allow you to sign in if you lose access to your authenticator app.
                  </p>
                  <p className="text-muted-foreground">
                    You haven't generated any backup codes yet, or your previous codes are no longer available.
                  </p>
                  <p className="text-muted-foreground mt-2">
                    Click the "Generate New" button below to create backup codes.
                  </p>
                  <div className="mt-4">
                    <Button 
                      onClick={generateBackupCodes} 
                      disabled={generating}
                      className="w-full"
                    >
                      {generating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>Generate New Backup Codes</>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Alert className="mb-4">
                    <AlertDescription>
                      <strong>Important:</strong> Save these backup codes immediately. You won't be able to see them again.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="bg-muted p-4 rounded-md font-mono text-sm mb-4">
                    <div className="grid grid-cols-2 gap-2">
                      {backupCodes.map((code, index) => (
                        <div key={index} className="p-2 rounded">
                          {code.code}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyToClipboard}
                      className="flex-1"
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy to Clipboard
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const codesText = backupCodes.map(code => code.code).join('\n');
                        const blob = new Blob([codesText], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'secura-backup-codes.txt';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        
                        toast({
                          title: "Backup codes downloaded",
                          description: "Your backup codes have been downloaded as a text file.",
                        });
                      }}
                      className="flex-1"
                    >
                      Download as Text
                    </Button>
                  </div>
                </>
              )}
              
              <div className="text-sm text-muted-foreground border-t pt-4">
                <p>Keep these codes in a safe place. Each code can only be used once.</p>
                <p className="mt-1">Generating new codes will invalidate all existing codes.</p>
              </div>
            </>
          )}
        </div>
        
        <DialogFooter className="flex justify-between items-center">
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              disabled={!twoFactorEnabled || loading || generating || backupCodes.length === 0}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={generateBackupCodes}
              disabled={!twoFactorEnabled || loading || generating}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Generate New
                </>
              )}
            </Button>
          </div>
          <Button variant="default" onClick={() => setOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
