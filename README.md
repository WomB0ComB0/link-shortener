# 🔗 LinkShort - Secure, Type-Safe Link Shortener

A modern, enterprise-grade link shortener built with **Nuxt 3**, **Effect Schema**, **Railway PostgreSQL**, and **Hasura GraphQL**. Features comprehensive security verification, user authentication, and real-time analytics.

## ✨ Key Features

### 🛡️ **Enterprise Security**
- **5-Layer Security Verification Pipeline:**
  - ✅ URL format & domain validation
  - ✅ DNS record verification
  - ✅ SSL/TLS certificate checking
  - ✅ Advanced phishing detection (typosquatting, homograph attacks)
  - ✅ Malware scanning (Google Safe Browsing API v4)
- **Risk-based policies** (safe, low, medium, high, critical)
- **Real-time threat detection** with 1-hour result caching
- **Comprehensive security reports** with recommendations

### 🔐 **Type-Safe Everything**
- **Effect Schema** for runtime & compile-time validation
- Type-safe authentication (JWT with 7-day expiry)
- Type-safe GraphQL queries & mutations
- Password strength validation (8+ chars, uppercase, lowercase, number)
- Email RFC validation

### 👤 **User Authentication**
- JWT-based authentication
- SHA-256 password hashing
- User registration & login
- Profile management
- Session token validation
- Protected routes

### 📊 **Analytics & Tracking**
- Click tracking
- User agent detection
- Referrer tracking
- Geographic data (IP-based)
- Custom link aliases
- Expiration dates

### 🎨 **Modern UI/UX**
- Beautiful Nuxt UI components
- Dark mode support
- Responsive design (mobile, tablet, desktop)
- Real-time security verification display
- Copy-to-clipboard with feedback
- Loading states & error handling

## 🚀 Quick Start

### Prerequisites
- Node.js 22.x or higher (or Deno)
- Railway account (for PostgreSQL & Hasura)
- Upstash account (for Redis rate limiting)
- Google Cloud account (optional, for Safe Browsing API)

### Installation

```bash
# Clone the repository
git clone https://github.com/WomB0ComB0/link-shortener.git
cd link-shortener

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env and add your credentials
```

### Environment Setup

```bash
# Database (Hasura GraphQL)
HASURA_GRAPHQL_ENDPOINT=https://your-project.hasura.app/v1/graphql
HASURA_ADMIN_SECRET=your_hasura_admin_secret

# Upstash Redis (Rate Limiting)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# JWT Secret (for authentication)
JWT_SECRET=your_secure_random_string_at_least_32_chars

# Google Safe Browsing API (for malware detection)
GOOGLE_SAFE_BROWSING_API_KEY=your_google_api_key
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
npm run dev
```

## Production

Build the application for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## 📡 API Endpoints

### Security Verification
```bash
GET /api/security/verify?url=https://example.com
```
Returns comprehensive security report with risk score, checks, and recommendations.

### Create Short Link
```bash
POST /api/links/create
{
  "originalUrl": "https://example.com",
  "customAlias": "my-link",  // optional
  "expiresAt": "2025-12-31"  // optional
}
```
Includes automatic security verification in response.

### Authentication
```bash
POST /api/auth/register
POST /api/auth/login
GET /api/auth/me
```

## 🛡️ Security Features

### URL Validation
- Protocol validation (HTTP/HTTPS only)
- Domain format checking
- Private network blocking
- Homograph attack detection
- Suspicious keyword detection

### DNS Verification
- A/AAAA record validation
- MX record checking
- CNAME resolution
- Private IP range detection
- New domain detection

### SSL/TLS Checking
- Certificate validity
- Expiration date monitoring
- Self-signed detection
- TLS protocol version checking
- Weak cipher detection

### Phishing Detection
- **Typosquatting detection** using Levenshtein distance
- **Brand impersonation** (25+ monitored brands)
- **Homograph attacks** (Unicode lookalikes)
- **Suspicious TLD detection** (.tk, .ml, .zip, etc.)
- **Multi-factor scoring** (0-100 scale)

### Malware Scanning
- **Google Safe Browsing API** integration
- Suspicious file extension detection
- Double extension detection
- Query parameter analysis

## 📊 Risk Levels

| Risk Level | Score | Action |
|-----------|-------|--------|
| **Safe** | 0-19 | ✅ Fully approved |
| **Low** | 20-39 | ✅ Allowed with minor warnings |
| **Medium** | 40-59 | ✅ Allowed with logging |
| **High** | 60-79 | ⚠️ Blocked for anonymous, allowed for auth users |
| **Critical** | 80-100 | ❌ Blocked for all users |

## 🏗️ Tech Stack

- **Frontend:** Nuxt 3, Vue 3, Nuxt UI
- **Backend:** Nitro, H3, Effect Schema
- **Database:** Railway PostgreSQL
- **GraphQL:** Hasura
- **Cache/Rate Limit:** Upstash Redis
- **Security:** Google Safe Browsing API v4
- **Auth:** JWT with SHA-256 hashing
- **Type Safety:** Effect Schema, TypeScript

## 📚 Documentation

- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md) - Complete feature overview
- [Security Verification](./SECURITY_VERIFICATION.md) - Security system documentation
- [Type Safety Guide](./TYPE_SAFETY_GUIDE.md) - Effect Schema usage

## 🔧 Configuration

### Security Options
```bash
SECURITY_VERIFICATION_ENABLED=true
SECURITY_CACHE_TTL=3600  # 1 hour
SECURITY_CHECK_TIMEOUT=10000  # 10 seconds
ADMIN_BYPASS_SECRET=your_secret  # Development only
```

### Rate Limits (Upstash Redis)
- Default: 30 requests per 10 seconds
- Auth: 5 requests per 10 seconds
- Link creation: 10 requests per 60 seconds

## 🧪 Testing

Test security verification:
```bash
# Safe URL
curl "http://localhost:3000/api/security/verify?url=https://google.com"

# Phishing patterns
curl "http://localhost:3000/api/security/verify?url=https://paypal-secure-login.tk"

# Malicious URL (requires Safe Browsing API)
curl "http://localhost:3000/api/security/verify?url=http://malware.testing.google.test/testing/malware/"
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

Copyright © 2025 Mike Odnis. All rights reserved.

## 🙏 Acknowledgments

- [Nuxt](https://nuxt.com/) - The Intuitive Vue Framework
- [Effect](https://effect.website/) - Powerful TypeScript library
- [Hasura](https://hasura.io/) - Instant GraphQL APIs
- [Railway](https://railway.app/) - Infrastructure platform
- [Upstash](https://upstash.com/) - Serverless Redis
- [Google Safe Browsing](https://safebrowsing.google.com/) - Threat detection

---

Built with ❤️ using Nuxt 3, Effect Schema, and the best security tools available.
