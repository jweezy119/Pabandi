# Setup Guide - Pabandi

This guide will help you set up and run Pabandi, the AI-powered booking platform.

## Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** 18 or higher
- **PostgreSQL** 14 or higher
- **Redis** (optional, for caching)
- **npm** or **yarn**

## Step-by-Step Setup

### 1. Clone and Install Dependencies

```bash
# Install root dependencies
npm install

# Install all dependencies (root, server, and client)
npm run install:all
```

### 2. Database Setup

#### Create PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE karachi_booking;

# Exit PostgreSQL
\q
```

### 3. Environment Configuration

#### Server Environment Variables

Create `server/.env` file:

```bash
cp server/.env.example server/.env
```

Edit `server/.env` and configure:

- **DATABASE_URL**: Your PostgreSQL connection string
- **JWT_SECRET**: Generate a strong secret key (e.g., `openssl rand -base64 32`)
- **GOOGLE_MAPS_API_KEY**: For business reviews and ratings (Required for reliability features)
- **TWILIO_ACCOUNT_SID** and **TWILIO_AUTH_TOKEN**: For SMS notifications (optional)
- **EMAIL_SERVICE**: SendGrid API key or SMTP credentials (optional)
- **PAYMENT_GATEWAY**: Stripe keys or other payment gateway (optional)

#### Client Environment Variables

Create `client/.env` file:

```env
VITE_API_URL=http://localhost:5000/api/v1
```

### 4. Database Migrations

```bash
# Generate Prisma client
cd server
npm run generate

# Run migrations
npm run migrate
```

### 5. Start Development Servers

#### Option 1: Run Both Servers Together

```bash
# From root directory
npm run dev
```

#### Option 2: Run Separately

Terminal 1 - Backend:
```bash
cd server
npm run dev
```

Terminal 2 - Frontend:
```bash
cd client
npm start
```

### 6. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Docs**: http://localhost:5000/api/v1/docs
- **Health Check**: http://localhost:5000/health

## Production Deployment

### Build for Production

```bash
# Build both server and client
npm run build

# Start production server
cd server
npm start
```

### Environment Variables for Production

Ensure all production environment variables are set:
- Use strong, unique JWT secrets
- Configure production database
- Set up proper email/SMS services
- Configure payment gateway
- Set `NODE_ENV=production`

## External Service Setup

### 1. Google Maps Platform (Places API)

This is **mandatory** for the AI-Crypto reliability rewards to function.

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project (e.g., "Pabandi").
3.  Go to **APIs & Services > Library**.
4.  Search for and enable the **Places API**.
5.  Go to **APIs & Services > Credentials**.
6.  Click **Create Credentials > API Key**.
7.  Copy the key and add it as `GOOGLE_MAPS_API_KEY` in `server/.env`.
8.  *(Recommended)* Restrict your API key to only the "Places API" for security.

### 2. SMS Notifications (Twilio)

1. Sign up for Twilio account
2. Get Account SID and Auth Token
3. Purchase a phone number (Pakistan +92)
4. Add credentials to `server/.env`

### Email Notifications

**Option 1: SendGrid**
1. Create SendGrid account
2. Get API key
3. Set `EMAIL_SERVICE=sendgrid` and `SENDGRID_API_KEY` in `.env`

**Option 2: SMTP**
1. Configure SMTP settings in `.env`
2. For Gmail, use App Password

### Payment Gateway

The application is designed to support:
- **Stripe** (international payments)
- **JazzCash** (Pakistan)
- **EasyPaisa** (Pakistan)

Configure payment gateway credentials in `server/.env`.

## Troubleshooting

### Database Connection Issues

- Verify PostgreSQL is running
- Check DATABASE_URL format: `postgresql://user:password@host:port/database`
- Ensure database exists

### Port Already in Use

- Change PORT in `server/.env` (default: 5000)
- Change port in `client/vite.config.ts` (default: 3000)

### Module Not Found Errors

```bash
# Reinstall dependencies
cd server && rm -rf node_modules && npm install
cd ../client && rm -rf node_modules && npm install
```

## Next Steps

1. **Seed Initial Data** (optional):
   ```bash
   cd server
   npm run seed
   ```

2. **Create Admin User**: Use the registration endpoint or seed script

3. **Register Your Business**: Login and register your first business

4. **Configure Business Settings**: Set up business hours, tables, and AI preferences

## Support

For issues or questions, refer to the main README.md or contact the development team.

---

**Built for businesses in Karachi, Pakistan** 🇵🇰
