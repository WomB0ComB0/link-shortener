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

type App = {
	name: string;
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
	name: "appName",
	description: "appDescription",
	scope: "/",
	base: "/",
	registerType: "autoUpdate",
	manifest: {
		id: "/",
		scope: "/",
		name: "appName",
		short_name: "appName",
		description: "appDescription",
	},
};
