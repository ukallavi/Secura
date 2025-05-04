"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Copy, Check, ArrowRight } from 'lucide-react';

export function BackupCodesDisplay({ backupCodes, onContinue }) {
  const [copied, setCopied] = useState(false);

  // Format codes for display
  const formattedCodes = backupCodes.map(code => code.code || code);

  // Handle copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(formattedCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle download as text file
  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([formattedCodes.join('\n')], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'secura-backup-codes.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Your Backup Codes</CardTitle>
        <CardDescription>
          Save these backup codes in a secure location. Each code can only be used once.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4 bg-yellow-50 border-yellow-200">
          <AlertDescription className="text-yellow-800">
            <strong>Important:</strong> These codes will only be shown once. Make sure to save them before continuing.
          </AlertDescription>
        </Alert>
        
        <div className="grid grid-cols-2 gap-2 mb-4">
          {formattedCodes.map((code, index) => (
            <div key={index} className="p-2 bg-gray-100 rounded text-center font-mono">
              {code}
            </div>
          ))}
        </div>
        
        <div className="flex flex-wrap gap-2 mt-4">
          <Button 
            variant="outline" 
            className="flex items-center gap-2" 
            onClick={handleCopy}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </Button>
          
          <Button 
            variant="outline" 
            className="flex items-center gap-2" 
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
            Download as Text
          </Button>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full flex items-center justify-center gap-2" 
          onClick={onContinue}
        >
          Continue to Login
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
