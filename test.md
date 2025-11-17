# Firebase Data Connect Configuration Guide

## Current Configuration

Your Firebase Data Connect is now configured for:
- **Project**: `portfolio-394418`
- **Service ID**: `link-shortener`
- **Location**: `us-central1`
- **Cloud SQL Instance**: `portfolio-394418:us-central1:link-shortener-sql`

## Important Notes

### SSL/TLS Connection

Firebase Data Connect automatically uses SSL/TLS connections to Cloud SQL when using the `cloudSql.instanceId` configuration. The connection is secured by default and you don't need to manually configure SSL certificates.

### Configuration Files

1. **`.firebaserc`** - Project configuration
   ```json
   {
     "projects": {
       "default": "portfolio-394418"
     }
   }
   ```

2. **`firebase.json`** - Firebase services configuration
   ```json
   {
     "dataconnect": {
       "source": "dataconnect"
     }
   }
   ```

3. **`dataconnect/dataconnect.yaml`** - Data Connect service configuration
   ```yaml
   specVersion: v1alpha
   serviceId: link-shortener
   location: us-central1
   schema:
     source: ./schema
     datasource:
       postgresql:
         database: link-shortener-db
         cloudSql:
           instanceId: portfolio-394418:us-central1:link-shortener-sql
   connectorDirs:
     - ./connectors
   ```

## Setup Steps

### 1. Create Cloud SQL Instance (if not exists)

```bash
# The instance ID should be: portfolio-394418:us-central1:link-shortener-sql
gcloud sql instances create link-shortener-sql \
  --project=portfolio-394418 \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1
```

### 2. Create Database

```bash
gcloud sql databases create link-shortener-db \
  --instance=link-shortener-sql \
  --project=portfolio-394418
```

### 3. Deploy Data Connect Schema

```bash
# From the project root
firebase deploy --only dataconnect
```

This will:
- ✅ Create the Cloud SQL instance (if it doesn't exist)
- ✅ Create the database with SSL enabled
- ✅ Apply the schema from `dataconnect/schema/schema.gql`
- ✅ Generate the GraphQL API
- ✅ Create the connector endpoints

### 4. Generate SDK

After deployment, generate the TypeScript SDK:

```bash
firebase dataconnect:sdk:generate
```

This creates type-safe SDK in `dataconnect-generated/` directory.

## Connection Details

### Secure Connection (SSL/TLS)

Firebase Data Connect automatically connects to Cloud SQL using:
- ✅ **SSL/TLS encryption** - All data in transit is encrypted
- ✅ **IAM authentication** - Uses service account credentials
- ✅ **Private IP** (optional) - Can use VPC peering for additional security
- ✅ **Automatic certificate management** - No manual cert rotation needed

### Environment Variables

Update your `.env` file:

```bash
# Firebase Project
NUXT_PUBLIC_FB_PROJECT_ID=portfolio-394418

# Firebase Data Connect
FIREBASE_DATA_CONNECT_SERVICE_ID=link-shortener
FIREBASE_DATA_CONNECT_LOCATION=us-central1

# Cloud SQL Instance (for reference)
CLOUD_SQL_INSTANCE=portfolio-394418:us-central1:link-shortener-sql
CLOUD_SQL_DATABASE=link-shortener-db
```

## Verifying SSL Connection

To verify your Cloud SQL instance has SSL enabled:

```bash
# Check instance details
gcloud sql instances describe link-shortener-sql \
  --project=portfolio-394418 \
  --format="get(settings.ipConfiguration.requireSsl)"
```

To require SSL for all connections:

```bash
gcloud sql instances patch link-shortener-sql \
  --project=portfolio-394418 \
  --require-ssl
```

## Using in Your Code

### Import Generated SDK

```typescript
import { connectors } from '@/dataconnect-generated/default-connector'

// Create a short link
const result = await connectors.CreateShortLink({
  originalUrl: 'https://example.com',
  shortCode: 'abc123',
  masterPasswordHash: 'hash...'
})

// Get analytics
const analytics = await connectors.GetAnalytics({
  linkId: 'uuid-here'
})
```

### Direct GraphQL Queries

```typescript
import { dataConnect } from '@/lib/firebase'
import { executeGraphql } from 'firebase/data-connect'

const query = `
  query GetShortLink($url: String!) {
    shortLink(originalUrl: $url) {
      id
      shortCode
      clicks {
        count
      }
    }
  }
`

const result = await executeGraphql(dataConnect, {
  query,
  variables: { url: 'https://example.com' }
})
```

## Monitoring & Security

### Cloud SQL Dashboard

Monitor your instance at:
- [Google Cloud Console](https://console.cloud.google.com/sql/instances?project=portfolio-394418)
- [Firebase Console](https://console.firebase.google.com/project/portfolio-394418/dataconnect)

### Security Best Practices

1. ✅ **Require SSL** - All connections must use SSL/TLS
2. ✅ **Private IP** - Use VPC for internal-only access
3. ✅ **IAM Auth** - Use service accounts, not passwords
4. ✅ **Backups** - Enable automated backups
5. ✅ **Monitoring** - Set up Cloud Monitoring alerts

### Enable Private IP (Optional)

For maximum security, configure private IP:

```bash
gcloud sql instances patch link-shortener-sql \
  --project=portfolio-394418 \
  --network=projects/portfolio-394418/global/networks/default \
  --no-assign-ip
```

## Troubleshooting

### SSL Certificate Issues

If you encounter SSL errors, Firebase Data Connect handles certificates automatically. Check:

```bash
# Verify SSL is enabled
gcloud sql instances describe link-shortener-sql \
  --project=portfolio-394418 \
  --format="value(settings.ipConfiguration.requireSsl)"
```

### Connection Timeouts

Ensure Cloud SQL Admin API is enabled:

```bash
gcloud services enable sqladmin.googleapis.com \
  --project=portfolio-394418
```

### Permissions

Your service account needs these roles:
- `roles/cloudsql.client` - Connect to Cloud SQL
- `roles/dataconnect.admin` - Manage Data Connect

## Next Steps

1. **Deploy Schema**: `firebase deploy --only dataconnect`
2. **Generate SDK**: `firebase dataconnect:sdk:generate`
3. **Update Code**: Use generated SDK in your API routes
4. **Test**: Make requests and verify data is stored
5. **Monitor**: Check Cloud SQL metrics and logs

---

**Your Firebase Data Connect is now configured with SSL-enabled Cloud SQL! 🔒**