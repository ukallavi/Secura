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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Check } from 'lucide-react';
import { ENDPOINTS } from '@/lib/api-config';
import { fetchWithCSRF } from '@/lib/fetchWithCSRF';
import { useToast } from '@/hooks/use-toast';

export function EmailRecoveryDialog({ recoveryEmail, onChange }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState(recoveryEmail || '');
  const [verificationCode, setVerificationCode] = useState('');
  const [verified, setVerified] = useState(!!recoveryEmail);
  const [codeSent, setCodeSent] = useState(false);
  const { toast } = useToast();

  // Update email state when prop changes
  if (recoveryEmail !== email && recoveryEmail) {
    setEmail(recoveryEmail);
    setVerified(!!recoveryEmail);
  }

  // Send verification code to email
  const sendVerificationCode = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Validate email
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Please enter a valid email address');
      }
      
      const response = await fetchWithCSRF(`${ENDPOINTS.TWO_FACTOR_EMAIL_RECOVERY}/send-code`, {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      
      if (!response.ok) {
        throw new Error('Failed to send verification code');
      }
      
      setCodeSent(true);
      
      toast({
        title: "Verification code sent",
        description: "Check your email for the verification code",
      });
    } catch (err) {
      setError(err.message || 'Failed to send verification code');
      
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || 'Failed to send verification code',
      });
    } finally {
      setLoading(false);
    }
  };

  // Verify the code
  const verifyCode = async () => {
    try {
      setVerifying(true);
      setError(null);
      
      if (!verificationCode) {
        throw new Error('Please enter the verification code');
      }
      
      const response = await fetchWithCSRF(`${ENDPOINTS.TWO_FACTOR_EMAIL_RECOVERY}/verify-code`, {
        method: 'POST',
        body: JSON.stringify({ email, code: verificationCode })
      });
      
      if (!response.ok) {
        throw new Error('Invalid verification code');
      }
      
      setVerified(true);
      setCodeSent(false);
      setVerificationCode('');
      
      // Call the onChange prop to update the parent component
      if (onChange) {
        onChange(email);
      }
      
      toast({
        title: "Email verified",
        description: "Your recovery email has been verified and saved",
      });
      
      // Close the dialog after successful verification
      setTimeout(() => setOpen(false), 1500);
    } catch (err) {
      setError(err.message || 'Failed to verify code');
      
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || 'Failed to verify code',
      });
    } finally {
      setVerifying(false);
    }
  };

  // Handle dialog open
  const handleOpenChange = (newOpen) => {
    setOpen(newOpen);
    
    if (!newOpen) {
      // Reset state when dialog closes
      setError(null);
      setCodeSent(false);
      setVerificationCode('');
      
      // Reset email to the original value if not verified
      if (!verified) {
        setEmail(recoveryEmail || '');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          {verified ? 'Change Recovery Email' : 'Setup Recovery Email'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Recovery Email</DialogTitle>
          <DialogDescription>
            Set up an email address to recover your account if you lose access to your authenticator app.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {verified && !codeSent ? (
            <div className="space-y-4">
              <Alert className="bg-green-50 border-green-200">
                <Check className="h-4 w-4 text-green-500 mr-2" />
                <AlertDescription>
                  Recovery email {email} has been verified
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label htmlFor="new-email">Change recovery email</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter a new recovery email"
                />
              </div>
            </div>
          ) : codeSent ? (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  A verification code has been sent to {email}
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label htmlFor="verification-code">Verification Code</Label>
                <Input
                  id="verification-code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter the 6-digit code"
                  maxLength={6}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="recovery-email">Recovery Email</Label>
              <Input
                id="recovery-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your recovery email"
              />
            </div>
          )}
          
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        
        <DialogFooter>
          {codeSent ? (
            <div className="flex space-x-2 w-full">
              <Button
                variant="outline"
                onClick={() => setCodeSent(false)}
                disabled={loading || verifying}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={verifyCode}
                disabled={verifying || !verificationCode}
                className="flex-1"
              >
                {verifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify Code'
                )}
              </Button>
            </div>
          ) : verified ? (
            <div className="flex space-x-2 w-full">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={sendVerificationCode}
                disabled={loading || !email || email === recoveryEmail}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Verification Code'
                )}
              </Button>
            </div>
          ) : (
            <Button
              onClick={sendVerificationCode}
              disabled={loading || !email}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Verification Code
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
