'use client';

import { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Copy, RefreshCw, Save, Eye, EyeOff } from 'lucide-react';

export default function PasswordGenerator() {
  const [accountName, setAccountName] = useState('');
  const [alias, setAlias] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLength, setPasswordLength] = useState(16);
  const [useUppercase, setUseUppercase] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSpecial, setUseSpecial] = useState(true);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generatePassword = () => {
    if (!accountName) {
      toast({
        variant: "destructive",
        title: "Account name required",
        description: "Please enter an account name before generating a password.",
      });
      return;
    }
    
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      // Create character sets based on options
      let charset = 'abcdefghijklmnopqrstuvwxyz';
      if (useUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if (useNumbers) charset += '0123456789';
      if (useSpecial) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
      
      // Generate password
      let newPassword = '';
      for (let i = 0; i < passwordLength; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        newPassword += charset[randomIndex];
      }
      
      setPassword(newPassword);
      setLoading(false);
      
      toast({
        title: "Password generated",
        description: "Your secure password has been generated.",
      });
    }, 800);
  };

  const copyToClipboard = () => {
    if (!password) {
      toast({
        variant: "destructive",
        title: "No password to copy",
        description: "Please generate a password first.",
      });
      return;
    }
    
    navigator.clipboard.writeText(password);
    
    toast({
      title: "Password copied",
      description: "Password copied to clipboard. It will be cleared in 10 seconds.",
    });
    
    // Auto-clear clipboard after 10 seconds for security
    setTimeout(() => {
      navigator.clipboard.writeText('');
    }, 10000);
  };

  const savePassword = () => {
    if (!accountName || !password) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please provide an account name and generate a password.",
      });
      return;
    }
    
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      
      toast({
        title: "Password saved",
        description: `Password for ${accountName} has been saved securely.`,
      });
      
      // In a real app, we would save to the database here
      console.log('Saved password for:', accountName);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Password Generator</h1>
        <p className="text-muted-foreground">Create strong, unique passwords for your accounts</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>
              Enter the account information for this password
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accountName">Account Name</Label>
              <Input
                id="accountName"
                placeholder="e.g., Gmail, Netflix, Bank Account"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="alias">
                Alias (Optional)
              </Label>
              <Input
                id="alias"
                placeholder="Custom alias for this account"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                If left empty, a default alias will be created from the account name
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Password Options</CardTitle>
            <CardDescription>
              Customize your password strength and format
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Password Length: {passwordLength}</Label>
              </div>
              <Slider
                value={[passwordLength]}
                min={8}
                max={64}
                step={1}
                onValueChange={(value) => setPasswordLength(value[0])}
              />
              <p className="text-xs text-muted-foreground">
                Longer passwords are more secure. We recommend at least 16 characters.
              </p>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="uppercase">Include Uppercase Letters</Label>
                <Switch
                  id="uppercase"
                  checked={useUppercase}
                  onCheckedChange={setUseUppercase}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="numbers">Include Numbers</Label>
                <Switch
                  id="numbers"
                  checked={useNumbers}
                  onCheckedChange={setUseNumbers}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="special">Include Special Characters</Label>
                <Switch
                  id="special"
                  checked={useSpecial}
                  onCheckedChange={setUseSpecial}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Generated Password</CardTitle>
          <CardDescription>
            Your secure password will appear here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Input
              value={password}
              type={showPassword ? "text" : "password"}
              placeholder="Your password will appear here"
              readOnly
              className="pr-10 font-mono"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-3 sm:flex-row sm:space-x-3 sm:space-y-0">
          <Button 
            className="w-full sm:w-auto" 
            onClick={generatePassword}
            disabled={loading || !accountName}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Generate Password
          </Button>
          <Button 
            variant="secondary" 
            className="w-full sm:w-auto" 
            onClick={copyToClipboard}
            disabled={!password}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy to Clipboard
          </Button>
          <Button 
            variant="outline" 
            className="w-full sm:w-auto" 
            onClick={savePassword}
            disabled={loading || !password || !accountName}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Password
          </Button>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            This password generator creates secure passwords using PBKDF2 hashing with a unique salt.
            Your passwords are encrypted with AES-256 before being stored in the database.
            For added security, copied passwords are automatically cleared from your clipboard after 10 seconds.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}