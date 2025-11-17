/**
 * Upstash Redis client singleton for serverless-compatible Redis operations.
 *
 * This client uses the Upstash REST API for edge-compatible, serverless Redis access.
 * It's configured to work with both Nuxt server routes and edge middleware.
 *
 * @module lib/redis
 * @author Mike Odnis
 * @license Apache-2.0
 */

import { Redis } from "@upstash/redis";

/**
 * Singleton instance of the Upstash Redis client.
 *
 * Configured with:
 * - REST API for edge compatibility
 * - keepAlive for persistent connections
 * - readYourWrites for consistency guarantees
 *
 * @const
 * @readonly
 * @public
 * @type {Redis}
 * @example
 * import { redis } from '~/lib/redis'
 * await redis.set('key', 'value')
 * const value = await redis.get('key')
 *
 * @see {@link https://upstash.com/docs/redis/features/restapi Upstash Redis REST API}
 */
export const redis = new Redis({
	url: process.env.UPSTASH_REDIS_REST_URL || "",
	token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
	keepAlive: true,
	readYourWrites: true,
});
