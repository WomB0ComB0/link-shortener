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
	<div class="flex flex-1 items-center justify-center px-(--page-gutter) py-8 md:py-16">
		<div class="grid w-full max-w-4xl items-stretch gap-4 md:grid-cols-12">
			<!-- Left Console Context Tile -->
			<aside
				class="hidden flex-col justify-between overflow-hidden rounded-tile border border-hairline bg-surface-1 p-6 shadow-tile md:col-span-5 md:flex"
			>
				<div>
					<p class="tile-label text-muted-foreground">links.mikeodnis.dev</p>
					<h2 class="mt-2 tile-title-lg text-foreground">
						Personal Redirect Console
					</h2>
					<p class="mt-2 tile-sub text-muted-foreground">
						One account unlocks verified link creation, click telemetry, and scoped developer API keys.
					</p>

					<ul class="mt-6 space-y-3 border-t border-hairline pt-5">
						<li class="flex items-start gap-3">
							<span
								class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-2 text-brand-ink"
							>
								<UIcon name="i-heroicons-shield-check" class="size-4" aria-hidden="true" />
							</span>
							<div class="min-w-0">
								<p class="tile-label text-foreground">6-stage strict URL verification</p>
								<p class="mt-0.5 tile-meta text-muted-foreground">
									SSRF, DNS, SSL, redirect-chain, phishing &amp; malware checks
								</p>
							</div>
						</li>
						<li class="flex items-start gap-3">
							<span
								class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-2 text-brand-ink"
							>
								<UIcon name="i-heroicons-chart-bar" class="size-4" aria-hidden="true" />
							</span>
							<div class="min-w-0">
								<p class="tile-label text-foreground">Real-time click analytics</p>
								<p class="mt-0.5 tile-meta text-muted-foreground">
									Inspect timestamps, regions, referrers, and user agents
								</p>
							</div>
						</li>
						<li class="flex items-start gap-3">
							<span
								class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-2 text-brand-ink"
							>
								<UIcon name="i-heroicons-key" class="size-4" aria-hidden="true" />
							</span>
							<div class="min-w-0">
								<p class="tile-label text-foreground">Scoped API keys</p>
								<p class="mt-0.5 tile-meta text-muted-foreground">
									Automate short links from CI, scripts, or other subdomains
								</p>
							</div>
						</li>
					</ul>
				</div>

				<div class="mt-6 flex items-center justify-between border-t border-hairline pt-4 tile-meta text-faint">
					<span class="inline-flex items-center gap-1.5 text-live">
						<StatusDot tone="live" pulse />
						<span>Console online</span>
					</span>
					<span class="mono-token">HttpOnly · HS256</span>
				</div>
			</aside>

			<!-- Right Auth Form Tile -->
			<section
				aria-labelledby="auth-heading"
				class="overflow-hidden rounded-tile border border-hairline bg-surface-1 shadow-raised md:col-span-7"
			>
				<div
					class="border-b border-hairline bg-[linear-gradient(160deg,var(--brand-wash),transparent_60%)] px-6 py-5"
				>
					<div class="flex items-center justify-between gap-2">
						<p class="tile-label text-muted-foreground">Account</p>
						<span class="mono-token rounded bg-surface-2 px-2 py-0.5 text-faint">
							{{ isLogin ? "Sign in" : "Register" }}
						</span>
					</div>
					<h1 id="auth-heading" class="mt-1.5 tile-title-lg text-foreground">
						{{ isLogin ? "Welcome Back" : "Create Account" }}
					</h1>
					<p class="mt-1 tile-sub text-muted-foreground">
						{{
							isLogin
								? "Sign in to manage links, analytics, and API keys."
								: "Create an account to unlock your personal link console."
						}}
					</p>
				</div>

				<form class="space-y-4 p-6 sm:p-7" @submit.prevent="handleSubmit">
					<div>
						<label for="email" class="mb-1.5 block tile-label text-foreground">
							Email <span class="text-down">*</span>
						</label>
						<div class="console-field-shell">
							<span class="flex items-center pl-3 text-faint" aria-hidden="true">
								<UIcon name="i-heroicons-envelope" class="size-4" />
							</span>
							<input
								id="email"
								v-model="email"
								type="email"
								placeholder="you@example.com"
								:disabled="loading"
								autocomplete="email"
							/>
						</div>
					</div>

					<div>
						<label for="password" class="mb-1.5 block tile-label text-foreground">
							Password <span class="text-down">*</span>
						</label>
						<div class="console-field-shell">
							<span class="flex items-center pl-3 text-faint" aria-hidden="true">
								<UIcon name="i-heroicons-lock-closed" class="size-4" />
							</span>
							<input
								id="password"
								v-model="password"
								:type="showPassword ? 'text' : 'password'"
								placeholder="••••••••"
								:disabled="loading"
								:autocomplete="isLogin ? 'current-password' : 'new-password'"
							/>
							<button
								type="button"
								class="flex cursor-pointer items-center px-3 text-faint transition-colors hover:text-foreground"
								:aria-label="showPassword ? 'Hide secret' : 'Reveal secret'"
								:aria-pressed="showPassword"
								@click="showPassword = !showPassword"
							>
								<UIcon
									:name="showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
									class="size-4"
									aria-hidden="true"
								/>
							</button>
						</div>

						<!-- Live password checklist on registration -->
						<div v-if="!isLogin" class="mt-2.5 flex flex-wrap gap-1.5">
							<span
								v-for="rule in passwordRules"
								:key="rule.label"
								class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 mono-token transition-colors"
								:class="
									rule.met
										? 'border-live/30 bg-live-tint text-live'
										: 'border-hairline bg-surface-2 text-faint'
								"
							>
								<StatusDot :tone="rule.met ? 'live' : 'idle'" />
								<span>{{ rule.label }}</span>
							</span>
						</div>
					</div>

					<div v-if="!isLogin">
						<label for="displayName" class="mb-1.5 block tile-label text-foreground">
							Display Name <span class="text-faint">(Optional)</span>
						</label>
						<div class="console-field-shell">
							<span class="flex items-center pl-3 text-faint" aria-hidden="true">
								<UIcon name="i-heroicons-user" class="size-4" />
							</span>
							<input
								id="displayName"
								v-model="displayName"
								type="text"
								placeholder="Your Name"
								:disabled="loading"
								autocomplete="name"
							/>
						</div>
					</div>

					<div
						v-if="error"
						role="alert"
						class="flex items-start gap-2.5 rounded-lg border border-down/30 bg-down-tint p-3.5 text-body-sm text-down"
					>
						<UIcon
							name="i-heroicons-exclamation-circle"
							class="mt-0.5 size-4 shrink-0"
							aria-hidden="true"
						/>
						<span>{{ error }}</span>
					</div>

					<div class="flex flex-col gap-2.5 pt-2">
						<button
							type="submit"
							:disabled="loading || !email || !password"
							class="console-btn console-btn-primary h-11 w-full"
						>
							<UIcon
								v-if="loading"
								name="i-heroicons-arrow-path"
								class="size-4 animate-spin"
								aria-hidden="true"
							/>
							<span>{{ isLogin ? "Login" : "Create Account" }}</span>
						</button>

						<div class="border-t border-hairline pt-2.5">
							<button
								type="button"
								:disabled="loading"
								class="console-btn console-btn-ghost w-full text-brand-ink"
								@click="toggleMode"
							>
								{{
									isLogin
										? "Don't have an account? Sign up"
										: "Already have an account? Login"
								}}
							</button>
						</div>
					</div>
				</form>
			</section>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { computed, ref } from "vue";
