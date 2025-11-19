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

<script setup lang="ts">
import type { NuxtError } from "nuxt/app";

defineProps<{
	error: NuxtError;
}>();

useSeoMeta({
	title: "Page not found",
	description: "We are sorry but this page could not be found.",
});

useHead({
	htmlAttrs: {
		lang: "en",
	},
});
</script>

<template>
    <UApp>
        <UError :error="error" />
    </UApp>
</template>
