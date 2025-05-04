// frontend/lib/auth.js
import { useRouter } from 'next/navigation';
import { ENDPOINTS } from './api-config';
import { fetchWithCSRF } from './api-client';
import { useToast } from '@/hooks/use-toast';
import { deriveEncryptionKey, storeEncryptionKey } from './encryption';

// Authentication context to be used with React Context API
export const useAuth = () => {
  const router = useRouter();
  const { toast } = useToast();

  const login = async (credentials) => {
    try {
      // First, fetch the auth salt for the user
      const saltResponse = await fetchWithCSRF(`${ENDPOINTS.AUTH_SALT}?email=${encodeURIComponent(credentials.email)}`);
      
      if (!saltResponse.authSalt) {
        throw new Error('Could not retrieve authentication information');
      }
      
      // Hash the password with the auth salt
      const crypto = await import('crypto-js');
      const hashedPassword = crypto.PBKDF2(
        credentials.password,
        saltResponse.authSalt,
        { keySize: 512/32, iterations: 10000 }
      ).toString(crypto.enc.Hex); // Make sure to convert to hex string
      
      console.log('Sending login request with hashed password');
      
      // Use fetchWithCSRF from api-client.js which already handles JSON parsing
      const data = await fetchWithCSRF(ENDPOINTS.LOGIN, {
        method: 'POST',
        body: JSON.stringify({
          email: credentials.email,
          password: hashedPassword
        })
      });
      
      // Check if 2FA is required
      if (data.requireTwoFactor) {
        return {
          success: true,
          requireTwoFactor: true,
          userId: data.userId,
          encryptionSalt: data.encryptionSalt // Store the salt for 2FA verification
        };
      }
      
      // Setup encryption with the master password and salt
      if (data.encryptionSalt) {
        try {
          // Derive the encryption key from the master password and salt
          const encryptionKey = await deriveEncryptionKey(credentials.password, data.encryptionSalt);
          
          // Store the encryption key in memory for the session
          storeEncryptionKey(encryptionKey);
          
          toast({
            title: 'Encryption initialized',
            description: 'Your passwords are now protected with end-to-end encryption.',
          });
        } catch (encryptionError) {
          console.error('Error setting up encryption:', encryptionError);
          toast({
            variant: 'destructive',
            title: 'Encryption Error',
            description: 'Could not set up encryption. Your passwords may not be secure.',
          });
        }
      }
      
      // No localStorage, cookie is set by the server
      router.push('/main/passwords');
      return { success: true, message: data.message };
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message || "Please check your credentials and try again.",
      });
      return { error: error.message };
    }
  };

  const logout = async () => {
    try {
      await fetchWithCSRF(ENDPOINTS.LOGOUT, {
        method: 'POST'
      });
      
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      router.push('/login');
    }
  };

  const checkAuth = async () => {
    try {
      const data = await fetchWithCSRF(ENDPOINTS.PROFILE);
      return data.success === true;
    } catch (error) {
      return false;
    }
  };

  return { login, logout, checkAuth };
};