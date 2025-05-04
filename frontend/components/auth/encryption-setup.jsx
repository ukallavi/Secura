'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Key, Lock, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deriveEncryptionKey, storeEncryptionKey } from '@/lib/encryption';

/**
 * Component to set up encryption during login
 * This handles deriving the encryption key from the master password and salt
 */
export default function EncryptionSetup({ masterPassword, encryptionSalt, onComplete }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    const setupEncryption = async () => {
      if (!masterPassword || !encryptionSalt) {
        setError('Missing master password or encryption salt');
        return;
      }

      setLoading(true);
      try {
        // Derive the encryption key from the master password and salt
        const encryptionKey = await deriveEncryptionKey(masterPassword, encryptionSalt);
        
        // Store the encryption key in memory for the session
        storeEncryptionKey(encryptionKey);
        
        toast({
          title: 'Encryption initialized',
          description: 'Your passwords are now protected with end-to-end encryption.',
        });
        
        // Notify parent component that setup is complete
        if (onComplete) {
          onComplete(true);
        }
      } catch (error) {
        console.error('Error setting up encryption:', error);
        setError('Failed to initialize encryption. Please try again.');
        
        toast({
          variant: 'destructive',
          title: 'Encryption Error',
          description: 'Could not set up encryption. Your passwords may not be secure.',
        });
        
        // Notify parent component that setup failed
        if (onComplete) {
          onComplete(false);
        }
      } finally {
        setLoading(false);
      }
    };
    
    setupEncryption();
  }, [masterPassword, encryptionSalt, onComplete, toast]);

  if (loading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="mr-2 h-5 w-5" />
            Setting Up Encryption
          </CardTitle>
          <CardDescription>
            Initializing your secure encryption key
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-6">
          <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
          <p className="text-center text-sm text-muted-foreground">
            Please wait while we set up encryption for your passwords.
            This ensures your data remains private and secure.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center">
            <Lock className="mr-2 h-5 w-5" />
            Encryption Setup Failed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <p className="mt-4 text-sm text-muted-foreground">
            Please try logging in again to set up encryption properly.
            Without encryption, your passwords may not be secure.
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return null; // No UI needed when successful
}
