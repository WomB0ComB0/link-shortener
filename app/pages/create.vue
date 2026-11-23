<!--
 Copyright 2025 Mike Odnis

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
-->

<template>
	<PageShell
		eyebrow="links.mikeodnis.dev · Shorten"
		title="Create Short Link"
		description="Paste a destination URL to run the 6-stage strict security pipeline and mint a short redirect."
	>
		<template #actions>
			<NuxtLink to="/" class="console-btn console-btn-outline">
				<UIcon name="i-heroicons-home" class="size-4 shrink-0" aria-hidden="true" />
				<span>Home</span>
			</NuxtLink>
			<NuxtLink
				v-if="isAuthenticated"
				to="/dashboard"
				class="console-btn console-btn-outline"
			>
				<UIcon name="i-heroicons-chart-bar" class="size-4 shrink-0" aria-hidden="true" />
				<span>Dashboard</span>
			</NuxtLink>
			<NuxtLink
				v-else
				to="/auth"
				class="console-btn console-btn-outline"
			>
				<UIcon name="i-heroicons-user" class="size-4 shrink-0" aria-hidden="true" />
				<span>Sign in</span>
			</NuxtLink>
		</template>

		<!-- Two-column Live Console workspace -->
		<div class="grid items-start gap-4 lg:grid-cols-12">
			<!-- Primary Form Tile -->
			<section
				aria-labelledby="shorten-form-heading"
				class="overflow-hidden rounded-tile border border-hairline bg-surface-1 shadow-tile lg:col-span-7"
			>
				<div
					class="flex items-center justify-between gap-3 border-b border-hairline bg-[linear-gradient(160deg,var(--brand-wash),transparent_60%)] px-5 py-4 sm:px-6"
				>
					<div>
						<h2 id="shorten-form-heading" class="tile-title text-foreground">
							Redirect configuration
						</h2>
						<p class="mt-0.5 tile-meta text-muted-foreground">
							{{
								isAuthenticated
									? "Authenticated session · no master password needed"
									: "Anonymous mode · master password required"
							}}
						</p>
					</div>

					<span
						class="tile-label inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-surface-2 px-2.5 py-1"
						:class="canSubmit ? 'text-live' : 'text-faint'"
					>
						<StatusDot :tone="canSubmit ? 'live' : 'idle'" :pulse="canSubmit" />
						<span>{{ canSubmit ? "Ready" : "Draft" }}</span>
					</span>
				</div>

				<form class="space-y-5 p-5 sm:p-6" @submit.prevent="createLink">
					<!-- Original URL -->
					<div>
						<div class="mb-1.5 flex items-baseline justify-between gap-2">
							<label for="originalUrl" class="tile-label text-foreground">
								Original URL <span class="text-down">*</span>
							</label>
							<span
								v-if="parsedUrl"
								class="mono-token text-live"
							>
								{{ parsedUrl.protocol.replace(":", "").toUpperCase() }} · {{ parsedUrl.hostname }}
							</span>
							<span
								v-else-if="originalUrl.trim()"
								class="mono-token text-ongoing"
							>
								Include https://
							</span>
						</div>
						<div class="console-field-shell">
							<span
								class="flex items-center pl-3 text-faint"
								aria-hidden="true"
							>
								<UIcon name="i-heroicons-globe-alt" class="size-4" />
							</span>
							<input
								id="originalUrl"
								v-model="originalUrl"
								type="url"
								placeholder="https://example.com/your/very/long/url"
								:disabled="loading"
								autocomplete="off"
							/>
						</div>
					</div>

					<!-- Custom Alias -->
					<div>
						<div class="mb-1.5 flex items-baseline justify-between gap-2">
							<label for="customAlias" class="tile-label text-foreground">
								Custom Alias <span class="text-faint">(Optional)</span>
							</label>
							<span
								v-if="customAlias && !aliasValid"
								class="mono-token text-down"
							>
								Letters, numbers &amp; hyphens only
							</span>
							<span v-else class="tile-meta text-faint">
								Leave blank for auto-generated code
							</span>
						</div>
						<div class="console-field-shell">
							<span
								class="flex shrink-0 items-center border-r border-hairline bg-surface-2 px-3 mono-token text-muted-foreground select-none"
							>
								links.mikeodnis.dev/
							</span>
							<input
								id="customAlias"
								v-model="customAlias"
								type="text"
								placeholder="my-custom-link"
								:disabled="loading"
								class="font-mono"
								autocomplete="off"
							/>
						</div>
					</div>

					<!-- Expiration Date with quick presets -->
					<div>
						<div class="mb-1.5 flex flex-wrap items-center justify-between gap-2">
							<label for="expiresAt" class="tile-label text-foreground">
								Expires At <span class="text-faint">(Optional)</span>
							</label>
							<div class="flex flex-wrap items-center gap-1.5">
								<button
									v-for="preset in EXPIRY_PRESETS"
									:key="preset.id"
									type="button"
									class="console-chip"
									:class="activePreset === preset.id && 'console-chip-active'"
									@click="applyExpiryPreset(preset)"
								>
									{{ preset.label }}
								</button>
							</div>
						</div>
						<div class="console-field-shell">
							<span
								class="flex items-center pl-3 text-faint"
								aria-hidden="true"
							>
								<UIcon name="i-heroicons-clock" class="size-4" />
							</span>
							<input
								id="expiresAt"
								v-model="expiresAt"
								type="datetime-local"
								:disabled="loading"
								@input="activePreset = null"
							/>
						</div>
					</div>

					<!-- Master Password (only if not authenticated) -->
					<div v-if="!isAuthenticated" class="border-t border-hairline pt-5">
						<div class="mb-1.5 flex items-baseline justify-between gap-2">
							<label for="masterPassword" class="tile-label text-foreground">
								Master Password <span class="text-down">*</span>
							</label>
							<NuxtLink
								to="/auth"
								class="tile-meta text-brand-ink hover:underline"
							>
								Sign in instead →
							</NuxtLink>
						</div>
						<div class="console-field-shell">
							<span
								class="flex items-center pl-3 text-faint"
								aria-hidden="true"
							>
								<UIcon name="i-heroicons-lock-closed" class="size-4" />
							</span>
							<input
								id="masterPassword"
								v-model="masterPassword"
								:type="showMasterPassword ? 'text' : 'password'"
								placeholder="Enter master password"
								:disabled="loading"
								autocomplete="current-password"
							/>
							<button
								type="button"
								class="flex cursor-pointer items-center px-3 text-faint transition-colors hover:text-foreground"
								:aria-label="showMasterPassword ? 'Hide secret' : 'Reveal secret'"
								:aria-pressed="showMasterPassword"
								@click="showMasterPassword = !showMasterPassword"
							>
								<UIcon
									:name="showMasterPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
									class="size-4"
									aria-hidden="true"
								/>
							</button>
						</div>
						<p class="mt-1.5 tile-meta text-faint">
							Required for anonymous link creation
						</p>
					</div>

					<div class="pt-1">
						<button
							type="submit"
							:disabled="loading || (!isAuthenticated && !masterPassword) || !originalUrl"
							class="console-btn console-btn-primary h-11 w-full"
						>
							<UIcon
								v-if="loading"
								name="i-heroicons-arrow-path"
								class="size-4 animate-spin"
								aria-hidden="true"
							/>
							<UIcon
								v-else
								name="i-heroicons-link"
								class="size-4 shrink-0"
								aria-hidden="true"
							/>
							<span>{{ loading ? "Verifying & creating..." : "Create Short Link" }}</span>
						</button>
					</div>
				</form>

				<!-- Result Display -->
				<div
					v-if="result"
					class="mx-5 mb-5 space-y-4 rounded-tile border border-live/30 bg-live-tint p-5 sm:mx-6 sm:mb-6"
				>
					<div class="flex items-center justify-between gap-2">
						<div class="flex items-center gap-2 tile-label text-live">
							<StatusDot tone="live" pulse />
							<span>Link created successfully!</span>
						</div>
						<span class="mono-token text-muted-foreground">
							{{ new Date(result.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }}
						</span>
					</div>

					<div class="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
						<input
							:value="shortLinkUrl"
							type="text"
							readonly
							aria-label="Generated short URL"
							class="console-input flex-1 font-mono text-brand-ink"
						/>
						<button
							type="button"
							class="console-btn console-btn-primary shrink-0"
							@click="copyResult"
						>
							<UIcon
								:name="copied ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
								class="size-4"
								aria-hidden="true"
							/>
							<span>{{ copied ? "Copied!" : "Copy" }}</span>
						</button>
					</div>

					<div
						class="flex flex-col gap-2 tile-meta text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
					>
						<span class="truncate">{{ new Date(result.createdAt).toLocaleString() }}</span>
						<a
							:href="shortLinkUrl"
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex shrink-0 items-center gap-1 font-medium text-brand-ink hover:underline"
						>
							<span>Test link</span>
							<UIcon name="i-heroicons-arrow-top-right-on-square" class="size-3.5" aria-hidden="true" />
						</a>
					</div>
				</div>

				<!-- Error Display -->
				<div
					v-if="error"
					role="alert"
					class="mx-5 mb-5 flex items-start justify-between gap-3 rounded-tile border border-down/30 bg-down-tint p-4 text-body-sm text-down sm:mx-6 sm:mb-6"
				>
					<div class="flex items-start gap-2.5">
						<UIcon
							name="i-heroicons-exclamation-circle"
							class="mt-0.5 size-4 shrink-0"
							aria-hidden="true"
						/>
						<span>{{ error }}</span>
					</div>
					<button
						type="button"
						class="shrink-0 cursor-pointer rounded p-0.5 text-down/80 transition-colors hover:text-down"
						aria-label="Dismiss error"
						@click="error = ''"
					>
						<UIcon name="i-heroicons-x-mark" class="size-4" aria-hidden="true" />
					</button>
				</div>
			</section>

			<!-- Right Telemetry & Live Preview Column -->
			<aside class="flex flex-col gap-4 lg:col-span-5">
				<!-- Live Redirect Preview Tile -->
				<div class="rounded-tile border border-hairline bg-surface-1 p-5 shadow-tile">
					<div class="flex items-center justify-between gap-2">
						<span class="tile-label text-muted-foreground">Live preview</span>
						<span
							v-if="customAlias.trim()"
							class="rounded-md border border-hairline bg-surface-2 px-1.5 py-0.5 mono-token text-muted-foreground"
						>
							Custom alias
						</span>
						<span v-else class="mono-token text-faint">Auto code</span>
					</div>

					<div class="mt-4 rounded-lg border border-hairline bg-canvas p-4">
						<div class="flex items-center gap-2">
							<span
								class="flex size-7 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-2 text-brand-ink"
							>
								<UIcon name="i-heroicons-link" class="size-4" aria-hidden="true" />
							</span>
							<code class="mono-token truncate rounded-md bg-brand-subtle px-2 py-1 text-brand-ink">
								links.mikeodnis.dev/{{ previewSlug }}
							</code>
						</div>

						<div class="mt-3 flex items-center gap-2 tile-sub">
							<UIcon
								name="i-heroicons-arrow-right"
								class="size-3.5 shrink-0 text-faint"
								aria-hidden="true"
							/>
							<span
								class="truncate"
								:class="originalUrl.trim() ? 'text-foreground' : 'text-faint'"
							>
								{{ originalUrl.trim() || "https://example.com/your/destination" }}
							</span>
						</div>

						<div
							class="mt-3 flex items-center justify-between border-t border-hairline pt-2.5 tile-meta text-faint"
						>
							<span>302 Redirect</span>
							<span>{{ expirySummary }}</span>
						</div>
					</div>
				</div>

				<!-- 6-Stage Strict Security Verification Pipeline Tile -->
				<div class="rounded-tile border border-hairline bg-surface-1 p-5 shadow-tile">
					<div class="flex items-center justify-between gap-2">
						<span class="tile-label text-muted-foreground">Security pipeline</span>
						<span
							v-if="lastVerification"
							class="mono-token"
							:class="lastVerification.isVerified ? 'text-live' : 'text-down'"
						>
							Risk {{ lastVerification.riskScore }}/100
						</span>
						<span v-else class="mono-token text-faint">6 checks</span>
					</div>
					<p class="mt-1.5 tile-sub text-muted-foreground">
						Strict SSRF-gated inspection runs before any redirect is minted.
					</p>

					<ul class="mt-4 divide-y divide-hairline border-t border-hairline">
						<li
							v-for="check in pipelineChecks"
							:key="check.id"
							class="flex items-center justify-between gap-3 py-2.5"
						>
							<div class="flex min-w-0 items-center gap-2.5">
								<StatusDot :tone="check.tone" :pulse="check.pulse" />
								<span class="truncate tile-sub text-foreground">{{ check.label }}</span>
							</div>
							<span class="shrink-0 mono-token" :class="check.statusClass">
								{{ check.status }}
							</span>
						</li>
					</ul>
				</div>
			</aside>
		</div>

		<!-- Recent Links Section -->
		<section
			v-if="loadingRecent || recentError || recentLinks.length > 0"
			aria-labelledby="recent-links-heading"
			class="space-y-4 border-t border-hairline pt-6"
		>
			<div class="space-y-1">
				<h2 id="recent-links-heading" class="tile-title-lg text-foreground">
					Recently Created Links
				</h2>
				<p class="tile-sub text-muted-foreground">
					Latest shortened links across the console
				</p>
			</div>

			<DataErrorCard
				v-if="recentError && !loadingRecent"
				title="Could not load recent links"
				:message="recentError"
				:retrying="loadingRecent"
				@retry="fetchRecentLinks"
			/>

			<LinksGrid
				v-else
				:links="recentLinks"
				:loading="loadingRecent"
				:skeleton-count="3"
			/>
		</section>
	</PageShell>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import type { CreateShortLinkResponse } from "../../server/schemas";
import type { StatusTone } from "../components/StatusDot.vue";
import { useAuth, useCopyToClipboard, useFetcher } from "../composables";

const { get: fetchGet, post: fetchPost, FetcherError } = useFetcher();
const { isAuthenticated, syncFromStorage } = useAuth();

const masterPassword = ref("");
const showMasterPassword = ref(false);
const originalUrl = ref("");
const customAlias = ref("");
const expiresAt = ref("");
const activePreset = ref<string | null>("none");

interface VerificationSummaryView {
	readonly isVerified: boolean;
	readonly overallRisk: string;
	readonly riskScore: number;
	readonly checks?: Record<
		string,
		{ readonly passed: boolean; readonly warnings: number }
	>;
}

const loading = ref(false);
const error = ref("");
const securityBlocked = ref(false);
const lastVerification = ref<VerificationSummaryView | null>(null);
const result = ref<CreateShortLinkResponse | null>(null);
const recentLinks = ref<any[]>([]);
const loadingRecent = ref(true);
const recentError = ref("");
const { copied, copyToClipboard } = useCopyToClipboard();

interface ExpiryPreset {
	readonly id: string;
	readonly label: string;
	readonly hours: number | null;
}

const EXPIRY_PRESETS: readonly ExpiryPreset[] = [
	{ id: "24h", label: "24h", hours: 24 },
	{ id: "7d", label: "7d", hours: 24 * 7 },
	{ id: "30d", label: "30d", hours: 24 * 30 },
	{ id: "none", label: "Never", hours: null },
];

function toDateTimeLocalValue(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function applyExpiryPreset(preset: ExpiryPreset): void {
	activePreset.value = preset.id;
	if (preset.hours === null) {
		expiresAt.value = "";
		return;
	}
	const target = new Date(Date.now() + preset.hours * 3600 * 1000);
	expiresAt.value = toDateTimeLocalValue(target);
}

const parsedUrl = computed<URL | null>(() => {
	const value = originalUrl.value.trim();
	if (!value) return null;
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:" ? url : null;
	} catch {
		return null;
	}
});

const aliasValid = computed(() => {
	if (!customAlias.value) return true;
	return /^[a-zA-Z0-9-]+$/.test(customAlias.value);
});

const canSubmit = computed(
	() =>
		!loading.value &&
		(isAuthenticated.value || Boolean(masterPassword.value)) &&
		Boolean(originalUrl.value.trim()),
);

const previewSlug = computed(() => {
	if (result.value?.shortUrl) return result.value.shortUrl;
	return customAlias.value.trim() || "abc123";
});

const expirySummary = computed(() => {
	if (!expiresAt.value) return "No expiration";
	const date = new Date(expiresAt.value);
	if (Number.isNaN(date.getTime())) return "Custom expiry";
	return `Expires ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
});

interface PipelineCheckView {
	readonly id: string;
	readonly label: string;
	readonly tone: StatusTone;
	readonly pulse: boolean;
	readonly status: string;
	readonly statusClass: string;
}

const pipelineChecks = computed<readonly PipelineCheckView[]>(() => {
	const checks = [
		{ id: "url", label: "URL format & SSRF guard" },
		{ id: "dns", label: "DNS & private-IP guard" },
		{ id: "ssl", label: "SSL / TLS certificate" },
		{ id: "redirects", label: "Redirect chain & hop guard" },
		{ id: "phishing", label: "Phishing & homograph heuristics" },
		{ id: "malware", label: "Malware & threat feeds" },
	];

	return checks.map((check) => {
		if (loading.value) {
			return {
				...check,
				tone: "ongoing" as const,
				pulse: false,
				status: "Checking…",
				statusClass: "text-ongoing",
			};
		}

		const stageReport = lastVerification.value?.checks?.[check.id];
		if (stageReport) {
			if (!stageReport.passed) {
				return {
					...check,
					tone: "down" as const,
					pulse: false,
					status: "Blocked",
					statusClass: "text-down",
				};
			}
			if (stageReport.warnings > 0) {
				return {
					...check,
					tone: "ongoing" as const,
					pulse: false,
					status: "Warning",
					statusClass: "text-ongoing",
				};
			}
			return {
				...check,
				tone: "live" as const,
				pulse: false,
				status: "Verified",
				statusClass: "text-live",
			};
		}

		if (result.value) {
			return {
				...check,
				tone: "live" as const,
				pulse: false,
				status: "Verified",
				statusClass: "text-live",
			};
		}
		if (securityBlocked.value) {
			return {
				...check,
				tone: "down" as const,
				pulse: false,
				status: "Blocked",
				statusClass: "text-down",
			};
		}
		if (check.id === "url" && parsedUrl.value) {
			return {
				...check,
				tone: "live" as const,
				pulse: false,
				status: "Valid syntax",
				statusClass: "text-live",
			};
		}
		return {
			...check,
			tone: "idle" as const,
			pulse: false,
			status: "Queued",
			statusClass: "text-faint",
		};
	});
});

const shortLinkUrl = computed(() => {
	if (!result.value) return "";
	const baseUrl = window?.location?.origin || "http://localhost:3000";
	return `${baseUrl}/${result.value.shortUrl}`;
});

onMounted(() => {
	syncFromStorage();
	fetchRecentLinks();
});

async function fetchRecentLinks() {
	loadingRecent.value = true;
	recentError.value = "";
	try {
		const links = await fetchGet(
			"/api/links/public",
			{
				retries: 2,
				timeout: 10000,
			},
			{ limit: 6 },
		);
		recentLinks.value = Array.isArray(links) ? links : [];
	} catch (err: any) {
		console.error("Failed to fetch recent links:", err);
		recentError.value =
			err?.message || "Failed to load recent links. Please try again.";
	} finally {
		loadingRecent.value = false;
	}
}

async function createLink() {
	loading.value = true;
	error.value = "";
	securityBlocked.value = false;
	lastVerification.value = null;
	result.value = null;

	try {
		const headers: Record<string, string> = {};

		// Authenticated sessions use the HttpOnly cookie automatically; anonymous mode sends master password
		if (!isAuthenticated.value && masterPassword.value) {
			headers["x-master-password"] = masterPassword.value;
		}

		const parsedExpiresAt = expiresAt.value
			? new Date(expiresAt.value).toISOString()
			: undefined;

		const response = await fetchPost<
			CreateShortLinkResponse & { verification?: VerificationSummaryView }
		>(
			"/api/links/create",
			{
				originalUrl: originalUrl.value,
				customAlias: customAlias.value || undefined,
				expiresAt: parsedExpiresAt,
			},
			{
				headers,
				retries: 2,
				timeout: 15000,
				onError: (err) => {
					if (err instanceof FetcherError) {
						console.error("Link creation failed:", err.toString());
					}
				},
			},
		);

		result.value = response;
		lastVerification.value = response.verification ?? null;
		originalUrl.value = "";
		customAlias.value = "";
		expiresAt.value = "";
		activePreset.value = "none";

		await fetchRecentLinks();
	} catch (err: any) {
		if (err instanceof FetcherError) {
			const data = err.responseData as Record<string, unknown> | undefined;
			const message =
				err.message ||
				(typeof data?.message === "string" && data.message) ||
				"Failed to create short link";
			error.value = message;
			const nestedData = data?.data as Record<string, unknown> | undefined;
			const verificationPayload = (nestedData?.verification ??
				data?.verification) as VerificationSummaryView | undefined;
			if (verificationPayload) {
				lastVerification.value = verificationPayload;
			}
			securityBlocked.value =
				Boolean(verificationPayload) ||
				/security\s+(violation|warning|verification|risk)/i.test(message);
		} else {
			error.value = err?.message || "Failed to create short link";
		}
	} finally {
		loading.value = false;
	}
}

function copyResult() {
	copyToClipboard(shortLinkUrl.value);
}

usePageSeo({
	title: "Create Short Link",
	description:
		"Shorten and security-verify a destination URL with 6-stage phishing, malware, SSL, and DNS checks.",
	path: "/create",
});
</script>
