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

import {
	defineConfig,
	presetAttributify,
	presetIcons,
	presetTypography,
	presetWebFonts,
	presetWind,
	transformerDirectives,
	transformerVariantGroup,
} from "unocss";

export default defineConfig({
	theme: {
		colors: {
			// Base
			background: "oklch(var(--background))",
			foreground: "oklch(var(--foreground))",

			// Surfaces
			card: {
				DEFAULT: "oklch(var(--card))",
				foreground: "oklch(var(--card-foreground))",
			},
			popover: {
				DEFAULT: "oklch(var(--popover))",
				foreground: "oklch(var(--popover-foreground))",
			},

			// Brand
			primary: {
				DEFAULT: "oklch(var(--primary))",
				foreground: "oklch(var(--primary-foreground))",
			},
			secondary: {
				DEFAULT: "oklch(var(--secondary))",
				foreground: "oklch(var(--secondary-foreground))",
			},
			accent: {
				DEFAULT: "oklch(var(--accent))",
				foreground: "oklch(var(--accent-foreground))",
			},

			// UI
			muted: {
				DEFAULT: "oklch(var(--muted))",
				foreground: "oklch(var(--muted-foreground))",
			},
			destructive: {
				DEFAULT: "oklch(var(--destructive))",
				foreground: "oklch(var(--destructive-foreground))",
			},
			border: "oklch(var(--border))",
			input: "oklch(var(--input))",
			ring: "oklch(var(--ring))",

			// Charts
			chart: {
				1: "oklch(var(--chart-1))",
				2: "oklch(var(--chart-2))",
				3: "oklch(var(--chart-3))",
				4: "oklch(var(--chart-4))",
				5: "oklch(var(--chart-5))",
			},

			// Sidebar
			sidebar: {
				DEFAULT: "oklch(var(--sidebar))",
				foreground: "oklch(var(--sidebar-foreground))",
				primary: "oklch(var(--sidebar-primary))",
				"primary-foreground": "oklch(var(--sidebar-primary-foreground))",
				accent: "oklch(var(--sidebar-accent))",
				"accent-foreground": "oklch(var(--sidebar-accent-foreground))",
				border: "oklch(var(--sidebar-border))",
				ring: "oklch(var(--sidebar-ring))",
			},
		},
		borderRadius: {
			sm: "calc(var(--radius) - 4px)",
			DEFAULT: "calc(var(--radius) - 2px)",
			md: "calc(var(--radius) - 2px)",
			lg: "var(--radius)",
			xl: "calc(var(--radius) + 4px)",
		},
		animation: {
			"accordion-down": "accordion-down 0.2s ease-out",
			"accordion-up": "accordion-up 0.2s ease-out",
			scroll:
				"scroll var(--animation-duration, 40s) var(--animation-direction, forwards) linear infinite",
			"pop-blob": "pop-blob 5s infinite",
			rotate: "rotate 2s linear infinite",
		},
		keyframes: {
			"accordion-down": {
				from: { height: "0" },
				to: { height: "var(--radix-accordion-content-height)" },
			},
			"accordion-up": {
				from: { height: "var(--radix-accordion-content-height)" },
				to: { height: "0" },
			},
			scroll: {
				to: { transform: "translate(calc(-50% - 0.5rem))" },
			},
			"pop-blob": {
				"0%": { transform: "scale(1)" },
				"33%": { transform: "scale(1.2)" },
				"66%": { transform: "scale(0.8)" },
				"100%": { transform: "scale(1)" },
			},
			rotate: {
				from: { transform: "rotate(0deg)" },
				to: { transform: "rotate(360deg)" },
			},
		},
	},
	shortcuts: [
		{
			// Button variants
			btn: "px-4 py-2 rounded-lg inline-flex items-center justify-center font-medium transition-colors",
			"btn-primary":
				"btn bg-primary text-primary-foreground hover:bg-primary/90",
			"btn-secondary":
				"btn bg-secondary text-secondary-foreground hover:bg-secondary/80",
			"btn-destructive":
				"btn bg-destructive text-destructive-foreground hover:bg-destructive/90",
			"btn-outline":
				"btn border border-input bg-background hover:bg-accent hover:text-accent-foreground",
			"btn-ghost": "btn hover:bg-accent hover:text-accent-foreground",

			// Icon button
			"icon-btn":
				"inline-flex cursor-pointer select-none items-center justify-center opacity-75 transition duration-200 ease-in-out hover:opacity-100 hover:text-primary",

			// Card
			card: "rounded-lg border border-border bg-card text-card-foreground shadow-sm",

			// Input
			input:
				"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",

			// Custom scrollbar
			"custom-scrollbar":
				"scrollbar-thin scrollbar-track-transparent scrollbar-thumb-primary/30 hover:scrollbar-thumb-primary/50",
		},
	],
	presets: [
		presetWind(),
		presetAttributify(),
		presetIcons({
			scale: 1.2,
			extraProperties: {
				display: "inline-block",
				"vertical-align": "middle",
			},
		}),
		presetTypography(),
		presetWebFonts({
			fonts: {
				sans: "DM Sans",
				serif: "DM Serif Display",
				mono: "DM Mono",
			},
		}),
	],
	transformers: [transformerDirectives(), transformerVariantGroup()],
	safelist: [
		// Ensure dark mode classes are included
		"dark",
		// Color variants
		...["primary", "secondary", "accent", "destructive", "muted"].flatMap(
			(color) => [
				`bg-${color}`,
				`text-${color}`,
				`border-${color}`,
				`hover:bg-${color}`,
				`hover:text-${color}`,
			],
		),
	],
});
