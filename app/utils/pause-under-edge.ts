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

export const UNDER_EDGE_ATTRIBUTE = "data-under-edge";
export const UNDER_EDGE_INK_OUTSET = 64;

const PAUSABLE_ANIMATION = /^(?:pulse|ping|live-pulse|light-ray)$/;
const BLUR_QUERIES = [
	"(prefers-reduced-transparency: reduce)",
	"(forced-colors: active)",
] as const;

type Edge = "top" | "bottom";
const EDGES: readonly Edge[] = ["top", "bottom"];

export interface Overlap {
	readonly top: boolean;
	readonly bottom: boolean;
}

const CLEAR: Overlap = { top: false, bottom: false };

export interface PageScroll {
	readonly scrollY: number;
	readonly maxScroll: number;
}

export function isPausableAnimation(animationName: string): boolean {
	return PAUSABLE_ANIMATION.test(animationName);
}

export function bandsShowing({ scrollY, maxScroll }: PageScroll): Overlap {
	if (maxScroll <= 0) return CLEAR;
	return { top: scrollY > 0, bottom: scrollY < maxScroll };
}

const pageScroll = (): PageScroll => ({
	scrollY: window.scrollY,
	maxScroll: document.documentElement.scrollHeight - window.innerHeight,
});

const underShownBand = (overlap: Overlap, showing: Overlap): boolean =>
	(overlap.top && showing.top) || (overlap.bottom && showing.bottom);

function blurs(haze: HTMLElement): boolean {
	const layer = haze.querySelector(".l");
	return (
		layer !== null &&
		getComputedStyle(haze).display !== "none" &&
		getComputedStyle(layer).display !== "none"
	);
}

function bandMargins(
	topEnd: number,
	bottomStart: number,
	windowHeight: number,
): Readonly<Record<Edge, string>> {
	return {
		top: `${UNDER_EDGE_INK_OUTSET}px 0px ${-(windowHeight - topEnd)}px 0px`,
		bottom: `${-bottomStart}px 0px 0px 0px`,
	};
}

interface BandObservers {
	readonly observe: (element: Element) => void;
	readonly unobserve: (element: Element) => void;
	readonly disconnect: () => void;
}

type OnBandEntries = (
	edge: Edge,
	entries: readonly IntersectionObserverEntry[],
) => void;

function createBandObservers(
	haze: HTMLElement,
	onEntries: OnBandEntries,
): BandObservers | null {
	const top = haze.querySelector(":scope > .t");
	const bottom = haze.querySelector(":scope > .b");
	if (!top || !bottom || !blurs(haze)) return null;
	const margins = bandMargins(
		top.getBoundingClientRect().bottom,
		bottom.getBoundingClientRect().top,
		window.innerHeight,
	);
	const observers = EDGES.map(
		(edge) =>
			new IntersectionObserver((entries) => onEntries(edge, entries), {
				rootMargin: margins[edge],
			}),
	);
	return {
		observe: (element) => {
			for (const observer of observers) observer.observe(element);
		},
		unobserve: (element) => {
			for (const observer of observers) observer.unobserve(element);
		},
		disconnect: () => {
			for (const observer of observers) observer.disconnect();
		},
	};
}

interface WatchState {
	readonly haze: HTMLElement;
	readonly watched: Map<Element, Overlap>;
	bands: BandObservers | null;
	showing: Overlap;
}

function mark(state: WatchState, element: Element, overlap: Overlap): void {
	state.watched.set(element, overlap);
	element.toggleAttribute(
		UNDER_EDGE_ATTRIBUTE,
		underShownBand(overlap, state.showing),
	);
}

function reshow(state: WatchState): void {
	const showing = bandsShowing(pageScroll());
	if (
		showing.top === state.showing.top &&
		showing.bottom === state.showing.bottom
	)
		return;
	state.showing = showing;
	for (const [element, overlap] of [...state.watched])
		mark(state, element, overlap);
}

function forget(state: WatchState, element: Element): void {
	state.bands?.unobserve(element);
	element.removeAttribute(UNDER_EDGE_ATTRIBUTE);
	state.watched.delete(element);
}

