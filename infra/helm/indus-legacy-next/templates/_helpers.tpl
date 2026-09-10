{{- define "indus-legacy-next.name" -}}
indus-legacy-next
{{- end }}
{{- define "indus-legacy-next.labels" -}}
app.kubernetes.io/name: {{ include "indus-legacy-next.name" . }}
app.kubernetes.io/managed-by: Helm
{{- end }}
