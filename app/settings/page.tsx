"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Settings as SettingsIcon,
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  Download,
  Trash2,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Monitor,
  Mail,
  Smartphone,
  DollarSign,
  TrendingUp,
  Clock,
  Lock,
} from "lucide-react";

interface SettingSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

const settingSections: SettingSection[] = [
  {
    id: "profile",
    title: "Profile & Account",
    description: "Manage your personal information and account details",
    icon: User,
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Configure how and when you receive notifications",
    icon: Bell,
  },
  {
    id: "privacy",
    title: "Privacy & Security",
    description: "Control your privacy settings and security preferences",
    icon: Shield,
  },
  {
    id: "appearance",
    title: "Appearance",
    description: "Customize the look and feel of your dashboard",
    icon: Palette,
  },
  {
    id: "trading",
    title: "Trading Preferences",
    description: "Set your default trading and market preferences",
    icon: TrendingUp,
  },
  {
    id: "data",
    title: "Data & Export",
    description: "Manage your data, exports, and account deletion",
    icon: Download,
  },
];

export default function Settings() {
  const [activeSection, setActiveSection] = useState("profile");
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);
  const [theme, setTheme] = useState("dark");
  const [currency, setCurrency] = useState("USD");

  const renderSectionContent = () => {
    switch (activeSection) {
      case "profile":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Profile Information</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      First Name
                    </label>
                    <div className="mt-1 p-3 border rounded-md bg-muted/20">
                      <span className="text-muted-foreground">Coming soon</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Last Name
                    </label>
                    <div className="mt-1 p-3 border rounded-md bg-muted/20">
                      <span className="text-muted-foreground">Coming soon</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Email Address
                  </label>
                  <div className="mt-1 p-3 border rounded-md bg-muted/20">
                    <span className="text-muted-foreground">Coming soon</span>
                  </div>
                </div>
              </div>
            </div>
            <Separator />
            <div>
              <h3 className="text-lg font-medium mb-4">Account Settings</h3>
              <div className="space-y-3">
                <Button variant="outline" disabled>
                  <Lock className="w-4 h-4 mr-2" />
                  Change Password
                </Button>
                <Button variant="outline" disabled>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        );

      case "notifications":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Notification Preferences</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-md">
                  <div className="flex items-center space-x-3">
                    <Bell className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Push Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications about market changes and alerts
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={isNotificationsEnabled ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsNotificationsEnabled(!isNotificationsEnabled)}
                  >
                    {isNotificationsEnabled ? "Enabled" : "Disabled"}
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-md">
                  <div className="flex items-center space-x-3">
                    <Mail className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        Get weekly market summaries and important updates
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">Coming Soon</Badge>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-md">
                  <div className="flex items-center space-x-3">
                    <Smartphone className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">SMS Alerts</p>
                      <p className="text-sm text-muted-foreground">
                        Critical alerts sent directly to your phone
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">Coming Soon</Badge>
                </div>
              </div>
            </div>
          </div>
        );

      case "privacy":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Privacy Controls</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-md">
                  <div className="flex items-center space-x-3">
                    <Eye className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Profile Visibility</p>
                      <p className="text-sm text-muted-foreground">
                        Control who can see your trading activity
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">Coming Soon</Badge>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-md">
                  <div className="flex items-center space-x-3">
                    <Shield className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Two-Factor Authentication</p>
                      <p className="text-sm text-muted-foreground">
                        Add an extra layer of security to your account
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">Coming Soon</Badge>
                </div>
              </div>
            </div>
            <Separator />
            <div>
              <h3 className="text-lg font-medium mb-4">Data Usage</h3>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  We use your data to provide personalized insights and improve our services.
                  You can control how your data is used and request deletion at any time.
                </p>
                <Button variant="outline" disabled>
                  <Download className="w-4 h-4 mr-2" />
                  Download My Data
                </Button>
              </div>
            </div>
          </div>
        );

      case "appearance":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Theme</h3>
              <div className="grid grid-cols-3 gap-3">
                <div
                  className={`p-4 border rounded-md cursor-pointer transition-colors ${
                    theme === "light" ? "border-primary bg-primary/10" : "hover:bg-muted/50"
                  }`}
                  onClick={() => setTheme("light")}
                >
                  <div className="flex items-center space-x-2">
                    <Sun className="w-4 h-4" />
                    <span className="text-sm font-medium">Light</span>
                  </div>
                  <div className="mt-2 h-8 bg-white border rounded"></div>
                </div>
                <div
                  className={`p-4 border rounded-md cursor-pointer transition-colors ${
                    theme === "dark" ? "border-primary bg-primary/10" : "hover:bg-muted/50"
                  }`}
                  onClick={() => setTheme("dark")}
                >
                  <div className="flex items-center space-x-2">
                    <Moon className="w-4 h-4" />
                    <span className="text-sm font-medium">Dark</span>
                  </div>
                  <div className="mt-2 h-8 bg-gray-900 border rounded"></div>
                </div>
                <div
                  className={`p-4 border rounded-md cursor-pointer transition-colors ${
                    theme === "system" ? "border-primary bg-primary/10" : "hover:bg-muted/50"
                  }`}
                  onClick={() => setTheme("system")}
                >
                  <div className="flex items-center space-x-2">
                    <Monitor className="w-4 h-4" />
                    <span className="text-sm font-medium">System</span>
                  </div>
                  <div className="mt-2 h-8 bg-gradient-to-r from-white to-gray-900 border rounded"></div>
                </div>
              </div>
            </div>
            <Separator />
            <div>
              <h3 className="text-lg font-medium mb-4">Layout</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 border rounded-md">
                  <div>
                    <p className="font-medium">Compact Mode</p>
                    <p className="text-sm text-muted-foreground">
                      Reduce spacing and padding for denser layouts
                    </p>
                  </div>
                  <Badge variant="secondary">Coming Soon</Badge>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-md">
                  <div>
                    <p className="font-medium">Sidebar Position</p>
                    <p className="text-sm text-muted-foreground">
                      Choose left or right sidebar placement
                    </p>
                  </div>
                  <Badge variant="secondary">Coming Soon</Badge>
                </div>
              </div>
            </div>
          </div>
        );

      case "trading":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Currency & Region</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Default Currency
                  </label>
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    {["USD", "EUR", "GBP"].map((curr) => (
                      <div
                        key={curr}
                        className={`p-3 border rounded-md cursor-pointer transition-colors ${
                          currency === curr ? "border-primary bg-primary/10" : "hover:bg-muted/50"
                        }`}
                        onClick={() => setCurrency(curr)}
                      >
                        <div className="flex items-center space-x-2">
                          <DollarSign className="w-4 h-4" />
                          <span className="text-sm font-medium">{curr}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <Separator />
            <div>
              <h3 className="text-lg font-medium mb-4">Market Preferences</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 border rounded-md">
                  <div className="flex items-center space-x-3">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Real-time Data</p>
                      <p className="text-sm text-muted-foreground">
                        Enable live market data updates
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">Coming Soon</Badge>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-md">
                  <div className="flex items-center space-x-3">
                    <TrendingUp className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Default Chart Timeframe</p>
                      <p className="text-sm text-muted-foreground">
                        Set your preferred chart timeframe
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">Coming Soon</Badge>
                </div>
              </div>
            </div>
          </div>
        );

      case "data":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Data Management</h3>
              <div className="space-y-4">
                <div className="p-4 border rounded-md">
                  <div className="flex items-center space-x-3 mb-3">
                    <Download className="w-5 h-5 text-muted-foreground" />
                    <p className="font-medium">Export Data</p>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Download your trading history, favorites, and account data.
                  </p>
                  <Button variant="outline" disabled>
                    Request Data Export
                  </Button>
                </div>
                <div className="p-4 border rounded-md">
                  <div className="flex items-center space-x-3 mb-3">
                    <Globe className="w-5 h-5 text-muted-foreground" />
                    <p className="font-medium">Clear Cache</p>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Clear cached data to improve performance and free up storage.
                  </p>
                  <Button variant="outline" disabled>
                    Clear Cache
                  </Button>
                </div>
              </div>
            </div>
            <Separator />
            <div>
              <h3 className="text-lg font-medium mb-4 text-destructive">Danger Zone</h3>
              <div className="p-4 border border-destructive/20 rounded-md bg-destructive/5">
                <div className="flex items-center space-x-3 mb-3">
                  <Trash2 className="w-5 h-5 text-destructive" />
                  <p className="font-medium text-destructive">Delete Account</p>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                <Button variant="destructive" disabled>
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex-1 space-y-6 p-6 overflow-x-hidden max-w-full">
      {/* Header Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Settings Navigation */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" />
              Settings
            </CardTitle>
            <CardDescription>
              Choose a category to configure
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1">
              {settingSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left p-3 rounded-md transition-colors ${
                    activeSection === section.id
                      ? "bg-muted text-foreground"
                      : "hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <section.icon className="w-4 h-4" />
                    <div>
                      <p className="text-sm font-medium">{section.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {section.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Settings Content */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>
              {settingSections.find((s) => s.id === activeSection)?.title}
            </CardTitle>
            <CardDescription>
              {settingSections.find((s) => s.id === activeSection)?.description}
            </CardDescription>
          </CardHeader>
          <CardContent>{renderSectionContent()}</CardContent>
        </Card>
      </div>
    </div>
  );
}
