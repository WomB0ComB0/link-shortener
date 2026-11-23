/**
 * Copyright 2026 Mike Odnis
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

/**
 * Live Console OpenGraph cards (Satori VNode trees) matching `mikeodnis.dev`
 * pixel-for-pixel: tinted-black canvas with corner brand glows, `surface-1`
 * gradient tiles with hairline borders, Geist & Geist Mono typography, wolf mark,
 * and periwinkle/live-green accents.
 */

import {
	SITE_FULL_NAME,
	SITE_HOST,
	SITE_ROLE,
	SITE_TAGLINE,
	SITE_TITLE,
} from "./constants";
import { OG_PALETTE as C, OG_TINTS as T } from "./palette";
import { fitDescription, fitTitle } from "./text";
import { createWolfMarkNode, type SatoriNode } from "./wolf-mark";

const SANS = "Geist";
const MONO = "Geist Mono";

type Style = Record<string, string | number>;
type Child = SatoriNode | string | null | undefined;

function div(style: Style, children?: Child | readonly Child[]): SatoriNode {
	const filtered = Array.isArray(children)
		? children.filter((c): c is SatoriNode | string => c !== null && c !== undefined)
		: children ?? undefined;
	return {
		type: "div",
		props: {
			style,
			...(filtered !== undefined ? { children: filtered } : {}),
		},
	};
}

const CANVAS: Style = {
	display: "flex",
	width: "100%",
	height: "100%",
	padding: 40,
	gap: 24,
	backgroundColor: C.canvas,
	backgroundImage: `radial-gradient(circle at 12% 0%, ${T["brand-glow"]} 0%, transparent 48%), radial-gradient(circle at 100% 100%, ${T["brand-glow"]} 0%, transparent 42%)`,
	color: C.fg,
	fontFamily: SANS,
};

const TILE: Style = {
	display: "flex",
	flexDirection: "column",
	borderRadius: 28,
	border: `1px solid ${C.hairline}`,
	backgroundColor: C["surface-1"],
	backgroundImage: `linear-gradient(160deg, ${C["surface-2"]} 0%, ${C["surface-1"]} 62%)`,
};

function markBadge(size: number): SatoriNode {
	return div(
		{
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			width: size,
			height: size,
			borderRadius: size / 4,
			border: `1px solid ${C.hairline}`,
			backgroundColor: C.canvas,
		},
		createWolfMarkNode(Math.round(size * 0.66)),
	);
}

function arrowUpRight(): SatoriNode {
	return {
		type: "svg",
		props: {
			width: 18,
			height: 18,
			viewBox: "0 0 24 24",
			fill: "none",
			stroke: C.fg,
			strokeWidth: 2,
			strokeLinecap: "round",
			strokeLinejoin: "round",
			children: [
				{ type: "path", props: { d: "M7 7h10v10" } },
				{ type: "path", props: { d: "M7 17 17 7" } },
			],
		},
	};
}

function heroPills(): SatoriNode {
	const pill: Style = {
		display: "flex",
		alignItems: "center",
		gap: 6,
		height: 50,
		padding: "0 20px",
		borderRadius: 999,
		fontSize: 20,
		fontWeight: 500,
		whiteSpace: "nowrap",
	};
	const ghost: Style = {
		...pill,
		border: `1px solid ${C.hairline}`,
		color: C.fg,
	};
	return div({ display: "flex", gap: 10 }, [
		div(
			{
				...pill,
				padding: "0 24px",
				backgroundColor: C.brand,
				color: C.canvas,
			},
			"Create link",
		),
		div(ghost, "Dashboard"),
		div(ghost, "API Keys"),
		div(ghost, ["Portfolio", arrowUpRight()]),
	]);
}

interface IndexRow {
	readonly label: string;
	readonly path: string;
	readonly live?: boolean;
}

const SITE_INDEX: readonly IndexRow[] = [
	{ label: "Create", path: "/create" },
	{ label: "Dashboard", path: "/dashboard" },
	{ label: "API Keys", path: "/keys" },
	{ label: "Verify", path: "/api/security/verify" },
	{ label: "Health", path: "/api/health", live: true },
];