function sweep(state: WatchState): void {
	for (const element of [...state.watched.keys()]) {
		if (!element.isConnected) forget(state, element);
	}
}

function onBandEntries(
	state: WatchState,
	edge: Edge,
	entries: readonly IntersectionObserverEntry[],
): void {
	sweep(state);
	for (const { target, isIntersecting } of entries) {
		const overlap = state.watched.get(target);
		if (overlap) mark(state, target, { ...overlap, [edge]: isIntersecting });
	}
}

function connect(state: WatchState): void {
	state.bands?.disconnect();
	state.bands = null;
	state.showing = bandsShowing(pageScroll());
	sweep(state);
	for (const element of state.watched.keys()) mark(state, element, CLEAR);
	state.bands = createBandObservers(state.haze, (edge, entries) =>
		onBandEntries(state, edge, entries),
	);
	for (const element of state.watched.keys()) state.bands?.observe(element);
}

function watch(state: WatchState, element: Element): void {
	if (state.watched.has(element) || state.haze.contains(element)) return;
	sweep(state);
	state.watched.set(element, CLEAR);
	state.bands?.observe(element);
}

function release(state: WatchState): void {
	state.bands?.disconnect();
	state.bands = null;
	for (const element of state.watched.keys())
		element.removeAttribute(UNDER_EDGE_ATTRIBUTE);
	state.watched.clear();
}

interface FrameTask {
	readonly schedule: () => void;
	readonly cancel: () => void;
}

function oncePerFrame(callback: () => void): FrameTask {
	let frame = 0;
	return {
		schedule: () => {
			if (frame !== 0) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				callback();
			});
		},
		cancel: () => {
			cancelAnimationFrame(frame);
			frame = 0;
		},
	};
}

interface RunningAnimation {
	readonly animationName?: string;
	readonly effect?: {
		readonly target?: Element | null;
		readonly pseudoElement?: string | null;
	} | null;
}

function runningTargets(): Element[] {
	if (typeof document.getAnimations !== "function") return [];
	return (document.getAnimations() as RunningAnimation[]).flatMap(
		(animation) => {
			const target = animation.effect?.target;
			const pausable = isPausableAnimation(animation.animationName ?? "");
			return pausable && target && !animation.effect?.pseudoElement
				? [target]
				: [];
		},
	);
}

export interface UnderEdgeWatch {
	readonly sweep: () => void;
	readonly stop: () => void;
}

function followScroll(state: WatchState): () => void {
	const task = oncePerFrame(() => reshow(state));
	const pageSize =
		typeof ResizeObserver === "function"
			? new ResizeObserver(task.schedule)
			: null;

	window.addEventListener("scroll", task.schedule, { passive: true });
	pageSize?.observe(document.body);

	return () => {
		window.removeEventListener("scroll", task.schedule);
		pageSize?.disconnect();
		task.cancel();
	};
}

export function pauseAnimationsUnderEdge(haze: HTMLElement): UnderEdgeWatch {
	const state: WatchState = {
		haze,
		watched: new Map(),
		bands: null,
		showing: CLEAR,
	};
	const onAnimationStart = (event: AnimationEvent): void => {
		if (event.pseudoElement || !isPausableAnimation(event.animationName))
			return;
		if (event.target instanceof Element) watch(state, event.target);
	};
	const remeasure = oncePerFrame(() => connect(state));
	const queries = BLUR_QUERIES.map((query) => window.matchMedia(query));

	document.addEventListener("animationstart", onAnimationStart, true);
	window.addEventListener("resize", remeasure.schedule);
	for (const query of queries)
		query.addEventListener("change", remeasure.schedule);
	const unfollow = followScroll(state);
	for (const element of runningTargets()) watch(state, element);
	connect(state);

	return {
		sweep: () => sweep(state),
		stop: () => {
			document.removeEventListener("animationstart", onAnimationStart, true);
			window.removeEventListener("resize", remeasure.schedule);
			for (const query of queries)
				query.removeEventListener("change", remeasure.schedule);
			remeasure.cancel();
			unfollow();
			release(state);
		},
	};
}
