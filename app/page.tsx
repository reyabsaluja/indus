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
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  BarChart3,
  Brain,
  Search,
  Zap,
  TrendingUp,
  Shield,
  Sparkles,
  Building2,
  Activity,
} from "lucide-react";
import Image from "next/image";

export default function LandingPage() {
  const router = useRouter();

  const features = [
    {
      icon: BarChart3,
      title: "Comprehensive Analytics",
      description:
        "Real-time financial metrics including valuation ratios, margins, growth rates, and financial health indicators.",
    },
    {
      icon: Brain,
      title: "AI-Powered Explanations",
      description:
        "Hover over any metric to get intelligent, context-aware explanations powered by advanced AI technology.",
    },
    {
      icon: Search,
      title: "Universal Search",
      description:
        "Quickly find any company, metric, or financial data with our powerful search capabilities.",
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description:
        "Built for speed with real-time data updates and instant AI-powered insights.",
    },
    {
      icon: Shield,
      title: "Enterprise Ready",
      description:
        "Secure, scalable, and reliable infrastructure designed for professional trading environments.",
    },
    {
      icon: Sparkles,
      title: "Beautiful Interface",
      description:
        "Clean, modern design that makes complex financial data easy to understand and navigate.",
    },
  ];

  const metrics = [
    { label: "Companies Tracked", value: "10,000+", icon: Building2 },
    { label: "Data Points", value: "1M+", icon: BarChart3 },
    { label: "AI Explanations", value: "50,000+", icon: Brain },
    { label: "Active Users", value: "5,000+", icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Image
              src="/logo.png"
              alt="Indus Logo"
              width={32}
              height={32}
              className="rounded-full"
            />
            <span className="text-xl font-bold">Indus</span>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => router.push("/auth")}>
              Sign In
            </Button>
            <Button onClick={() => router.push("/auth")}>
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-6xl">
          <div className="mb-8">
            <Badge variant="secondary" className="mb-6">
              <Sparkles className="w-3 h-3 mr-1" />
              The Future of Financial Intelligence
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              The Turning Point of
              <span className="text-primary block">Financial Intelligence</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed">
              Indus is an intelligent financial analysis platform with
              AI-powered insights that automatically enhance your investment
              decisions through real-time data.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button
              size="lg"
              onClick={() => router.push("/auth")}
              className="text-lg px-8 py-6"
            >
              Explore Dashboard
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push("/auth")}
              className="text-lg px-8 py-6"
            >
              View Sample (AAPL)
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
            {metrics.map((metric, index) => (
              <Card key={index} className="text-center">
                <CardContent className="pt-6">
                  <metric.icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <div className="text-2xl font-bold">{metric.value}</div>
                  <div className="text-sm text-muted-foreground">
                    {metric.label}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Powerful Features for Modern Investors
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to make informed investment decisions, powered
              by cutting-edge AI and real-time data.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="h-full hover:shadow-lg transition-shadow"
              >
                <CardHeader>
                  <feature.icon className="h-10 w-10 text-primary mb-4" />
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary/5">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Transform Your Investment Strategy?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of investors who trust Indus for intelligent
            financial analysis and data-driven decision making.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => router.push("/auth")}
              className="text-lg px-8 py-6"
            >
              Start Analyzing
              <TrendingUp className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push("/auth")}
              className="text-lg px-8 py-6"
            >
              View Live Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <Image
                src="/logo.png"
                alt="Indus Logo"
                width={24}
                height={24}
                className="rounded-full"
              />
              <span className="font-semibold">Indus</span>
            </div>
            <div className="text-sm text-muted-foreground">
              © 2025 Indus. Built with intelligence for the modern investor.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