function liveBadge(): SatoriNode {
	return div(
		{
			display: "flex",
			alignItems: "center",
			gap: 8,
			padding: "4px 12px",
			borderRadius: 999,
			backgroundColor: T["live-tint"],
			color: C.live,
			fontFamily: MONO,
			fontSize: 16,
		},
		[
			div({
				width: 9,
				height: 9,
				borderRadius: 999,
				backgroundColor: C.live,
			}),
			"live",
		],
	);
}

function indexTile(): SatoriNode {
	return div({ ...TILE, width: 336, padding: "30px 30px 14px" }, [
		div(
			{
				display: "flex",
				color: C["fg-muted"],
				fontSize: 18,
				marginBottom: 10,
			},
			"Route index",
		),
		...SITE_INDEX.map((row, index) =>
			div(
				{
					display: "flex",
					flexDirection: "column",
					gap: 6,
					padding: "16px 0",
					borderTop: index === 0 ? "none" : `1px solid ${C.hairline}`,
				},
				[
					div({ display: "flex", alignItems: "center", gap: 12 }, [
						div({ display: "flex", fontSize: 25, fontWeight: 500 }, row.label),
						row.live ? liveBadge() : null,
					]),
					div(
						{
							display: "flex",
							fontFamily: MONO,
							fontSize: 16,
							color: C["fg-faint"],
						},
						row.path,
					),
				],
			),
		),
	]);
}

/** Site-level OpenGraph card (`/opengraph-image`, `/twitter-image`, and `/api/og` default). */
export function createSiteCard(): SatoriNode {
	return div(CANVAS, [
		div(
			{
				...TILE,
				flex: 1,
				padding: "48px 56px",
				justifyContent: "space-between",
			},
			[
				div({ display: "flex", alignItems: "center", gap: 20 }, [
					markBadge(72),
					div(
						{
							display: "flex",
							fontFamily: MONO,
							fontSize: 22,
							color: C["fg-faint"],
						},
						SITE_HOST,
					),
				]),
				div({ display: "flex", flexDirection: "column" }, [
					div(
						{
							display: "flex",
							fontSize: 112,
							fontWeight: 600,
							letterSpacing: "-0.04em",
							lineHeight: 1,
						},
						SITE_TITLE,
					),
					div(
						{
							display: "flex",
							marginTop: 28,
							fontSize: 38,
							fontWeight: 500,
						},
						SITE_ROLE,
					),
					div(
						{
							display: "flex",
							marginTop: 10,
							fontSize: 30,
							color: C["fg-muted"],
						},
						SITE_TAGLINE,
					),
				]),
				heroPills(),
			],
		),
		indexTile(),
	]);
}

export interface PageCardProps {
	readonly title: string;
	readonly description: string;
}

/** Dynamic per-page OpenGraph card (`/api/og?title=...&description=...`). */
export function createPageCard({ title, description }: PageCardProps): SatoriNode {
	const fitted = fitTitle(title);
	const body = fitDescription(description, fitted);

	return div(CANVAS, [
		div({ ...TILE, flex: 1, padding: "48px 60px" }, [
			div(
				{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
				},
				[
					div({ display: "flex", alignItems: "center", gap: 18 }, [
						markBadge(64),
						div({ display: "flex", flexDirection: "column", gap: 4 }, [
							div(
								{ display: "flex", fontSize: 26, fontWeight: 600 },
								SITE_FULL_NAME,
							),
							div(
								{
									display: "flex",
									fontFamily: MONO,
									fontSize: 17,
									color: C["fg-faint"],
								},
								SITE_ROLE,
							),
						]),
					]),
					div(
						{
							display: "flex",
							padding: "10px 20px",
							borderRadius: 999,
							border: `1px solid ${T["brand-edge"]}`,
							backgroundColor: T["brand-wash"],
							color: C["brand-ink"],
							fontFamily: MONO,
							fontSize: 20,
						},
						SITE_HOST,
					),
				],
			),
			div(
				{
					display: "flex",
					flexDirection: "column",
					flex: 1,
					justifyContent: "center",
					paddingTop: 28,
				},
				[
					div(
						{
							display: "flex",
							fontSize: fitted.fontSize,
							fontWeight: 600,
							letterSpacing: "-0.035em",
							lineHeight: 1.05,
						},
						fitted.text,
					),
					div(
						{
							display: "flex",
							marginTop: 24,
							maxWidth: 920,
							fontSize: 30,
							lineHeight: 1.4,
							color: C["fg-muted"],
						},
						body,
					),
				],
			),
		]),
	]);
}
