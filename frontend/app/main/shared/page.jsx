'use client';

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function SharedPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Shared Passwords</h1>
      
      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Coming Soon</AlertTitle>
        <AlertDescription>
          The Shared Passwords feature is currently under development. This feature will allow you to securely share passwords with trusted contacts.
        </AlertDescription>
      </Alert>
      
      <div className="border rounded-lg p-6 text-center">
        <h2 className="text-lg font-medium mb-2">No Shared Passwords</h2>
        <p className="text-muted-foreground mb-4">
          You haven't shared any passwords yet or no one has shared passwords with you.
        </p>
        <p className="text-sm text-muted-foreground">
          When this feature is available, you'll be able to securely share passwords with others and manage access permissions.
        </p>
      </div>
    </div>
  );
}
