"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";
import Image from "next/image";

export default function AuthCodeError() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-6">
            <Image
              src="/logo.png"
              alt="Indus Logo"
              width={40}
              height={40}
              className="rounded-full"
            />
            <span className="text-2xl font-bold">Indus</span>
          </div>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-xl">Authentication Error</CardTitle>
            <CardDescription>
              There was an error processing your authentication request.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              This could be due to an expired link, invalid code, or network
              issue. Please try signing in again.
            </p>

            <div className="space-y-2">
              <Button onClick={() => router.push("/auth")} className="w-full">
                Try Again
              </Button>

              <Button
                variant="outline"
                onClick={() => router.push("/")}
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
