"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Search, 
  FileText, 
  BarChart3, 
  Star,
  User,
  TrendingUp,
  Building2,
  HelpCircle,
  ChevronRight,
  BookOpen,
  Lightbulb,
  Zap,
  Shield,
  Users,
  ArrowRight,
  CheckCircle,
  MousePointer,
  Eye,
  Download
} from "lucide-react";

interface GuideSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  steps: {
    title: string;
    description: string;
    icon?: React.ElementType;
  }[];
}

const guides: GuideSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Learn the basics of navigating and using the platform",
    icon: Zap,
    steps: [
      {
        title: "Dashboard Overview",
        description: "Your dashboard provides a comprehensive view of market trends, popular stocks, and your favorites. Use the search bar at the top to quickly find any stock.",
        icon: BarChart3
      },
      {
        title: "Account Setup",
        description: "Complete your profile by clicking your avatar in the bottom left corner. Add your first and last name for a personalized experience.",
        icon: User
      },
      {
        title: "Navigation",
        description: "Use the sidebar to navigate between Dashboard, Search, Reports, and other features. Icons will help you quickly identify each section.",
        icon: MousePointer
      }
    ]
  },
  {
    id: "stock-research",
    title: "Stock Research & Analysis",
    description: "Discover how to research stocks and access detailed financial data",
    icon: Search,
    steps: [
      {
        title: "Search for Stocks",
        description: "Use the search page or the search bar to find any publicly traded stock. Enter the company name or ticker symbol (e.g., 'AAPL' for Apple).",
        icon: Search
      },
      {
        title: "View Company Details",
        description: "Click on any stock to view detailed financial metrics, including P/E ratios, market cap, revenue growth, and comprehensive company information.",
        icon: Building2
      },
      {
        title: "Financial Metrics",
        description: "Access real-time data including current price, daily changes, 52-week ranges, profit margins, and key valuation ratios for informed decision-making.",
        icon: TrendingUp
      }
    ]
  },
  {
    id: "favorites",
    title: "Managing Favorites",
    description: "Keep track of your preferred stocks with the favorites system",
    icon: Star,
    steps: [
      {
        title: "Add to Favorites",
        description: "Click the star icon on any stock's detail page to add it to your favorites. This creates a personalized watchlist for quick access.",
        icon: Star
      },
      {
        title: "View Your Portfolio",
        description: "Your favorites appear on the dashboard with real-time price updates and performance indicators. Monitor your watchlist at a glance.",
        icon: Eye
      },
      {
        title: "Remove Favorites",
        description: "Click the star icon again on any favorited stock to remove it from your watchlist. Your favorites are automatically saved to your account.",
        icon: CheckCircle
      }
    ]
  },
  {
    id: "reports",
    title: "AI Research Reports",
    description: "Generate comprehensive AI-powered stock analysis reports",
    icon: FileText,
    steps: [
      {
        title: "Generate Reports",
        description: "Navigate to the Reports page and enter any stock symbol. Our AI will analyze market data and create a detailed research report within minutes.",
        icon: FileText
      },
      {
        title: "Read Analysis",
        description: "Each report includes executive summary, financial analysis, technical analysis, risk assessment, and investment recommendations.",
        icon: BookOpen
      },
      {
        title: "Export & Save",
        description: "All reports are automatically saved to your account. Use the export function to download reports as PDF files for offline viewing.",
        icon: Download
      }
    ]
  }
];

const features = [
  {
    title: "Real-time Data",
    description: "Live stock prices and financial metrics",
    icon: TrendingUp
  },
  {
    title: "AI-Powered Reports",
    description: "Comprehensive research analysis",
    icon: FileText
  },
  {
    title: "Personal Watchlist",
    description: "Track your favorite stocks",
    icon: Star
  },
  {
    title: "Secure & Private",
    description: "Your data is protected",
    icon: Shield
  }
];

export default function HelpPage() {
  const [selectedGuide, setSelectedGuide] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-3 p-3 bg-primary/10 rounded-full">
            <HelpCircle className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Help & Documentation
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to know to master your stock research and analysis workflow
            </p>
          </div>
        </div>

        {/* Quick Features Overview */}
        <Card className="overflow-hidden shadow-lg border-0 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardHeader className="text-center pb-4">
            <CardTitle className="flex items-center justify-center gap-3 text-2xl">
              <Lightbulb className="h-6 w-6 text-primary" />
              Platform Features
            </CardTitle>
            <CardDescription className="text-base">
              Powerful tools for stock research and investment analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <div key={index} className="text-center space-y-3">
                  <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Guides Section */}
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold">Step-by-Step Guides</h2>
            <p className="text-muted-foreground">
              Learn how to use each feature effectively
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {guides.map((guide) => (
              <Card 
                key={guide.id}
                className={`group overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer border-0 bg-card/95 backdrop-blur ${
                  selectedGuide === guide.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedGuide(selectedGuide === guide.id ? null : guide.id)}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <guide.icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-xl group-hover:text-primary transition-colors">
                            {guide.title}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {guide.description}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                    <ChevronRight 
                      className={`h-5 w-5 text-muted-foreground transition-transform ${
                        selectedGuide === guide.id ? 'rotate-90' : 'group-hover:translate-x-1'
                      }`} 
                    />
                  </div>
                </CardHeader>

                {selectedGuide === guide.id && (
                  <CardContent className="pt-0">
                    <Separator className="mb-4" />
                    <div className="space-y-4">
                      {guide.steps.map((step, stepIndex) => (
                        <div key={stepIndex} className="flex gap-4">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                              {step.icon ? (
                                <step.icon className="h-4 w-4 text-primary" />
                              ) : (
                                <span className="text-sm font-medium text-primary">
                                  {stepIndex + 1}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <h4 className="font-medium">{step.title}</h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {step.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* Quick Tips */}
        <Card className="overflow-hidden border-0 bg-card/95 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Lightbulb className="h-5 w-5 text-primary" />
              Pro Tips
            </CardTitle>
            <CardDescription>
              Make the most of your stock research experience
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Use Keyboard Shortcuts</h4>
                    <p className="text-sm text-muted-foreground">
                      Press &apos;Enter&apos; in any search field to quickly find stocks
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Bookmark Important Reports</h4>
                    <p className="text-sm text-muted-foreground">
                      Generated reports are automatically saved to your account
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Monitor Market Hours</h4>
                    <p className="text-sm text-muted-foreground">
                      Stock prices update in real-time during market hours
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Organize Your Favorites</h4>
                    <p className="text-sm text-muted-foreground">
                      Add stocks to favorites for quick access on your dashboard
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Export Analysis</h4>
                    <p className="text-sm text-muted-foreground">
                      Download reports as PDFs for offline analysis and sharing
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Regular Updates</h4>
                    <p className="text-sm text-muted-foreground">
                      Check back regularly for new features and improvements
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Support Section */}
        <Card className="overflow-hidden border-0 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
          <CardContent className="p-8 text-center">
            <div className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Need More Help?</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Have questions or suggestions? We&apos;re here to help you make the most of your investment research.
                </p>
              </div>
              <div className="flex gap-4 justify-center">
                <Button className="flex items-center gap-2" onClick={() => window.location.href = "mailto:reyabsaluja@gmail.com"}>
                  Contact Support
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
