/**
 * GraphQL operations for Hasura
 */

// Create a new user
export const CREATE_USER = `
  mutation CreateUser(
    $email: String!
    $displayName: String
    $passwordHash: String!
  ) {
    insert_users_one(object: {
      email: $email
      display_name: $displayName
      password_hash: $passwordHash
    }) {
      id
      email
      display_name
      created_at
    }
  }
`;

// Get user by email
export const GET_USER_BY_EMAIL = `
  query GetUserByEmail($email: String!) {
    users(where: {email: {_eq: $email}}) {
      id
      email
      display_name
      photo_url
      created_at
    }
  }
`;

// Get user by email with password (for login)
export const GET_USER_BY_EMAIL_WITH_PASSWORD = `
  query GetUserByEmailWithPassword($email: String!) {
    users(where: {email: {_eq: $email}}) {
      id
      email
      display_name
      photo_url
      password_hash
      created_at
    }
  }
`;

// Get user by ID
export const GET_USER_BY_ID = `
  query GetUserById($userId: uuid!) {
    users(where: {id: {_eq: $userId}}) {
      id
      email
      display_name
      photo_url
      created_at
    }
  }
`;

// Get user's short links
export const GET_USER_LINKS = `
  query GetUserLinks($userId: uuid!) {
    short_links(
      where: {user_id: {_eq: $userId}}
      order_by: {created_at: desc}
    ) {
      id
      short_url
      original_url
      custom_alias
      created_at
      is_active
      expires_at
      clicks_aggregate {
        aggregate {
          count
        }
      }
    }
  }
`;

// ==================== SHORT LINKS ====================

// Check if a short URL already exists
export const GET_SHORT_LINK_BY_URL = `
  query GetShortLinkByUrl($shortUrl: String!) {
    short_links(where: {short_url: {_eq: $shortUrl}}) {
      id
      short_url
      original_url
      custom_alias
      is_active
      created_at
    }
  }
`;

// Check if a custom alias already exists
export const GET_SHORT_LINK_BY_ALIAS = `
  query GetShortLinkByAlias($customAlias: String!) {
    short_links(where: {custom_alias: {_eq: $customAlias}}) {
      id
      short_url
      original_url
      custom_alias
      is_active
      created_at
    }
  }
`;

// Create a new short link
export const CREATE_SHORT_LINK = `
  mutation CreateShortLink(
    $originalUrl: String!
    $shortUrl: String!
    $customAlias: String
    $userId: uuid
  ) {
    insert_short_links_one(object: {
      original_url: $originalUrl
      short_url: $shortUrl
      custom_alias: $customAlias
      user_id: $userId
      is_active: true
    }) {
      id
      short_url
      original_url
      custom_alias
      is_active
      created_at
    }
  }
`;

// Get short link by code (for redirect)
export const GET_SHORT_LINK_BY_CODE = `
  query GetShortLinkByCode($code: String!) {
    short_links(
      where: {
        _or: [
          {short_url: {_eq: $code}}
          {custom_alias: {_eq: $code}}
        ]
        is_active: {_eq: true}
      }
    ) {
      id
      short_url
      original_url
      custom_alias
      is_active
      expires_at
    }
  }
`;

// Record a click
export const CREATE_CLICK = `
  mutation CreateClick(
    $shortLinkId: uuid!
    $userAgent: String
    $referrer: String
    $ipAddress: String
    $country: String
    $city: String
  ) {
    insert_clicks_one(object: {
      short_link_id: $shortLinkId
      user_agent: $userAgent
      referrer: $referrer
      ip_address: $ipAddress
      country: $country
      city: $city
    }) {
      id
      timestamp
    }
  }
`;

// Get analytics for a short link
export const GET_LINK_ANALYTICS = `
  query GetLinkAnalytics($shortLinkId: uuid!) {
    short_links(where: {id: {_eq: $shortLinkId}}) {
      id
      short_url
      original_url
      custom_alias
      created_at
      is_active
      expires_at
      clicks_aggregate {
        aggregate {
          count
        }
      }
      clicks(order_by: {timestamp: desc}, limit: 100) {
        id
        timestamp
        user_agent
        referrer
        ip_address
        country
        city
      }
    }
  }
`;
