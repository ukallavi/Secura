// frontend/app/verification/page.jsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ENDPOINTS, fetchWithCSRF } from '@/lib/api-config';
import { Button, TextField, Typography, Box, Alert, CircularProgress, Paper } from '@mui/material';
import { useAuth } from '@/context/AuthContext';

export default function VerificationPage() {
  const router = useRouter();
  const { user, isAuthenticated, login } = useAuth();
  const [verificationCode, setVerificationCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [verificationRequirements, setVerificationRequirements] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState('email');

  useEffect(() => {
    // If not authenticated or no verification required, redirect to home
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // Check if verification is required from session storage
    const storedRequirements = sessionStorage.getItem('verificationRequirements');
    if (storedRequirements) {
      setVerificationRequirements(JSON.parse(storedRequirements));
    } else {
      // If no verification is required, redirect to home
      router.push('/');
    }
  }, [isAuthenticated, router]);

  // Handle countdown timer for resending code
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendCode = async () => {
    try {
      setError('');
      setSendingCode(true);
      
      const response = await fetchWithCSRF(ENDPOINTS.SEND_VERIFICATION_CODE, {
        method: 'POST',
        body: JSON.stringify({ method: selectedMethod }),
      });

      if (response.success) {
        setSuccessMessage(`Verification code sent to your ${selectedMethod === 'email' ? 'email' : 'device'}`);
        setCountdown(60); // Set 60-second countdown for resend
      } else {
        setError(response.message || 'Failed to send verification code');
      }
    } catch (error) {
      setError('Error sending verification code: ' + (error.message || 'Unknown error'));
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    
    if (!verificationCode.trim()) {
      setError('Please enter the verification code');
      return;
    }

    try {
      setError('');
      setVerifying(true);
      
      const response = await fetchWithCSRF(ENDPOINTS.COMPLETE_VERIFICATION, {
        method: 'POST',
        body: JSON.stringify({ 
          verificationMethod: selectedMethod,
          verificationCode: verificationCode.trim()
        }),
      });

      if (response.success) {
        setSuccessMessage('Verification successful');
        // Clear verification requirements from session storage
        sessionStorage.removeItem('verificationRequirements');
        // Update auth context
        if (response.user) {
          login(response.user);
        }
        // Redirect after a short delay
        setTimeout(() => {
          router.push('/');
        }, 1500);
      } else {
        setError(response.message || 'Verification failed');
      }
    } catch (error) {
      setError('Error verifying code: ' + (error.message || 'Unknown error'));
    } finally {
      setVerifying(false);
    }
  };

  const getMethodLabel = (method) => {
    switch (method) {
      case 'email':
        return 'Email Verification';
      case '2fa':
        return 'Two-Factor Authentication';
      case 'recovery_key':
        return 'Recovery Key';
      default:
        return method;
    }
  };

  if (!verificationRequirements) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4, maxWidth: 500, width: '100%' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Account Verification
        </Typography>
        
        {verificationRequirements.monitoringReason && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Additional verification is required: {verificationRequirements.monitoringReason}
          </Alert>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}

        <Typography variant="body1" sx={{ mb: 3 }}>
          Please verify your identity to continue. This helps us keep your account secure.
        </Typography>

        {verificationRequirements.verificationMethods && verificationRequirements.verificationMethods.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Select verification method:
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {verificationRequirements.verificationMethods.map((method) => (
                <Button
                  key={method}
                  variant={selectedMethod === method ? "contained" : "outlined"}
                  onClick={() => setSelectedMethod(method)}
                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                >
                  {getMethodLabel(method)}
                </Button>
              ))}
            </Box>
          </Box>
        )}

        <Box component="form" onSubmit={handleVerify} sx={{ mt: 2 }}>
          <Button
            variant="outlined"
            color="primary"
            onClick={handleSendCode}
            disabled={sendingCode || countdown > 0}
            fullWidth
            sx={{ mb: 2 }}
          >
            {sendingCode 
              ? <CircularProgress size={24} /> 
              : countdown > 0 
                ? `Resend code in ${countdown}s` 
                : `Send verification code to ${selectedMethod === 'email' ? 'email' : 'device'}`
            }
          </Button>

          <TextField
            label="Verification Code"
            type="text"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            fullWidth
            margin="normal"
            inputProps={{ maxLength: 6 }}
            placeholder="Enter 6-digit code"
          />

          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={verifying || !verificationCode.trim()}
            fullWidth
            sx={{ mt: 2 }}
          >
            {verifying ? <CircularProgress size={24} /> : 'Verify'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}