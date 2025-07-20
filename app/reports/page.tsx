"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { 
  Search, 
  FileText, 
  Calendar, 
  Download, 
  Eye, 
  Trash2, 
  Plus, 
  ArrowLeft,
  Clock,
  TrendingUp,
  Building2,
  BarChart3
} from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { format } from "date-fns";

interface Report {
  id: string;
  symbol: string;
  company_name: string;
  report_content: string;
  created_at: string;
  status: 'generating' | 'completed' | 'error';
  summary: string;
}

// Markdown-like text formatter
const formatText = (text: string) => {
  if (!text) return null;
  
  // Split by paragraphs and process each
  const paragraphs = text.split('\n\n');
  
  return paragraphs.map((paragraph, pIndex) => {
    if (!paragraph.trim()) return null;
    
    // Check if it's a heading (starts with #)
    if (paragraph.startsWith('#')) {
      const level = paragraph.match(/^#+/)?.[0].length || 1;
      const headingText = paragraph.replace(/^#+\s*/, '');
      
      if (level === 1) {
        return (
          <h1 key={pIndex} className="text-2xl font-bold mb-4 text-foreground border-b pb-2">
            {headingText}
          </h1>
        );
      } else if (level === 2) {
        return (
          <h2 key={pIndex} className="text-xl font-semibold mb-3 mt-6 text-foreground">
            {headingText}
          </h2>
        );
      } else if (level === 3) {
        return (
          <h3 key={pIndex} className="text-lg font-semibold mb-2 mt-4 text-foreground">
            {headingText}
          </h3>
        );
      }
    }
    
    // Process inline formatting
    let processedText = paragraph;
    
    // Bold text (**text**)
    processedText = processedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic text (*text*)
    processedText = processedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Code text (`text`)
    processedText = processedText.replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>');
    
    return (
      <p 
        key={pIndex} 
        className="mb-4 text-muted-foreground leading-relaxed"
        dangerouslySetInnerHTML={{ __html: processedText }}
      />
    );
  });
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newReportSymbol, setNewReportSymbol] = useState("");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'view'>('list');
  const { user } = useAuth();

  // Fetch existing reports
  useEffect(() => {
    if (user) {
      fetchReports();
    }
  }, [user]);

  const fetchReports = async () => {
    try {
      const response = await fetch('/api/reports');
      if (response.ok) {
        const data = await response.json();
        setReports(data.reports || []);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    if (!newReportSymbol.trim()) return;

    setGenerating(true);
    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol: newReportSymbol.toUpperCase(),
        }),
      });

      if (response.ok) {
        const newReport = await response.json();
        setReports(prev => [newReport.report, ...prev]);
        setNewReportSymbol("");
        
        // Poll for completion
        pollReportStatus(newReport.report.id);
      } else {
        const error = await response.json();
        console.error('Error generating report:', error);
      }
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setGenerating(false);
    }
  };

  const pollReportStatus = async (reportId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/reports/${reportId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.report.status === 'completed' || data.report.status === 'error') {
            setReports(prev => prev.map(report => 
              report.id === reportId ? data.report : report
            ));
            clearInterval(interval);
          }
        }
      } catch (error) {
        console.error('Error polling report status:', error);
        clearInterval(interval);
      }
    }, 3000);
  };

  const deleteReport = async (reportId: string) => {
    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setReports(prev => prev.filter(report => report.id !== reportId));
        if (selectedReport?.id === reportId) {
          setSelectedReport(null);
          setViewMode('list');
        }
      }
    } catch (error) {
      console.error('Error deleting report:', error);
    }
  };

  const handleViewReport = (report: Report) => {
    setSelectedReport(report);
    setViewMode('view');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedReport(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
        <div className="container mx-auto p-6 space-y-8">
          <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-6 w-96" />
          </div>
          <div className="grid gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Full-screen report view
  if (viewMode === 'view' && selectedReport) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
        <div className="container mx-auto max-w-4xl p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <Button 
              variant="ghost" 
              onClick={handleBackToList}
              className="flex items-center gap-2 hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Reports
            </Button>
            <div className="flex items-center gap-3">
              <Badge 
                variant={
                  selectedReport.status === 'completed' ? 'default' : 
                  selectedReport.status === 'generating' ? 'secondary' : 'destructive'
                }
                className="px-3 py-1"
              >
                {selectedReport.status === 'generating' && (
                  <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent mr-2" />
                )}
                {selectedReport.status}
              </Badge>
              {selectedReport.status === 'completed' && (
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              )}
            </div>
          </div>

          {/* Report Card */}
          <Card className="overflow-hidden shadow-lg border-0 bg-card/95 backdrop-blur">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 border-b">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold">
                        {selectedReport.symbol} Research Report
                      </CardTitle>
                      <CardDescription className="text-base">
                        {selectedReport.company_name}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Generated on {format(new Date(selectedReport.created_at), 'MMMM d, yyyy')}
                    </span>
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {format(new Date(selectedReport.created_at), 'h:mm a')}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-8">
              {selectedReport.status === 'generating' ? (
                <div className="text-center py-16 space-y-6">
                  <div className="relative mx-auto w-24 h-24">
                    <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <BarChart3 className="absolute inset-4 h-16 w-16 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">Generating Your Report</h3>
                    <p className="text-muted-foreground">
                      Our AI is analyzing market data and crafting a comprehensive research report for {selectedReport.symbol}...
                    </p>
                  </div>
                  <div className="space-y-3 max-w-md mx-auto">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ) : selectedReport.status === 'error' ? (
                <div className="text-center py-16 space-y-4">
                  <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
                    <FileText className="h-8 w-8 text-destructive" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-destructive">Generation Failed</h3>
                    <p className="text-muted-foreground">
                      We encountered an error while generating your report. Please try again.
                    </p>
                  </div>
                  <Button onClick={() => handleBackToList()} variant="outline">
                    Return to Reports
                  </Button>
                </div>
              ) : (
                <div className="prose prose-gray max-w-none">
                  <div className="space-y-1">
                    {formatText(selectedReport.report_content)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Main reports list view
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-3 p-3 bg-primary/10 rounded-full">
            <TrendingUp className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Research Reports
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Generate comprehensive AI-powered research reports for any stock. Get detailed analysis, 
              financial insights, and investment recommendations in minutes.
            </p>
          </div>
        </div>

        {/* Generate New Report Card */}
        <Card className="overflow-hidden shadow-lg border-0 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardHeader className="text-center pb-4">
            <CardTitle className="flex items-center justify-center gap-3 text-2xl">
              <Plus className="h-6 w-6 text-primary" />
              Generate New Report
            </CardTitle>
            <CardDescription className="text-base">
              Enter any stock symbol to create a detailed research analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-8">
            <div className="flex gap-4 max-w-md mx-auto">
              <Input
                placeholder="Enter stock symbol (e.g., AAPL, GOOGL)"
                value={newReportSymbol}
                onChange={(e) => setNewReportSymbol(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && generateReport()}
                className="flex-1 h-12 text-center text-lg font-medium"
              />
              <Button 
                onClick={generateReport} 
                disabled={generating || !newReportSymbol.trim()}
                className="h-12 px-8 text-base font-medium"
                size="lg"
              >
                {generating ? (
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Analyzing...
                  </div>
                ) : (
                  <>
                    <Search className="h-5 w-5 mr-2" />
                    Generate Report
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Reports Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Your Reports</h2>
            <Badge variant="secondary" className="px-3 py-1">
              {reports.length} {reports.length === 1 ? 'Report' : 'Reports'}
            </Badge>
          </div>
          
          {reports.length === 0 ? (
            <Card className="overflow-hidden border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mx-auto w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-6">
                  <FileText className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-3">No reports yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-6">
                  Start by generating your first research report. Our AI will analyze market data, 
                  financial metrics, and provide comprehensive investment insights.
                </p>
                <Button variant="outline" onClick={() => document.querySelector('input')?.focus()}>
                  Create Your First Report
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {reports.map((report) => (
                <Card 
                  key={report.id} 
                  className="group overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer border-0 bg-card/95 backdrop-blur"
                  onClick={() => handleViewReport(report)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-primary/10 rounded-md">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <h3 className="font-bold text-lg group-hover:text-primary transition-colors">
                            {report.symbol}
                          </h3>
                        </div>
                        <Badge 
                          variant={
                            report.status === 'completed' ? 'default' : 
                            report.status === 'generating' ? 'secondary' : 'destructive'
                          }
                          className="w-fit"
                        >
                          {report.status === 'generating' && (
                            <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent mr-1" />
                          )}
                          {report.status}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteReport(report.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground leading-relaxed h-12 overflow-hidden">
                        {report.summary || report.company_name}
                      </p>
                      
                      <Separator />
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(report.created_at), 'MMM d, yyyy')}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-3 text-xs font-medium group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewReport(report);
                          }}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View Report
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
