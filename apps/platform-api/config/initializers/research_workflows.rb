# The activity implementations share one file so the worker registers them as a coherent versioned set.
# Load it explicitly because Zeitwerk cannot infer six activity constants from that file name.
require Rails.root.join("app/services/reports/research_activities")
