import { describe, expect, it } from "vitest";
import { getRealtimeStatus } from "@/lib/realtime/stream-status";

describe("getRealtimeStatus", () => {
	it("does not claim live data when only the browser transport is open", () => {
		expect(getRealtimeStatus("transport-open")).toBe("connecting");
	});

	it("claims live data only after the upstream provider is ready", () => {
		expect(getRealtimeStatus("upstream-ready")).toBe("connected");
	});

	it("distinguishes reconnecting and historical fallback states", () => {
		expect(getRealtimeStatus("transport-error")).toBe("reconnecting");
		expect(getRealtimeStatus("provider-error")).toBe("historical");
	});
});
