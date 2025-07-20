import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the specific report
    const { data: report, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', resolvedParams.id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching report:', error);
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Report API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete the report
    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', resolvedParams.id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting report:', error);
      return NextResponse.json(
        { error: "Failed to delete report" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Report deleted successfully" });
  } catch (error) {
    console.error("Delete report API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
