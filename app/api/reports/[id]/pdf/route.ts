import { NextResponse } from "next/server";
import { logger } from "@/lib/observability/logger";
import { isCompleteReportContent } from "@/lib/report-content";
import { reportIdSchema } from "@/lib/schemas/api";
import { createReportPdf, reportPdfFilename } from "@/lib/server/report-pdf";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const parsed = reportIdSchema.safeParse(await params);
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid report ID" }, { status: 400 });
	}

	try {
		const supabase = await createClient();
		const {
			data: { user },
			error: userError,
		} = await supabase.auth.getUser();
		if (userError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { data: report, error } = await supabase
			.from("reports")
			.select("id, symbol, company_name, report_content, created_at, status")
			.eq("id", parsed.data.id)
			.eq("user_id", user.id)
			.single();
		if (error || !report) {
			return NextResponse.json({ error: "Report not found" }, { status: 404 });
		}
		if (report.status !== "completed" || !isCompleteReportContent(report.report_content)) {
			return NextResponse.json({ error: "Report is not ready for export" }, { status: 409 });
		}

		const bytes = await createReportPdf({
			symbol: report.symbol,
			companyName: report.company_name,
			content: report.report_content,
			createdAt: report.created_at,
		});
		const filename = reportPdfFilename(report.symbol, report.created_at);
		return new NextResponse(Buffer.from(bytes), {
			headers: {
				"Cache-Control": "private, no-store",
				"Content-Disposition": `attachment; filename="${filename}"`,
				"Content-Length": String(bytes.byteLength),
				"Content-Type": "application/pdf",
				"X-Content-Type-Options": "nosniff",
			},
		});
	} catch (error) {
		logger.error("report.pdf_failed", error, { reportId: parsed.data.id });
		return NextResponse.json({ error: "Unable to export report" }, { status: 500 });
	}
}