import { useAuth, useFetcher } from "../composables";

const { post: fetchPost, FetcherError } = useFetcher();
const { setSession } = useAuth();
const router = useRouter();
const isLogin = ref(true);
const loading = ref(false);
const error = ref("");

const email = ref("");
const password = ref("");
const displayName = ref("");
const showPassword = ref(false);

const passwordRules = computed(() => [
	{ label: "8+ chars", met: password.value.length >= 8 },
	{ label: "Uppercase", met: /[A-Z]/.test(password.value) },
	{ label: "Lowercase", met: /[a-z]/.test(password.value) },
	{ label: "Number", met: /\d/.test(password.value) },
]);

function toggleMode() {
	isLogin.value = !isLogin.value;
	error.value = "";
}

async function handleSubmit() {
	loading.value = true;
	error.value = "";

	try {
		const endpoint = isLogin.value ? "/api/auth/login" : "/api/auth/register";

		const response = await fetchPost<{ user: any; token: string }>(
			endpoint,
			isLogin.value
				? { email: email.value, password: password.value }
				: {
						email: email.value,
						password: password.value,
						displayName: displayName.value || undefined,
					},
			{
				retries: 1,
				timeout: 10000,
			},
		);

		setSession(response.user);
		router.push("/dashboard");
	} catch (err: any) {
		if (err instanceof FetcherError) {
			const data = err.responseData as Record<string, unknown> | undefined;
			error.value =
				err.message ||
				(typeof data?.message === "string" && data.message) ||
				"Authentication failed";
		} else {
			error.value = err?.message || "Authentication failed";
		}
	} finally {
		loading.value = false;
	}
}

usePageSeo({
	title: "Sign In",
	description:
		"Sign in or create an account to manage short links, custom aliases, and API keys.",
	path: "/auth",
});
</script>
