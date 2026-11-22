import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

function installVueGlobals() {
	globalThis.ref = <T>(value: T) => ({ value });
	globalThis.computed = <T>(getter: () => T) => ({
		get value() {
			return getter();
		},
	});
}

describe("useCopyToClipboard", () => {
	beforeEach(() => {
		installVueGlobals();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("copies with the Clipboard API and resets state", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal("navigator", { clipboard: { writeText } });
		const { useCopyToClipboard } = await import("./use-copy-to-clipboard");
		const composable = useCopyToClipboard();

		await composable.copyToClipboard("hello");

		expect(writeText).toHaveBeenCalledWith("hello");
		expect(composable.copied.value).toBe(true);
		vi.advanceTimersByTime(3000);
		expect(composable.copied.value).toBe(false);
	});

	it("surfaces clipboard failures", async () => {
		vi.stubGlobal("navigator", {
			clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
		});
		const { useCopyToClipboard } = await import("./use-copy-to-clipboard");
		const composable = useCopyToClipboard();

		await expect(composable.copyToClipboard("hello")).rejects.toThrow("denied");
	});
});
