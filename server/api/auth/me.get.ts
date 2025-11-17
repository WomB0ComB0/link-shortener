/**
 * User profile endpoint
 * GET /api/auth/me
 * Type-safe with Effect Schema
 */

import { defineEventHandler, createError } from 'h3';
import { GET_USER_BY_ID } from '../../../lib/graphql/operations';
import { executeQuery } from '../../utils/graphql';
import { getUserIdFromHeaders } from '../../utils/auth';
import { UserProfileResponse } from '../../../server/schemas/index';

export default defineEventHandler(async (event) => {
  try {
    // Get user ID from auth token (type-safe)
    const userId = getUserIdFromHeaders(event);

    if (!userId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - valid token required',
      });
    }

    // Get user details
    const { data, error: queryError } = await executeQuery(GET_USER_BY_ID, {
      userId: userId,
    });

    if (queryError) {
      console.error('GraphQL query error:', queryError);
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch user profile',
      });
    }

    const users = data?.users || [];

    if (users.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found',
      });
    }

    const user = users[0];

    // Return type-safe response
    const response = new UserProfileResponse({
      id: user.id,
      email: user.email,
      displayName: user.display_name ?? null,
      photoUrl: user.photo_url ?? null,
      createdAt: new Date(user.created_at),
    });

    return response;
  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }

    console.error('Profile fetch error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch profile',
    });
  }
});
