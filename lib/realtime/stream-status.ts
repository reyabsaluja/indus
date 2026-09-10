export type RealtimeStatus = "connecting" | "connected" | "reconnecting" | "historical";

export type StreamLifecycleEvent =
	| "transport-open"
	| "upstream-ready"
	| "transport-error"
	| "provider-error";

export function getRealtimeStatus(event: StreamLifecycleEvent): RealtimeStatus {
	switch (event) {
		case "transport-open":
			return "connecting";
		case "upstream-ready":
			return "connected";
		case "transport-error":
			return "reconnecting";
		case "provider-error":
			return "historical";
	}
}
