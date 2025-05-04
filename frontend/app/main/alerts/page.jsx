'use client';

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function AlertsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Security Alerts</h1>
      
      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Coming Soon</AlertTitle>
        <AlertDescription>
          The Security Alerts feature is currently under development. This feature will notify you of potential security issues with your account.
        </AlertDescription>
      </Alert>
      
      <div className="border rounded-lg p-6 text-center">
        <h2 className="text-lg font-medium mb-2">No Active Alerts</h2>
        <p className="text-muted-foreground mb-4">
          You don't have any security alerts at this time.
        </p>
        <p className="text-sm text-muted-foreground">
          When this feature is available, you'll receive alerts for suspicious activities, password breaches, and other security concerns.
        </p>
      </div>
    </div>
  );
}
