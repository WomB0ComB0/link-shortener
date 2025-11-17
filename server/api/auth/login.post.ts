/**
 * User login endpoint
 * POST /api/auth/login
 * Type-safe with Effect Schema
 */

import { defineEventHandler, readBody, createError } from 'h3';
import * as S from '@effect/schema/Schema';
import { GET_USER_BY_EMAIL_WITH_PASSWORD } from '../../../lib/graphql/operations';
import { executeQuery } from '../../utils/graphql';
import { verifyPassword, generateSessionToken } from '../../utils/auth';
import { LoginRequest, AuthResponse } from '../../../server/schemas/index';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  // Validate request body using Effect Schema
  let validatedBody: LoginRequest;
  try {
    validatedBody = new LoginRequest(body);
  } catch (error: any) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      message: error.message || 'Invalid request body',
    });
  }

  const { email, password } = validatedBody;

  try {
    // Get user by email with password hash
    const { data, error: queryError } = await executeQuery(
      GET_USER_BY_EMAIL_WITH_PASSWORD,
      { email: email.toLowerCase() },
    );

    if (queryError) {
      console.error('GraphQL query error:', queryError);
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to authenticate user',
      });
    }

    const users = data?.users || [];

    // Check if user exists
    if (users.length === 0) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid email or password',
      });
    }

    const user = users[0];

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid email or password',
      });
    }

    // Generate session token (type-safe)
    const token = generateSessionToken(user.id);

    // Return type-safe response
    const response = new AuthResponse({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name ?? null,
        photoUrl: user.photo_url ?? null,
        createdAt: new Date(user.created_at),
      },
      token,
    });

    return response;
  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }

    console.error('Login error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to login',
    });
  }
});
