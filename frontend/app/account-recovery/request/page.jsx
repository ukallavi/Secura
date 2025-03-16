'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ENDPOINTS, fetchWithCSRF } from '@/lib/api-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Shield, Mail } from 'lucide-react';
import { validateEmail } from '@/lib/validation';

export default function RequestRecoveryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  const validateForm = () => {
    if (!validateEmail(email)) {
      toast({
        variant: "destructive",
        title: "Invalid Email",
        description: "Please enter a valid email address",
      });
      return false;
    }
    
    return true;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setSubmitting(true);
      const response = await fetchWithCSRF(ENDPOINTS.INITIATE_RECOVERY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to request account recovery');
      }
      
      setSubmitted(true);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to request account recovery",
      });
    } finally {
      setSubmitting(false);
    }
  };
  
  if (submitted) {
    return (
      <div className="container max-w-md mx-auto mt-16 px-4">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 bg-primary/10 p-2 rounded-full w-12 h-12 flex items-center justify-center">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Check Your Email</CardTitle>
            <CardDescription>
              If an account exists with that email, we've sent instructions to recover your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Check your inbox for an email from us with instructions on how to recover your account.
            </p>
            <p className="text-sm text-muted-foreground">
              If you don't receive an email within a few minutes, check your spam folder or try again.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => router.push('/login')}
            >
              Return to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container max-w-md mx-auto mt-16 px-4">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 bg-primary/10 p-2 rounded-full w-12 h-12 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Account Recovery</CardTitle>
          <CardDescription>
            Enter your email to recover access to your account
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                autoComplete="email"
              />
              <p className="text-xs text-muted-foreground">
                We'll send you instructions on how to recover your account
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button 
              type="submit" 
              className="w-full"
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Send Recovery Instructions'}
            </Button>
            <Button 
              type="button"
              variant="ghost" 
              className="w-full flex items-center gap-2"
              onClick={() => router.push('/login')}
            >
              <ArrowLeft className="h-4 w-4" /> Back to Login
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}