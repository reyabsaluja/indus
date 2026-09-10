require "temporalio/activity"

module Reports
  module HeartbeatingActivity
    private

    def heartbeat(stage)
      Temporalio::Activity::Context.current.heartbeat(stage)
    end
  end

  class StartReportActivity < Temporalio::Activity::Definition
    include HeartbeatingActivity

    def execute(input)
      heartbeat("start")
      ActivityExecution.run(report_id: input.fetch("report_id"), activity_key: "start:v1", lease_seconds: 30) do
        Report.transaction do
          report = Report.lock.find(input.fetch("report_id"))
          previous_status = report.status
          report.update!(status: "generating", workflow_id: input.fetch("workflow_id"), failure_code: nil)
          LifecycleEvent.emit!(report: report, previous_status: previous_status, correlation_id: input.fetch("correlation_id"),
            idempotency_key: "#{input.fetch('workflow_id')}:generating")
        end
        { "status" => "generating" }
      end
    end
  end

  class LoadReportEvidenceActivity < Temporalio::Activity::Definition
    include HeartbeatingActivity

    def execute(input)
      heartbeat("load-evidence")
      ActivityExecution.run(report_id: input.fetch("report_id"), activity_key: "evidence:v1", lease_seconds: 30) do
        report = Report.includes(portfolio: :positions).find(input.fetch("report_id"))
        snapshot = FundamentalsProvider.default.fetch(symbol: report.symbol)
        evidence = [ {
          "source_id" => "fundamentals:#{snapshot.source_reference}", "kind" => "fundamentals",
          "provider" => "fundamentals-provider", "reference" => snapshot.source_reference,
          "as_of" => snapshot.as_of.iso8601(6), "data" => snapshot.metrics
        } ]
        if report.portfolio
          evidence << { "source_id" => "portfolio:#{report.portfolio.id}", "kind" => "portfolio", "provider" => "indus",
            "reference" => report.portfolio.id, "as_of" => report.portfolio.updated_at.iso8601(6),
            "data" => report.portfolio.positions.limit(1_000).map do |position|
              { "symbol" => position.symbol, "quantity" => position.quantity.to_s("F"),
                "average_cost" => position.average_cost.to_s("F"), "currency" => position.currency }
            end }
        end
        heartbeat("evidence-loaded")
        { "symbol" => report.symbol, "focus" => input["focus"], "evidence" => evidence }
      end
    end
  end

  class GenerateReportActivity < Temporalio::Activity::Definition
    include HeartbeatingActivity

    def execute(input)
      heartbeat("model-request")
      ActivityExecution.run(report_id: input.fetch("report_id"), activity_key: "model:research_report:v1", lease_seconds: 120) do
        execution = ModelGateway.default.execute(task: "research_report",
          input: { symbol: input.fetch("evidence").fetch("symbol"),
            untrusted_user_focus: input.fetch("evidence")["focus"], evidence: input.fetch("evidence").fetch("evidence") })
        heartbeat("model-response")
        { "payload" => execution.payload, "model" => execution.model, "prompt_version" => execution.prompt_version,
          "usage" => execution.usage }
      end
    end
  end

  class PersistReportActivity < Temporalio::Activity::Definition
    include HeartbeatingActivity

    def execute(input)
      heartbeat("persist")
      ActivityExecution.run(report_id: input.fetch("report_id"), activity_key: "persist:v1", lease_seconds: 60) do
        report = Report.find(input.fetch("report_id"))
        document = input.fetch("generation").fetch("payload").merge("report_id" => report.id,
          "symbol" => report.symbol, "generated_at" => Time.current.iso8601(6),
          "prompt_version" => input.fetch("generation").fetch("prompt_version"))
        artifact_key = ArtifactStore.from_env.put(report_id: report.id, user_id: report.user_id, document: document)
        Report.transaction do
          report.lock!
          raise ReportCancelled, "report was cancelled" if report.status == "cancelled"

          input.fetch("evidence").fetch("evidence").each do |source|
            report.report_sources.find_or_create_by!(kind: source.fetch("kind"), source_reference: source.fetch("reference")) do |record|
              record.provider = source.fetch("provider")
              record.evidence = { source_id: source.fetch("source_id"), as_of: source.fetch("as_of") }
            end
          end
          previous_status = report.status
          report.update!(status: "completed", summary: document.fetch("summary"), content: document.fetch("content"),
            model: input.fetch("generation").fetch("model"), artifact_key: artifact_key, completed_at: Time.current)
          LifecycleEvent.emit!(report: report, previous_status: previous_status, correlation_id: input.fetch("correlation_id"),
            idempotency_key: "#{input.fetch('workflow_id')}:completed")
        end
        { "status" => "completed", "artifact_key" => artifact_key }
      end
    end
  end

  class MarkReportFailedActivity < Temporalio::Activity::Definition
    include HeartbeatingActivity

    def execute(input)
      heartbeat("mark-failed")
      report = Report.find(input.fetch("report_id"))
      return { "status" => report.status } if %w[completed cancelled failed].include?(report.status)

      Report.transaction do
        report.lock!
        previous_status = report.status
        report.update!(status: "failed", failure_code: input.fetch("failure_code").to_s.byteslice(0, 100))
        LifecycleEvent.emit!(report: report, previous_status: previous_status, correlation_id: input.fetch("correlation_id"),
          idempotency_key: "#{input.fetch('workflow_id')}:failed")
      end
      { "status" => "failed" }
    end
  end

  class MarkReportCancelledActivity < Temporalio::Activity::Definition
    include HeartbeatingActivity

    def execute(input)
      heartbeat("mark-cancelled")
      report = Report.find(input.fetch("report_id"))
      return { "status" => report.status } if %w[completed cancelled].include?(report.status)

      Report.transaction do
        report.lock!
        previous_status = report.status
        report.update!(status: "cancelled", failure_code: nil)
        LifecycleEvent.emit!(report: report, previous_status: previous_status, correlation_id: input.fetch("correlation_id"),
          idempotency_key: "#{input.fetch('workflow_id')}:cancelled")
      end
      { "status" => "cancelled" }
    end
  end
end
