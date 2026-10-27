# 🎁 TonyPilot Backend — Real-Time Live Streaming & Gift-Giving Platform

> **Production-grade backend service powering real-time live video gift giveaways, community story voting, and instant live awarding.**

Built with **Node.js, Express, TypeScript, MongoDB (Mongoose), Redis, Socket.IO, Stripe Billing Engine, and ZEGOCLOUD WebRTC Token04 Engine**.

---

## 📖 Complete API & Mobile Integration Guide
For the exhaustive, zero-omission API documentation, Postman testing guide, Socket.IO events matrix, and Flutter/React integration snippets, please read:
👉 **[API Integration and Testing Guide (README_API_GUIDE)](./API_INTEGRATION_AND_TESTING_GUIDE.md)**  
👉 **[Stripe Webhook Setup & Auto-Renewal Guide](./STRIPE_WEBHOOK_SETUP_GUIDE.md)**

---

## 🌟 Core Architecture & Feature Modules

### 💳 1. Subscriptions & Stripe Billing Engine (`/subscriptions`)
- 1-Month Auto-Renewal with Webhook synchronization (`invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`).
- Card Save via SetupIntent & customer default payment method management.
- Tier quota management (Free tier: 3 gifts/month; Basic tier: 10 gifts/month; Pro tier: 50 gifts/month).

### 📦 2. Gift Items Inventory & 5-Step Creation Wizard (`/gift-items`)
- 5-Step mobile wizard with multipart image uploads (up to 5 photos).
- Geospatial 25-mile radius discovery feed using MongoDB `$geoWithin` and `$centerSphere`.
- Private pickup instructions revealed exclusively to the verified live stream winner.

### 🎥 3. Live Streaming Engine & ZEGOCLOUD RTC (`/live-streams`)
- Pre-Live Studio initialization with official AES-256-GCM signed **ZEGOCLOUD Token04** generation.
- 1-Second Server-Authoritative Timer (`timer_tick` broadcasted over Socket.IO).
- Dynamic audience viewer counting managed via Redis Sets.
- Automatic wrap-up metrics calculation on broadcast conclusion.

### 🏆 4. Story Claims, Community Voting & Live Winner Selection (`/story-claims`)
- "Request with Story" 2-step applicant submission with daily quotas.
- Real-time community upvoting with instant vote toggle and switch handling.
- Host broadcast pinning ("PINNED APPLICANT STORY" overlay).
- **ACID MongoDB Session Transaction** for live gift awarding (guarantees zero double-awards under concurrent requests).

### 💬 5. Live Comments, Documents & Moderation Flagging (`/live-comments`, `/messages`)
- Redis sliding window rate-limiting (max 5 comments per 10 seconds; returns `429 Too Many Requests`).
- Floating reaction emojis (`❤️`, `🔥`, `👏`, `🎉`, `🙌`).
- Host comment pinning and moderation soft deletion.
- In-chat document uploads (`POST /messages/upload-chat-document`).
- Community moderation reporting against comments and users (`ModerationFlag`).

### 🛡️ 6. Admin Control Room, Telemetry & Audit Logs (`/admin`)
- Telemetry overview KPIs cached with 300s TTL in Redis.
- Active live streams control room with admin spectator WebRTC tokens.
- Remote emergency stream killswitch (`terminated_by_admin` with automatic gift reversion).
- Remote host microphone mute.
- User moderation lifecycle (Warn, Suspend, Ban, Unban) with Super Admin immunity.
- Immutable system audit logs & Monthly Recurring Revenue (MRR) analytics.

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18.x
- MongoDB >= 6.0
- Redis Server >= 6.2

### Installation
```bash
# Clone the repository
git clone https://github.com/tonypilot/tonypilot-backend.git
cd tonypilot-backend

# Install dependencies
npm install
```

### Environment Variables (.env)
Create a `.env` file in the root directory:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL=mongodb://localhost:27017/tonypilot
REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=your_jwt_access_secret_key_12345
JWT_ACCESS_EXPIRES_IN=30d
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_12345
JWT_REFRESH_EXPIRES_IN=365d

ZEGO_APP_ID=123456789
ZEGO_SERVER_SECRET=your_zego_server_secret_32bytes_hex

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Seed Subscription Plans
```bash
npm run seed:plans
```

### Run the Application
```bash
# Development mode with hot-reload
npm run dev

# Production build
npm run build
npm start
```

### Verification & Testing
```bash
# Check TypeScript compilation
npx tsc --noEmit
```

---

## 👥 Contributors & Maintainers
- **Backend Architecture & Engineering:** TonyPilot Core Team
- **API & Testing Guide:** [API_INTEGRATION_AND_TESTING_GUIDE.md](./API_INTEGRATION_AND_TESTING_GUIDE.md)
