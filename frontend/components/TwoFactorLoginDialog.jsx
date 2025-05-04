"use client"

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert
} from '@mui/material';
import axios from 'axios';
import { deriveEncryptionKey, storeEncryptionKey } from '@/lib/encryption';

const TwoFactorLoginDialog = ({ open, userId, onSuccess, onCancel, encryptionSalt, masterPassword }) => {
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRecoveryCode, setIsRecoveryCode] = useState(false);
  
  const handleSubmit = async () => {
    if (!verificationCode) {
      setError('Please enter a verification code');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post('/api/auth/2fa/login', {
        userId,
        token: verificationCode
      });
      
      // Setup encryption with the master password and salt if available
      if (encryptionSalt && masterPassword) {
        try {
          // Derive the encryption key from the master password and salt
          const encryptionKey = await deriveEncryptionKey(masterPassword, encryptionSalt);
          
          // Store the encryption key in memory for the session
          storeEncryptionKey(encryptionKey);
          
          console.log('Encryption initialized after 2FA verification');
        } catch (encryptionError) {
          console.error('Error setting up encryption after 2FA:', encryptionError);
          // Continue with login even if encryption setup fails
          // The user will be prompted to set up encryption again later
        }
      }
      
      onSuccess();
    } catch (error) {
      console.error('2FA verification error:', error);
      setError(error.response?.data?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };
  
  const toggleCodeType = () => {
    setIsRecoveryCode(!isRecoveryCode);
    setVerificationCode('');
    setError('');
  };
  
  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle>Two-Factor Authentication Required</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        <Typography variant="body1" paragraph>
          {isRecoveryCode 
            ? 'Enter one of your recovery codes to sign in.' 
            : 'Enter the verification code from your authenticator app.'}
        </Typography>
        
        <TextField
          fullWidth
          label={isRecoveryCode ? "Recovery Code" : "Verification Code"}
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value)}
          margin="normal"
          placeholder={isRecoveryCode ? "XXXX-XXXX-XXXX-XXXX-XXXX" : "123456"}
          inputProps={{ 
            maxLength: isRecoveryCode ? 24 : 6,
            style: { letterSpacing: isRecoveryCode ? 1 : 'normal' }
          }}
        />
        
        <Box sx={{ mt: 2 }}>
          <Button 
            color="secondary" 
            size="small" 
            onClick={toggleCodeType}
          >
            {isRecoveryCode 
              ? "Use verification code instead" 
              : "Use recovery code instead"}
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          color="primary" 
          variant="contained" 
          disabled={loading || !verificationCode}
        >
          {loading ? <CircularProgress size={24} /> : 'Verify'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TwoFactorLoginDialog;