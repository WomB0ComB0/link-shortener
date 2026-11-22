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
	<header
		class="sticky top-0 z-10 border-b border-hairline bg-canvas/85 backdrop-blur-md"
	>
		<div class="mx-auto max-w-shell px-(--page-gutter)">
			<div class="flex h-16 items-center justify-between gap-4">
				<NuxtLink to="/" class="flex shrink-0 items-center gap-2.5 text-foreground">
					<div
						class="flex size-8 items-center justify-center rounded-md border border-hairline bg-surface-2"
					>
						<img src="/assets/images/logo.png" alt="Links" class="h-5 w-auto" />
					</div>
					<span class="tile-title hidden text-foreground sm:block">Links</span>
				</NuxtLink>
				<nav class="flex flex-wrap items-center justify-end gap-2">
					<slot name="nav" />
				</nav>
			</div>
		</div>
	</header>
</template>
