#!/usr/bin/env node
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

import { createHash } from "node:crypto";
import { createInterface } from "node:readline/promises";

const rl = createInterface({
	input: process.stdin,
	output: process.stdout,
});

console.log("=".repeat(60));
console.log("Master Password Hash Generator");
console.log("=".repeat(60));
console.log();

try {
	const password = await rl.question("Enter your master password: ");

	if (!password || password.length < 8) {
		console.error("\n❌ Error: Password must be at least 8 characters long");
		process.exit(1);
	}

	const hash = createHash("sha256").update(password).digest("hex");

	console.log();
	console.log("✅ Password hash generated successfully!");
	console.log();
	console.log("Add this to your .env file:");
	console.log("-".repeat(60));
	console.log(`MASTER_PASSWORD_HASH=${hash}`);
	console.log("-".repeat(60));
	console.log();
	console.log(
		"⚠️  IMPORTANT: Keep this hash secret and never commit it to version control!",
	);
	console.log();
} catch (error) {
	console.error("\n❌ Error:", error.message);
	process.exit(1);
} finally {
	rl.close();
}
