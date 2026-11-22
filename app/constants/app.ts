/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export interface EcosystemLink {
	readonly id: string;
	readonly name: string;
	readonly host: string;
	readonly url: string;
	readonly description: string;
	readonly icon: string;
	readonly group: "network" | "ventures";
	readonly current?: boolean;
}

export const ECOSYSTEM_LINKS: readonly EcosystemLink[] = [
	{
		id: "portfolio",
		name: "Portfolio",
		host: "mikeodnis.dev",
		url: "https://mikeodnis.dev",
		description: "Live Console hub, projects, and telemetry",
		icon: "i-heroicons-home",
		group: "network",
	},
	{
		id: "links",
		name: "Links",
		host: "links.mikeodnis.dev",
		url: "https://links.mikeodnis.dev",
		description: "Verified short links and click analytics",
		icon: "i-heroicons-link",
		group: "network",
		current: true,
	},
	{
		id: "blog",
		name: "Blog",
		host: "blog.mikeodnis.dev",
		url: "https://blog.mikeodnis.dev",
		description: "Writing and engineering notes",
		icon: "i-heroicons-document-text",
		group: "network",
	},
	{
		id: "news",
		name: "News",
		host: "news.mikeodnis.dev",
		url: "https://news.mikeodnis.dev",
		description: "Curated tech feed and dispatches",
		icon: "i-heroicons-newspaper",
		group: "network",
	},
	{
		id: "api",
		name: "API",
		host: "api.mikeodnis.dev",
		url: "https://api.mikeodnis.dev",
		description: "Shared platform API gateway",
		icon: "i-heroicons-cpu-chip",
		group: "network",
	},
	{
		id: "cdn",
		name: "CDN",
		host: "cdn.mikeodnis.dev",
		url: "https://cdn.mikeodnis.dev",
		description: "Static media and asset delivery",
		icon: "i-heroicons-cloud",
		group: "network",
	},
	{
		id: "status",
		name: "Status",
		host: "status.mikeodnis.dev",
		url: "https://status.mikeodnis.dev",
		description: "Live uptime and service health",
		icon: "i-heroicons-signal",
		group: "network",
	},
	{
		id: "sponsor",
		name: "Sponsor",
		host: "mikeodnis.dev/sponsor",
		url: "https://mikeodnis.dev/sponsor",
		description: "Support open-source engineering",
		icon: "i-heroicons-heart",
		group: "network",
	},
	{
		id: "oss",
		name: "Elysium Tools",
		host: "elysium.tools",
		url: "https://elysium.tools",
		description: "Open-source developer tooling",
		icon: "i-heroicons-code-bracket",
		group: "ventures",
	},
	{
		id: "freelance",
		name: "Atroviola",
		host: "atroviola.com",
		url: "https://atroviola.com",
		description: "Freelance engineering and studio",
		icon: "i-heroicons-briefcase",
		group: "ventures",
	},
];

type App = {
	name: string;
	shortName: string;
	host: string;
	url: string;
	description: string;
	scope: string;
	base: string;
	registerType: string;
	manifest: {
		id: string;
		scope: string;
		name: string;
		short_name: string;
		description: string;
	};
};

export const app: App = {
	name: "Links — Mike Odnis",
	shortName: "Links",
	host: "links.mikeodnis.dev",
	url: "https://links.mikeodnis.dev",
	description:
		"Fast, security-verified short links with click analytics on links.mikeodnis.dev.",
	scope: "/",
	base: "/",
	registerType: "autoUpdate",
	manifest: {
		id: "/",
		scope: "/",
		name: "Links — Mike Odnis",
		short_name: "Links",
		description:
			"Fast, security-verified short links with click analytics on links.mikeodnis.dev.",
	},
};
