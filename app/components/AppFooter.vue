<!--
 Copyright 2026 Mike Odnis

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
	<footer
		class="mx-auto mt-auto w-full max-w-shell border-t border-hairline px-(--page-gutter) py-6"
	>
		<div
			class="flex flex-col items-center gap-3 font-mono text-meta text-muted-foreground sm:flex-row sm:justify-between"
		>
			<p class="m-0 text-center font-mono text-meta sm:text-left">
				<a
					class="text-brand-ink underline decoration-dotted underline-offset-4 transition-colors duration-(--motion-fast) ease-standard hover:text-foreground"
					href="https://github.com/WomB0ComB0/link-shortener/blob/master/LICENSE"
					target="_blank"
					rel="noopener noreferrer"
				>
					Apache-2.0
				</a>
				2025-present &#169;
				<a
					class="text-brand-ink underline decoration-dotted underline-offset-4 transition-colors duration-(--motion-fast) ease-standard hover:text-foreground"
					href="https://github.com/WomB0ComB0"
					target="_blank"
					rel="noopener noreferrer"
				>
					Mike Odnis
				</a>
			</p>

			<div class="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
				<nav class="flex flex-wrap justify-center gap-2 sm:gap-3" aria-label="Ecosystem links">
					<a
						class="text-brand-ink underline decoration-dotted underline-offset-4 transition-colors duration-(--motion-fast) ease-standard hover:text-foreground"
						href="https://mikeodnis.dev"
						target="_blank"
						rel="noopener noreferrer"
					>
						Portfolio
					</a>
					<span aria-hidden="true" class="hidden text-faint sm:inline">•</span>
					<a
						class="text-brand-ink underline decoration-dotted underline-offset-4 transition-colors duration-(--motion-fast) ease-standard hover:text-foreground"
						href="https://blog.mikeodnis.dev"
						target="_blank"
						rel="noopener noreferrer"
					>
						Blog
					</a>
					<span aria-hidden="true" class="hidden text-faint sm:inline">•</span>
					<a
						class="text-brand-ink underline decoration-dotted underline-offset-4 transition-colors duration-(--motion-fast) ease-standard hover:text-foreground"
						href="https://news.mikeodnis.dev"
						target="_blank"
						rel="noopener noreferrer"
					>
						News
					</a>
					<span aria-hidden="true" class="hidden text-faint sm:inline">•</span>
					<a
						class="text-brand-ink underline decoration-dotted underline-offset-4 transition-colors duration-(--motion-fast) ease-standard hover:text-foreground"
						href="https://api.mikeodnis.dev"
						target="_blank"
						rel="noopener noreferrer"
					>
						API
					</a>
					<span aria-hidden="true" class="hidden text-faint sm:inline">•</span>
					<a
						class="text-brand-ink underline decoration-dotted underline-offset-4 transition-colors duration-(--motion-fast) ease-standard hover:text-foreground"
						href="https://elysium.tools"
						target="_blank"
						rel="noopener noreferrer"
					>
						OSS
					</a>
				</nav>

				<span aria-hidden="true" class="hidden text-faint sm:inline">•</span>

				<a
					href="https://status.mikeodnis.dev"
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-2 rounded-full border border-hairline px-3 py-1 text-body-sm font-medium text-foreground transition-colors duration-(--motion-fast) ease-standard hover:border-hairline-strong hover:bg-surface-2"
				>
					<StatusDot tone="live" />
					<span>Status</span>
				</a>
			</div>
		</div>
	</footer>
</template>
