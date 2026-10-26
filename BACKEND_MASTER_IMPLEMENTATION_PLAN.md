# TONYPILOT — BACKEND MASTER IMPLEMENTATION PLAN

> **Version:** 1.0.0  
> **Date:** 2026-10-26  
> **Stack:** Node.js · Express · TypeScript · MongoDB · Mongoose · Redis · Socket.IO  
> **Architect Role:** Principal Backend Architect & System Designer  

---

## Table of Contents

1. [Architecture Decision Record (ADR): Live Streaming & Signaling Strategy](#1-architecture-decision-record-adr-live-streaming--signaling-strategy)
2. [End-to-End System Integration & Data Sync Map](#2-end-to-end-system-integration--data-sync-map)
3. [Complete Master Database Models & Strict TypeScript Interfaces](#3-complete-master-database-models--strict-typescript-interfaces)
4. [Complete Unified API Catalog](#4-complete-unified-api-catalog-existing--brand-new-modules)
5. [Real-Time Socket.IO & Signaling Event Contract](#5-real-time-socketio--signaling-event-contract)
6. [Step-by-Step Granular Implementation Phases](#6-step-by-step-granular-implementation-phases)

---

## 1. Architecture Decision Record (ADR): Live Streaming & Signaling Strategy

### 1.1 Context & Figma-Derived Requirements

From the Figma inspection, the live streaming system requires:

| Figma Screen | Backend Requirement |
|---|---|
| **"Starting HOST LIVE STUDIO"** — Pre-live prep badge, camera preview, gift item selection, "Go Live" CTA | Pre-live room initialization, RTC token generation, gift-item association |
| **"Others Live"** — Live badge, `125` viewer counter, "More Live Today" link, gradient overlay with gift card | Real-time viewer count tracking, active streams list, featured gift overlay data |
| **"My Live (Running)"** — Live/Timer/Viewers badges at top, pinned gift card at bottom, story claims list, "End Live" button | Server-side timer tracking, viewer count via Redis, pinned-claim state management |
| **"My Live (PINNED APPLICANT STORY)"** — Pinned claim card with green "Awarded" badge, applicant story expanded | Pin/unpin claim mutation, real-time broadcast of pinned state to all viewers |
| **"My Live (GIFT AWARDED LIVE!)"** — Green celebration card "Gift Awarded", winner info, confetti overlay | ACID transaction for award, real-time `gift_awarded` event broadcast |
| **"My Live (End Broadcast)"** — Modal with "Are you sure?" confirmation, stats preview | Graceful stream termination, wrap-up stats calculation |
| **"My Live (Live Story Claims)"** — Bottom sheet with scrollable claim cards, "Pin to Live" CTA per card | Claim submission, listing, pin action with real-time sync |
| **"Broadcast Finished!"** — Wrap-up screen with air time, total reach, live claims count, share/done CTAs | Post-stream analytics aggregation and persistence |
| **"More Live Today"** — Modal listing multiple active streams with viewer counts | Cached active-streams query |
| **Admin "Live Stream Watch"** — Admin watching any live stream, video embed, moderation controls | Admin spectator token generation, force-end capability |
| **Admin "Watch live" + InspectModal** — Admin video player with bottom bar controls (Warn, Suspend, Terminate) | Admin moderation actions with audit logging |

### 1.2 Comparative Analysis

#### Option A: ZEGOCLOUD (Live Streaming Kit + Signaling + ZIM)

| Criterion | Assessment |
|---|---|
| **Video Ingest/Playback** | Ultra-low-latency RTMP/WebRTC streaming kit with CDN. 1-to-many broadcast optimized. |
| **Signaling** | ZIM (ZEGOCLOUD Instant Messaging) provides real-time room attributes (key-value), perfect for `pinnedClaimId`, `viewerCount`, `timerState`. |
| **Flutter SDK** | First-class Flutter SDK (`zego_uikit_prebuilt_live_streaming`), production-ready widgets. |
| **Token Security** | Server-side token generation via HMAC-SHA256, validates `appId + userId + effectiveTime + nonce`. |
| **Scalability** | Managed global CDN, auto-scales to 10M+ concurrent viewers per room. |
| **Webhook System** | Stream start/end webhooks, callback URL verification with signature validation. |
| **Cost** | Pay-per-minute pricing. Free tier: 10,000 mins/month. |
| **Admin Spectator** | Supports room-level privilege control; admin can join any room as invisible spectator. |

#### Option B: Agora (RTC + RTM)

| Criterion | Assessment |
|---|---|
| **Video Ingest/Playback** | Agora RTC — WebRTC-based, excellent low-latency. Requires manual CDN relay config for 1-to-many. |
| **Signaling** | Agora RTM 2.x — channel metadata (key-value attributes) equivalent to ZIM room attributes. |
| **Flutter SDK** | `agora_rtc_engine` + `agora_rtm` — two separate packages, more integration work. |
| **Token Security** | Server-side RTC token (HMAC-SHA256) + separate RTM token. Two token flows to manage. |
| **Scalability** | Agora SD-RTN™ network, auto-scales. Proven at millions of concurrent connections. |
| **Webhook System** | Agora Message Notification Service (NCS) with HMAC signature verification. |
| **Cost** | Pay-per-minute. Free tier: 10,000 mins/month. Slightly higher cost for interactive live streaming. |
| **Admin Spectator** | Supported via role-based token (audience role). |

#### Option C: Custom WebRTC Media Server (mediasoup / Janus)

| Criterion | Assessment |
|---|---|
| **Video Ingest/Playback** | Full control, but requires SFU/MCU cluster management, TURN/STUN servers, and CDN integration. |
| **Signaling** | Must build custom signaling layer on top of Socket.IO or raw WebSocket. |
| **Flutter SDK** | No SDK. Must use `flutter_webrtc` + custom native bridge. Extremely complex. |
| **Token Security** | Custom implementation — full auth responsibility. |
| **Scalability** | Manual horizontal scaling with load balancers. 6-12 months to production-grade. |
| **Webhook System** | Must build from scratch. |
| **Cost** | Server costs only, but engineering cost is 10-50x higher. |
| **Admin Spectator** | Must build custom privilege system. |

### 1.3 Final Architectural Selection

> **SELECTED: ZEGOCLOUD (Live Streaming Kit + ZIM Signaling)**

**Justification:**

1. **Single Flutter SDK** — `zego_uikit_prebuilt_live_streaming` provides host/viewer UI out of the box. Agora requires two separate SDK integrations.
2. **Room Attributes** — ZIM's real-time key-value room attributes directly support our Figma-required `pinnedClaimId`, `giftItemId`, `timerStartedAt`, and `viewerCount` overlays without custom Socket.IO fallback.
3. **Custom WebRTC Eliminated** — Building a custom media server adds 6-12 months of infrastructure engineering (TURN/STUN, SFU scaling, CDN relay, Flutter WebRTC bridging, custom signaling). This is unacceptable for a gifting app where the core value is in the claim/award/community flow, not in video plumbing.
4. **Webhook-Driven Persistence** — ZEGOCLOUD's stream lifecycle webhooks (stream_start, stream_end) trigger our MongoDB persistence pipeline without polling.
5. **Admin Spectator** — Role-based tokens allow admin to join any room as audience without host awareness — ideal for the admin "Live Stream Watch" Figma screen.

### 1.4 Separation of Concerns

#### What ZEGOCLOUD SDK Handles (Client-Side):
- Video capture, encoding, ingest (host)
- Video playback, decoding, rendering (viewer)
- Ultra-low-latency media transport via ZEGOCLOUD CDN
- Real-time room attribute sync (pinnedClaimId, giftItemId — read by viewers)
- Room presence tracking (join/leave signals)

#### What Our Node.js/Express Backend Handles (Server-Side):
- **RTC Token Generation** — `POST /api/v1/live-streams/token` generates a ZEGOCLOUD token with `appId`, `serverSecret`, `userId`, `effectiveTimeInSeconds`, `channelId`.
- **Room State Initialization** — Creates `LiveStream` MongoDB document with `status: 'scheduled'`, associates `giftItem`, sets `host` ref.
- **Stream Lifecycle Persistence** — ZEGOCLOUD webhooks → `POST /api/v1/webhooks/zego` → updates `LiveStream.status` to `live` / `ended`.
- **Gift Claim Verification** — `LiveStoryClaim` CRUD, validation that claimant is not the host, duplicate prevention.
- **ACID Winner Selection** — MongoDB transaction: atomically updates `LiveStream.winner`, `LiveStoryClaim.status → 'awarded'`, `GiftItem.claimState → 'claimed'`, and creates `AdminAuditLog` entry.
- **Wrap-Up Metrics** — Calculates `airTime`, `peakViewers`, `totalReached`, `totalClaims` from Redis counters + MongoDB aggregation.
- **Admin Audit Logging** — Every admin moderation action (force-end, ban, mute, remove claim) persisted to `AdminAuditLog`.
- **Redis Real-Time Counters** — `INCR`/`DECR` for viewer count, `SET` with TTL for active stream metadata, `HSET` for room state.

### 1.5 Token Generation Lifecycle

```
┌──────────────┐     POST /live-streams/init     ┌──────────────────┐
│  Flutter App  │ ──────────────────────────────→ │  Express Backend │
│  (Host)       │                                 │                  │
│               │ ←────────────────────────────── │  1. Validate JWT │
│               │  { roomId, rtcToken,            │  2. Create       │
│               │    rtmToken, giftItem }         │     LiveStream   │
│               │                                 │     (scheduled)  │
│               │                                 │  3. Gen ZEGO     │
│               │                                 │     RTC Token    │
│               │                                 │  4. Gen ZEGO     │
│               │                                 │     RTM Token    │
│               │                                 │  5. Cache room   │
│               │                                 │     in Redis     │
└──────────────┘                                  └──────────────────┘

┌──────────────┐     POST /live-streams/:id/join  ┌──────────────────┐
│  Flutter App  │ ──────────────────────────────→ │  Express Backend │
│  (Viewer)     │                                 │                  │
│               │ ←────────────────────────────── │  1. Validate JWT │
│               │  { rtcToken (audience role),    │  2. Verify       │
│               │    rtmToken, streamData }       │     stream live  │
│               │                                 │  3. Gen viewer   │
│               │                                 │     tokens       │
│               │                                 │  4. INCR viewer  │
│               │                                 │     count Redis  │
└──────────────┘                                  └──────────────────┘
```

### 1.6 Webhook Verification Flow

```
┌──────────────┐   POST /webhooks/zego            ┌──────────────────┐
│  ZEGOCLOUD    │ ──────────────────────────────→  │  Express Backend │
│  Server       │  Headers:                        │                  │
│               │    x-zego-signature: HMAC-SHA256  │  1. Extract      │
│               │    x-zego-timestamp: 1698307264   │     signature    │
│               │  Body:                            │  2. Recompute    │
│               │    { event: "stream_end",         │     HMAC with    │
│               │      stream_id, room_id,          │     callbackSec  │
│               │      timestamp }                  │  3. Compare      │
│               │                                   │  4. If valid →   │
│               │ ←──────────────────────────────── │     update       │
│               │  HTTP 200 OK                      │     LiveStream   │
│               │                                   │     status       │
│               │                                   │  5. Flush Redis  │
│               │                                   │     room keys    │
└──────────────┘                                   └──────────────────┘
```

---

## 2. End-to-End System Integration & Data Sync Map

### 2.1 Real-Time Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FLUTTER CLIENT LAYER                              │
│                                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Host    │  │  Viewer  │  │  Claimer │  │  Voter   │  │  Admin   │    │
│  │  App     │  │  App     │  │  App     │  │  App     │  │  Portal  │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │              │              │              │              │          │
└───────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────┘
        │              │              │              │              │
   ZEGOCLOUD SDK  ZEGOCLOUD SDK  REST API     REST API       REST API
   + REST API     + REST API     + Socket.IO  + Socket.IO    + Socket.IO
        │              │              │              │              │
┌───────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────┐
│       ▼              ▼              ▼              ▼              ▼          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    EXPRESS.JS API GATEWAY                           │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │    │
│  │  │  Auth    │ │  Rate    │ │  Validate│ │  Role    │             │    │
│  │  │  MW     │ │  Limiter │ │  (Zod)   │ │  Guard   │             │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘             │    │
│  └──────────────────────────────────┬──────────────────────────────────┘    │
│                                      │                                      │
│  ┌───────────────────────────────────┼───────────────────────────────────┐  │
│  │                    SERVICE LAYER  │                                    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌─────┴────┐ ┌──────────┐ ┌──────────┐   │  │
│  │  │ Subscrip │ │ GiftItem │ │LiveStream│ │  Story   │ │  Admin   │   │  │
│  │  │ Service  │ │ Service  │ │ Service  │ │  Claim   │ │ Dash     │   │  │
│  │  │          │ │          │ │          │ │  Service │ │ Service  │   │  │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │  │
│  └───────┼──────────────┼──────────────┼──────────────┼──────────────┼───┘  │
│          │              │              │              │              │       │
│  ┌───────▼──────────────▼──────────────▼──────────────▼──────────────▼───┐  │
│  │                         REDIS LAYER                                    │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐   │  │
│  │  │ Cache-Aside     │  │ Active Counters │  │ Ephemeral Room      │   │  │
│  │  │ (Query Results) │  │ (Viewer Counts) │  │ State (TTL-based)   │   │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────┘   │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                      │                                      │
│  ┌───────────────────────────────────▼───────────────────────────────────┐  │
│  │                         MONGODB LAYER                                  │  │
│  │  ┌──────┐ ┌────────┐ ┌──────────┐ ┌───────────┐ ┌────────────────┐  │  │
│  │  │ User │ │GiftItem│ │LiveStream│ │StoryClaim │ │AdminAuditLog   │  │  │
│  │  └──────┘ └────────┘ └──────────┘ └───────────┘ └────────────────┘  │  │
│  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────────────┐   │  │
│  │  │SubscriptionPlan│ │UserSubscription│ │ModerationFlag          │   │  │
│  │  └────────────────┘ └────────────────┘ └────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                     NODE.JS / EXPRESS BACKEND SERVER                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Admin Dashboard Monitoring & Controls

Based on the Figma Admin screens inspected:

| Admin Screen (Figma) | Backend Data Source | Update Frequency |
|---|---|---|
| **Telemetry Overview** — KPI cards (Total Users, Active Streams, Revenue, Gifts Given), charts | `SystemAnalytics` aggregation + Redis cached summaries | Cached 5 min TTL |
| **User Monitoring** — User table with columns (Name, Email, Role, Status, Last Active, Joined), actions (Block, Delete, Inspect) | `User.find()` with `QueryBuilder` pagination | Real-time on action |
| **Listings Monitoring** — Gift items table (Title, Host, Condition, Status, Created, Views), actions (Approve, Reject, Edit, Delete) | `GiftItem.find()` with `QueryBuilder` | Real-time on action |
| **Stories & Claims Audit** — Claims table (Claimant, Stream, Story excerpt, Votes, Status, Admin Review), actions (Approve, Reject, Flag) | `LiveStoryClaim.find()` with populated refs | Real-time on action |
| **Live Stream Watch** — Embedded video player, stream metadata sidebar, moderation bar (Warn, Mute Host, Terminate) | ZEGOCLOUD admin viewer token + `LiveStream` metadata | Real-time via Socket.IO |
| **Watch Live + InspectModal** — Full video view with bottom controls, modal showing stream stats | `LiveStream` + Redis active counters | Real-time |
| **Edit Details Modal** — Form to audit/edit listing metadata (title, description, condition, location) | `GiftItem.findByIdAndUpdate()` | On submit |
| **Inspect User Modal** — User avatar, stats grid (Total Gifts, Streams, Claims), activity log, action buttons (Contact, Warn, Suspend, Ban) | `User` + aggregation pipeline | On open |
| **Revenue** — Revenue chart, subscription breakdown table, transaction list | `UserSubscription` + `PaymentTransaction` aggregation | Cached 15 min TTL |
| **Settings (Light Mode variants)** — System config, notification prefs, API keys | `Setting` model (existing) | On save |

#### Admin Moderation Overrides (from Figma moderation controls):

| Action | API Endpoint | Side Effects |
|---|---|---|
| **Force End Stream** | `PATCH /admin/live-streams/:id/terminate` | Updates `LiveStream.status → 'terminated_by_admin'`, emits `admin_force_end_stream` Socket.IO event, flushes Redis room keys, creates `AdminAuditLog` |
| **Ban User** | `PATCH /admin/users/:id/ban` | Sets `User.isBlocked = true`, force-disconnects all sockets for user, invalidates user session tokens, creates `AdminAuditLog` |
| **Mute Host** | `PATCH /admin/live-streams/:id/mute-host` | Emits `admin_user_muted` via Socket.IO (SDK disables host mic), creates `AdminAuditLog` |
| **Remove Claim** | `DELETE /admin/story-claims/:id` | Soft-deletes `LiveStoryClaim`, unpins if currently pinned, emits `claim_removed` event, creates `AdminAuditLog` |
| **Resolve Winner Conflict** | `PATCH /admin/live-streams/:id/resolve-winner` | Admin override to reassign winner via ACID transaction, creates `AdminAuditLog` |
| **Approve/Reject Gift Listing** | `PATCH /admin/gift-items/:id/review` | Updates `GiftItem.verificationStatus`, sends push notification to host |

### 2.3 Data Consistency & Concurrency Protection

#### ACID Transaction: "Award Live / Pick Winner"

This is the most critical transaction in the entire system. The Figma "GIFT AWARDED LIVE!" screen shows a winner celebration overlay — this must be 100% race-condition-free.

```typescript
// Pseudocode — exact implementation in Phase 4
const session = await mongoose.startSession();
session.startTransaction();

try {
  // Step 1: Lock and verify the LiveStream is still in 'live' status
  //         and has NO existing winner
  const stream = await LiveStream.findOneAndUpdate(
    {
      _id: streamId,
      status: 'live',
      winner: null,  // CRITICAL: prevents double-award
    },
    {
      winner: claimantUserId,
      awardedAt: new Date(),
    },
    { session, new: true }
  );

  if (!stream) {
    throw new AppError(httpStatus.CONFLICT, 'Stream already has a winner or is not live');
  }

  // Step 2: Update the winning StoryClaim to 'awarded'
  await LiveStoryClaim.findOneAndUpdate(
    { _id: claimId, stream: streamId, status: 'pinned' },
    { status: 'awarded', awardedAt: new Date() },
    { session }
  );

  // Step 3: Transition the GiftItem to 'claimed'
  await GiftItem.findOneAndUpdate(
    { _id: stream.giftItem, claimState: 'available' },
    { claimState: 'claimed', claimedBy: claimantUserId, claimedAt: new Date() },
    { session }
  );

  // Step 4: Create audit log
  await AdminAuditLog.create([{
    action: 'GIFT_AWARDED_LIVE',
    performedBy: hostUserId,
    targetUser: claimantUserId,
    targetStream: streamId,
    targetGiftItem: stream.giftItem,
    metadata: { claimId },
  }], { session });

  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

**Why this prevents double-awarding:**
- The `findOneAndUpdate` on `LiveStream` uses `{ winner: null }` as a filter condition. If two concurrent requests race, only the FIRST one will find a matching document (winner is null). The second request will get `null` back and throw a `409 CONFLICT`.
- All four mutations are in a single MongoDB session/transaction. If any step fails, the entire batch rolls back.

### 2.4 Redis Caching & Invalidation Architecture

#### Cache Key Registry

| Key Pattern | Data Stored | TTL | Eviction Trigger |
|---|---|---|---|
| `streams:active` | JSON array of active `LiveStream` summaries | 30s | On stream start/end webhook |
| `stream:{streamId}:state` | Hash: `{viewerCount, pinnedClaimId, timerStartedAt, status}` | 3600s (auto-cleanup) | On stream end, viewer join/leave |
| `stream:{streamId}:viewers` | Redis SET of viewer userIds | 3600s | On stream end |
| `gifts:public:page:{page}` | Paginated public gift listings (available items) | 300s (5 min) | On gift create/update/delete |
| `gifts:featured` | Top 10 featured/promoted gift items | 600s (10 min) | On gift status change |
| `gift:{giftId}` | Single gift item detail | 300s | On update/delete |
| `user:{userId}:profile` | User profile data | 600s | On profile update |
| `user:{userId}:subscription` | Active subscription status | 300s | On subscription change webhook |
| `subscriptions:plans` | All subscription plans | 3600s (1 hr) | On admin plan CRUD |
| `admin:dashboard:summary` | Telemetry overview KPIs | 300s (5 min) | On significant mutations |
| `admin:revenue:summary` | Revenue analytics data | 900s (15 min) | On subscription webhook |
| `admin:streams:active` | Admin view of all active streams with moderation data | 30s | On stream lifecycle events |
| `claims:stream:{streamId}` | Claims list for a specific stream | 60s | On claim submit/pin/award |

#### Cache Invalidation Policy

**Write-Through Invalidation:** Every `create`, `update`, or `delete` mutation in a service MUST call the corresponding cache invalidation:

```typescript
// Pattern used in every service
// After GiftItem.create():
await RedisService.del('gifts:featured');
await RedisService.delByPattern('gifts:public:page:*');

// After LiveStream status change:
await RedisService.del('streams:active');
await RedisService.del(`stream:${streamId}:state`);
await RedisService.del('admin:streams:active');
await RedisService.del('admin:dashboard:summary');

// After UserSubscription change:
await RedisService.del(`user:${userId}:subscription`);
await RedisService.del('admin:revenue:summary');
```

---

## 3. Complete Master Database Models & Strict TypeScript Interfaces

### 3.1 User Model (EXTENDED — Existing + New Fields)

> The existing `User` model at `src/app/modules/user/user.models.ts` is preserved. We ADD new fields without breaking existing schema.

#### Interface: `src/app/modules/user/user.interface.ts` (ADDITIONS)

```typescript
import { HydratedDocument, Model, Types } from 'mongoose';
import { IAddress } from '../../interface/common.interface';
import { LOGIN_WITH_INTERFACE } from '../auth/auth.constant';
import { GENDER_INTERFACE, USER_ROLE, USER_ROLE_INTERFACE } from './user.constants';

export interface TUser {
  _id?: Types.ObjectId | string;
  appleId?: string;
  email: string;
  password: string;
  role: USER_ROLE_INTERFACE;
  address?: IAddress;

  // common fields for all users
  fullName?: string;
  dob?: Date;
  gender?: GENDER_INTERFACE;

  phone?: {
    code?: string;
    number?: string;
    fullNumber: string;
  };
  isPhoneVerified?: boolean;
  profileImage?: string;
  about?: string;

  // status flags
  isBlocked?: boolean;
  isVerifiedByAdmin?: boolean;
  hasCompletedProfile?: boolean;
  isDeleted?: boolean;
  isSuspended?: boolean;            // NEW: temporary suspension (differs from permanent ban)
  suspendedUntil?: Date | null;     // NEW: suspension expiry

  passwordChangedAt?: Date | null;
  loginWth?: LOGIN_WITH_INTERFACE;
  fcmToken?: string | null;

  lastActiveAt?: Date;

  // ===== NEW FIELDS FOR TONYPILOT GIFTING =====

  // Subscription
  subscriptionTier?: 'free' | 'premium' | 'pro';
  activeSubscription?: Types.ObjectId;  // ref → UserSubscription
  subscriptionExpiresAt?: Date | null;

  // Gifting Stats
  totalGiftsGiven?: number;
  totalGiftsReceived?: number;
  totalStreamsHosted?: number;
  totalStoriesClaimed?: number;

  // Social
  socialLinks?: {
    instagram?: string;
    twitter?: string;
    tiktok?: string;
  };

  // Device Info
  deviceInfo?: {
    platform?: 'ios' | 'android' | 'web';
    deviceId?: string;
    appVersion?: string;
    osVersion?: string;
  };

  // Location
  neighborhoodLabel?: string;  // e.g., "Downtown Austin, TX" (from Figma header)

  // Trust & Community
  communityTrustScore?: number;   // 0-100, computed from gift/claim history
  agreedToRules?: boolean;        // Figma: "Community Rules" modal on sign-up
  agreedToRulesAt?: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}
```

#### Schema Additions to `user.models.ts`:

```typescript
// ===== NEW FIELDS (add to existing schema) =====
isSuspended: {
  type: Boolean,
  default: false,
},
suspendedUntil: {
  type: Date,
  default: null,
},
subscriptionTier: {
  type: String,
  enum: ['free', 'premium', 'pro'],
  default: 'free',
},
activeSubscription: {
  type: Schema.Types.ObjectId,
  ref: 'UserSubscription',
  default: null,
},
totalGiftsGiven: { type: Number, default: 0 },
totalGiftsReceived: { type: Number, default: 0 },
totalStreamsHosted: { type: Number, default: 0 },
totalStoriesClaimed: { type: Number, default: 0 },
socialLinks: {
  instagram: { type: String, default: '' },
  twitter: { type: String, default: '' },
  tiktok: { type: String, default: '' },
},
deviceInfo: {
  platform: { type: String, enum: ['ios', 'android', 'web'] },
  deviceId: { type: String, default: '' },
  appVersion: { type: String, default: '' },
  osVersion: { type: String, default: '' },
},
neighborhoodLabel: { type: String, default: '' },
communityTrustScore: { type: Number, default: 50, min: 0, max: 100 },
agreedToRules: { type: Boolean, default: false },
agreedToRulesAt: { type: Date, default: null },

// ===== NEW INDEXES =====
// Add after existing indexes:
userSchema.index({ subscriptionTier: 1, isBlocked: 1, isDeleted: 1 });
userSchema.index({ neighborhoodLabel: 1 });
userSchema.index({ communityTrustScore: -1 });
userSchema.index({ isSuspended: 1, suspendedUntil: 1 });
```

---

### 3.2 SubscriptionPlan & UserSubscription

#### Interface: `src/app/modules/Subscription/subscription.interface.ts`

```typescript
import { Types, Model } from 'mongoose';

// ==========================================
// SUBSCRIPTION PLAN (Admin-managed catalog)
// ==========================================
export type SubscriptionTier = 'free' | 'premium' | 'pro';
export type BillingCycle = 'monthly' | 'yearly';

export interface TSubscriptionPlanFeatures {
  maxGiftPostsPerMonth: number;       // free=3, premium=20, pro=unlimited(-1)
  maxLiveStreamsPerMonth: number;      // free=1, premium=10, pro=unlimited(-1)
  maxStreamDurationMinutes: number;   // free=15, premium=60, pro=180
  maxStoryClaimsPerDay: number;       // free=3, premium=15, pro=unlimited(-1)
  priorityInDiscoverFeed: boolean;    // free=false, premium=true, pro=true
  verifiedBadge: boolean;             // free=false, premium=false, pro=true
  analyticsAccess: boolean;           // free=false, premium=basic, pro=advanced
  adFreeExperience: boolean;          // free=false, premium=true, pro=true
}

export interface TSubscriptionPlan {
  _id?: Types.ObjectId | string;
  tier: SubscriptionTier;
  name: string;                        // "Free", "Premium", "Pro"
  description: string;
  billingCycle: BillingCycle;
  priceInCents: number;                // 0 for free, 999 for premium, 2499 for pro
  currency: string;                    // "usd"
  stripePriceId: string;              // Stripe Price ID (e.g., "price_1Abc...")
  stripeProductId: string;            // Stripe Product ID
  features: TSubscriptionPlanFeatures;
  isActive: boolean;                   // admin can deactivate a plan
  sortOrder: number;                   // display order in UI
  trialDays: number;                   // 0 = no trial, 7 = 7-day trial

  createdAt?: Date;
  updatedAt?: Date;
}

export interface SubscriptionPlanModel extends Model<TSubscriptionPlan> {}

// ==========================================
// USER SUBSCRIPTION (Per-user active record)
// ==========================================
export type SubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'trialing'
  | 'unpaid'
  | 'incomplete'
  | 'expired';

export interface TUserSubscription {
  _id?: Types.ObjectId | string;
  user: Types.ObjectId;               // ref → User
  plan: Types.ObjectId;               // ref → SubscriptionPlan
  tier: SubscriptionTier;             // denormalized for fast queries
  status: SubscriptionStatus;

  // Stripe references
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripeLatestInvoiceId?: string;

  // Billing
  billingCycle: BillingCycle;
  priceInCents: number;
  currency: string;

  // Dates
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date | null;
  trialEnd?: Date | null;
  canceledAt?: Date | null;
  cancelReason?: string;

  // Webhook tracking
  lastWebhookEvent?: string;          // e.g., "invoice.paid"
  lastWebhookAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserSubscriptionModel extends Model<TUserSubscription> {}

// ==========================================
// PAYMENT TRANSACTION LOG
// ==========================================
export type TransactionType = 'subscription_payment' | 'subscription_refund' | 'one_time';
export type TransactionStatus = 'succeeded' | 'failed' | 'pending' | 'refunded';

export interface TPaymentTransaction {
  _id?: Types.ObjectId | string;
  user: Types.ObjectId;
  subscription?: Types.ObjectId;       // ref → UserSubscription (optional for one-time)
  stripePaymentIntentId: string;
  stripeInvoiceId?: string;
  type: TransactionType;
  status: TransactionStatus;
  amountInCents: number;
  currency: string;
  description: string;
  failureReason?: string;
  metadata?: Record<string, string>;

  createdAt?: Date;
  updatedAt?: Date;
}
```

#### Schema: `src/app/modules/Subscription/subscription.model.ts`

```typescript
import { Schema, model } from 'mongoose';
import {
  TSubscriptionPlan,
  SubscriptionPlanModel,
  TUserSubscription,
  UserSubscriptionModel,
  TPaymentTransaction,
} from './subscription.interface';

// ==========================================
// SUBSCRIPTION PLAN SCHEMA
// ==========================================
const subscriptionPlanFeaturesSchema = new Schema(
  {
    maxGiftPostsPerMonth: { type: Number, required: true },
    maxLiveStreamsPerMonth: { type: Number, required: true },
    maxStreamDurationMinutes: { type: Number, required: true },
    maxStoryClaimsPerDay: { type: Number, required: true },
    priorityInDiscoverFeed: { type: Boolean, default: false },
    verifiedBadge: { type: Boolean, default: false },
    analyticsAccess: { type: Boolean, default: false },
    adFreeExperience: { type: Boolean, default: false },
  },
  { _id: false }
);

const subscriptionPlanSchema = new Schema<TSubscriptionPlan>(
  {
    tier: {
      type: String,
      enum: ['free', 'premium', 'pro'],
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly'],
      required: true,
    },
    priceInCents: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: 'usd',
      lowercase: true,
    },
    stripePriceId: {
      type: String,
      required: true,
      unique: true,
    },
    stripeProductId: {
      type: String,
      required: true,
    },
    features: {
      type: subscriptionPlanFeaturesSchema,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    trialDays: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

subscriptionPlanSchema.index({ tier: 1, billingCycle: 1 }, { unique: true });
subscriptionPlanSchema.index({ isActive: 1, sortOrder: 1 });

export const SubscriptionPlan = model<TSubscriptionPlan, SubscriptionPlanModel>(
  'SubscriptionPlan',
  subscriptionPlanSchema
);

// ==========================================
// USER SUBSCRIPTION SCHEMA
// ==========================================
const userSubscriptionSchema = new Schema<TUserSubscription>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    plan: {
      type: Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: true,
    },
    tier: {
      type: String,
      enum: ['free', 'premium', 'pro'],
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'canceled', 'past_due', 'trialing', 'unpaid', 'incomplete', 'expired'],
      required: true,
      default: 'incomplete',
    },
    stripeCustomerId: {
      type: String,
      required: true,
      index: true,
    },
    stripeSubscriptionId: {
      type: String,
      required: true,
      unique: true,
    },
    stripeLatestInvoiceId: {
      type: String,
      default: '',
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly'],
      required: true,
    },
    priceInCents: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: 'usd',
    },
    currentPeriodStart: {
      type: Date,
      required: true,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
    },
    trialStart: { type: Date, default: null },
    trialEnd: { type: Date, default: null },
    canceledAt: { type: Date, default: null },
    cancelReason: { type: String, default: '' },
    lastWebhookEvent: { type: String, default: '' },
    lastWebhookAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSubscriptionSchema.index({ user: 1, status: 1 });
userSubscriptionSchema.index({ stripeSubscriptionId: 1 }, { unique: true });
userSubscriptionSchema.index({ currentPeriodEnd: 1, status: 1 }); // for expiry checks

export const UserSubscription = model<TUserSubscription, UserSubscriptionModel>(
  'UserSubscription',
  userSubscriptionSchema
);

// ==========================================
// PAYMENT TRANSACTION SCHEMA
// ==========================================
const paymentTransactionSchema = new Schema<TPaymentTransaction>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    subscription: {
      type: Schema.Types.ObjectId,
      ref: 'UserSubscription',
    },
    stripePaymentIntentId: {
      type: String,
      required: true,
      unique: true,
    },
    stripeInvoiceId: { type: String, default: '' },
    type: {
      type: String,
      enum: ['subscription_payment', 'subscription_refund', 'one_time'],
      required: true,
    },
    status: {
      type: String,
      enum: ['succeeded', 'failed', 'pending', 'refunded'],
      required: true,
    },
    amountInCents: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      default: 'usd',
    },
    description: {
      type: String,
      required: true,
    },
    failureReason: { type: String, default: '' },
    metadata: {
      type: Map,
      of: String,
      default: {},
    },
  },
  { timestamps: true }
);

paymentTransactionSchema.index({ user: 1, createdAt: -1 });
paymentTransactionSchema.index({ stripePaymentIntentId: 1 }, { unique: true });
paymentTransactionSchema.index({ status: 1, type: 1 });

export const PaymentTransaction = model<TPaymentTransaction>(
  'PaymentTransaction',
  paymentTransactionSchema
);
```

---

### 3.3 GiftItem

#### Interface: `src/app/modules/GiftItem/giftItem.interface.ts`

```typescript
import { Types, Model } from 'mongoose';

export type GiftCondition = 'new' | 'like_new' | 'good' | 'fair' | 'worn';
export type GiftVerificationStatus = 'pending_review' | 'approved' | 'rejected' | 'flagged';
export type GiftClaimState = 'available' | 'claimed' | 'pickup_arranged' | 'delivered' | 'expired';
export type GiftCategory =
  | 'electronics'
  | 'furniture'
  | 'clothing'
  | 'toys'
  | 'books'
  | 'kitchen'
  | 'sports'
  | 'home_decor'
  | 'tools'
  | 'other';

export interface TGiftItem {
  _id?: Types.ObjectId | string;
  host: Types.ObjectId;                 // ref → User (the giver)

  // Step 1: Photos & Title
  title: string;
  images: string[];                     // array of uploaded image URLs (max 5)
  coverImageIndex: number;              // which image is the hero/cover

  // Step 2: Details & Condition
  description: string;
  condition: GiftCondition;
  category: GiftCategory;
  estimatedValue?: number;              // optional, in USD
  tags: string[];                       // e.g., ["vintage", "designer"]

  // Step 3: Location & Pickup
  pickupAddress: {
    address: string;
    location: {
      type: 'Point';
      coordinates: [number, number];    // [longitude, latitude]
    };
  };
  pickupInstructions?: string;          // e.g., "Ring bell for unit 3B"
  pickupRadius?: number;                // max distance in miles for display

  // Step 4: Timing & Instructions
  availableFrom: Date;
  availableUntil?: Date;                // optional expiry
  pickupWindowStart?: string;           // e.g., "09:00"
  pickupWindowEnd?: string;             // e.g., "17:00"
  specialInstructions?: string;

  // Step 5: Review & Publish (computed)
  verificationStatus: GiftVerificationStatus;
  claimState: GiftClaimState;
  isPublished: boolean;
  publishedAt?: Date | null;

  // Claim / Award
  claimedBy?: Types.ObjectId | null;    // ref → User (the receiver)
  claimedAt?: Date | null;
  associatedStream?: Types.ObjectId | null; // ref → LiveStream (if given away via live)

  // Metrics
  viewCount: number;
  storyClaimCount: number;              // total stories submitted for this gift

  // Admin
  adminReviewedBy?: Types.ObjectId | null;
  adminReviewedAt?: Date | null;
  adminReviewNotes?: string;
  rejectionReason?: string;

  // Soft delete
  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface GiftItemModel extends Model<TGiftItem> {}
```

#### Schema: `src/app/modules/GiftItem/giftItem.model.ts`

```typescript
import { Schema, model, Query } from 'mongoose';
import { TGiftItem, GiftItemModel } from './giftItem.interface';

const giftItemSchema = new Schema<TGiftItem>(
  {
    host: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Host user is required'],
      index: true,
    },

    // Step 1
    title: {
      type: String,
      required: [true, 'Gift title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    images: {
      type: [String],
      required: true,
      validate: {
        validator: (v: string[]) => v.length >= 1 && v.length <= 5,
        message: 'Must have between 1 and 5 images',
      },
    },
    coverImageIndex: {
      type: Number,
      default: 0,
      min: 0,
      max: 4,
    },

    // Step 2
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    condition: {
      type: String,
      enum: ['new', 'like_new', 'good', 'fair', 'worn'],
      required: [true, 'Condition is required'],
    },
    category: {
      type: String,
      enum: [
        'electronics', 'furniture', 'clothing', 'toys', 'books',
        'kitchen', 'sports', 'home_decor', 'tools', 'other',
      ],
      required: [true, 'Category is required'],
    },
    estimatedValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]) => v.length <= 10,
        message: 'Cannot have more than 10 tags',
      },
    },

    // Step 3
    pickupAddress: {
      address: { type: String, required: true },
      location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: {
          type: [Number],
          required: true,
          validate: {
            validator: (v: number[]) => v.length === 2,
            message: 'Coordinates must be [longitude, latitude]',
          },
        },
      },
    },
    pickupInstructions: { type: String, default: '', maxlength: 500 },
    pickupRadius: { type: Number, default: 25, min: 1, max: 100 },

    // Step 4
    availableFrom: {
      type: Date,
      required: [true, 'Available from date is required'],
    },
    availableUntil: { type: Date, default: null },
    pickupWindowStart: { type: String, default: '' },
    pickupWindowEnd: { type: String, default: '' },
    specialInstructions: { type: String, default: '', maxlength: 1000 },

    // Step 5
    verificationStatus: {
      type: String,
      enum: ['pending_review', 'approved', 'rejected', 'flagged'],
      default: 'pending_review',
    },
    claimState: {
      type: String,
      enum: ['available', 'claimed', 'pickup_arranged', 'delivered', 'expired'],
      default: 'available',
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    publishedAt: { type: Date, default: null },

    // Claim
    claimedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    claimedAt: { type: Date, default: null },
    associatedStream: {
      type: Schema.Types.ObjectId,
      ref: 'LiveStream',
      default: null,
    },

    // Metrics
    viewCount: { type: Number, default: 0 },
    storyClaimCount: { type: Number, default: 0 },

    // Admin
    adminReviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    adminReviewedAt: { type: Date, default: null },
    adminReviewNotes: { type: String, default: '' },
    rejectionReason: { type: String, default: '' },

    // Soft delete
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// ===== INDEXES =====
giftItemSchema.index({ host: 1, isDeleted: 1, createdAt: -1 });
giftItemSchema.index({ claimState: 1, verificationStatus: 1, isPublished: 1, isDeleted: 1 });
giftItemSchema.index({ category: 1, claimState: 1 });
giftItemSchema.index({ 'pickupAddress.location': '2dsphere' });
giftItemSchema.index({ createdAt: -1, isPublished: 1 });
giftItemSchema.index({ availableUntil: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { claimState: 'available' } }); // TTL for expired gifts

// Soft-delete filter
giftItemSchema.pre<Query<any, TGiftItem>>(/^find/, function (next) {
  const query = this;
  if (!(query.getOptions() as any).ignoreDeleted) {
    query.find({ isDeleted: { $ne: true } });
  }
  next();
});

export const GiftItem = model<TGiftItem, GiftItemModel>('GiftItem', giftItemSchema);
```

---

### 3.4 LiveStream

#### Interface: `src/app/modules/LiveStream/liveStream.interface.ts`

```typescript
import { Types, Model } from 'mongoose';

export type LiveStreamStatus = 'scheduled' | 'live' | 'ended' | 'terminated_by_admin';

export interface TLiveStream {
  _id?: Types.ObjectId | string;

  // Room / Channel
  roomId: string;                       // ZEGOCLOUD room ID (generated UUID)
  channelName: string;                  // Human-readable channel name

  // Host
  host: Types.ObjectId;                 // ref → User

  // Gift Association
  giftItem: Types.ObjectId;             // ref → GiftItem (the item being given away)

  // Stream State
  status: LiveStreamStatus;
  scheduledAt?: Date;
  startedAt?: Date | null;
  endedAt?: Date | null;

  // Timer (server-authoritative)
  timerDurationSeconds: number;         // configured duration (e.g., 900 = 15 min)
  actualDurationSeconds?: number;       // computed on end

  // Viewer Metrics (persisted from Redis on stream end)
  peakViewers: number;
  totalUniqueViewers: number;
  totalReach: number;                   // impressions (views on discover feed)

  // Winner / Award
  winner?: Types.ObjectId | null;       // ref → User (awarded recipient)
  winningClaim?: Types.ObjectId | null; // ref → LiveStoryClaim
  awardedAt?: Date | null;

  // Pinned State
  pinnedClaim?: Types.ObjectId | null;  // ref → LiveStoryClaim (currently pinned)
  pinnedGiftCard?: boolean;             // whether the gift card is pinned/visible

  // Story Claims Summary
  totalClaimsReceived: number;
  totalClaimsPinned: number;

  // Admin Moderation
  terminatedBy?: Types.ObjectId | null; // ref → User (admin who terminated)
  terminationReason?: string;

  // Wrap-Up Summary (computed on stream end)
  wrapUpSummary?: {
    airTimeFormatted: string;           // e.g., "14:32"
    totalLiveClaims: number;
    peakViewerCount: number;
    totalReachCount: number;
    winnerName?: string;
    giftTitle?: string;
  };

  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface LiveStreamModel extends Model<TLiveStream> {}
```

#### Schema: `src/app/modules/LiveStream/liveStream.model.ts`

```typescript
import { Schema, model, Query } from 'mongoose';
import { TLiveStream, LiveStreamModel } from './liveStream.interface';

const liveStreamSchema = new Schema<TLiveStream>(
  {
    roomId: {
      type: String,
      required: [true, 'Room ID is required'],
      unique: true,
      index: true,
    },
    channelName: {
      type: String,
      required: [true, 'Channel name is required'],
      trim: true,
      maxlength: 100,
    },
    host: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Host is required'],
      index: true,
    },
    giftItem: {
      type: Schema.Types.ObjectId,
      ref: 'GiftItem',
      required: [true, 'Gift item is required'],
    },
    status: {
      type: String,
      enum: ['scheduled', 'live', 'ended', 'terminated_by_admin'],
      required: true,
      default: 'scheduled',
    },
    scheduledAt: { type: Date },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },

    timerDurationSeconds: {
      type: Number,
      required: true,
      default: 900,
      min: 60,
      max: 10800, // 3 hours max
    },
    actualDurationSeconds: { type: Number, default: 0 },

    peakViewers: { type: Number, default: 0 },
    totalUniqueViewers: { type: Number, default: 0 },
    totalReach: { type: Number, default: 0 },

    winner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    winningClaim: {
      type: Schema.Types.ObjectId,
      ref: 'LiveStoryClaim',
      default: null,
    },
    awardedAt: { type: Date, default: null },

    pinnedClaim: {
      type: Schema.Types.ObjectId,
      ref: 'LiveStoryClaim',
      default: null,
    },
    pinnedGiftCard: { type: Boolean, default: true },

    totalClaimsReceived: { type: Number, default: 0 },
    totalClaimsPinned: { type: Number, default: 0 },

    terminatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    terminationReason: { type: String, default: '' },

    wrapUpSummary: {
      airTimeFormatted: { type: String, default: '' },
      totalLiveClaims: { type: Number, default: 0 },
      peakViewerCount: { type: Number, default: 0 },
      totalReachCount: { type: Number, default: 0 },
      winnerName: { type: String, default: '' },
      giftTitle: { type: String, default: '' },
    },

    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// ===== INDEXES =====
liveStreamSchema.index({ status: 1, createdAt: -1 });
liveStreamSchema.index({ host: 1, status: 1 });
liveStreamSchema.index({ giftItem: 1 });
liveStreamSchema.index({ startedAt: -1 });
liveStreamSchema.index({ status: 1, startedAt: -1 }); // for active streams query

// Soft-delete filter
liveStreamSchema.pre<Query<any, TLiveStream>>(/^find/, function (next) {
  const query = this;
  if (!(query.getOptions() as any).ignoreDeleted) {
    query.find({ isDeleted: { $ne: true } });
  }
  next();
});

export const LiveStream = model<TLiveStream, LiveStreamModel>('LiveStream', liveStreamSchema);
```

---

### 3.5 LiveStoryClaim

#### Interface: `src/app/modules/StoryClaim/storyClaim.interface.ts`

```typescript
import { Types, Model } from 'mongoose';

export type StoryClaimStatus = 'pending' | 'pinned' | 'awarded' | 'rejected' | 'withdrawn';
export type AdminReviewStatus = 'not_reviewed' | 'approved' | 'flagged' | 'removed';

export interface TLiveStoryClaim {
  _id?: Types.ObjectId | string;

  applicant: Types.ObjectId;            // ref → User (person requesting the gift)
  stream: Types.ObjectId;               // ref → LiveStream
  giftItem: Types.ObjectId;             // ref → GiftItem (denormalized for fast queries)

  // Story Content
  storyStatement: string;               // The applicant's story text (why they need the gift)
  storyMediaUrl?: string;               // Optional image/video attachment

  // Status
  status: StoryClaimStatus;

  // Community Voting
  upvotes: number;
  downvotes: number;
  voterIds: Types.ObjectId[];           // track who voted (prevent double voting)

  // Pinning
  isPinned: boolean;
  pinnedAt?: Date | null;
  unpinnedAt?: Date | null;

  // Award
  awardedAt?: Date | null;

  // Admin
  adminReviewStatus: AdminReviewStatus;
  adminReviewedBy?: Types.ObjectId | null;
  adminReviewNotes?: string;
  adminRemovedAt?: Date | null;

  // Pickup (post-award)
  pickupConfirmed: boolean;
  pickupConfirmedAt?: Date | null;
  pickupNotes?: string;

  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface LiveStoryClaimModel extends Model<TLiveStoryClaim> {}
```

#### Schema: `src/app/modules/StoryClaim/storyClaim.model.ts`

```typescript
import { Schema, model, Query } from 'mongoose';
import { TLiveStoryClaim, LiveStoryClaimModel } from './storyClaim.interface';

const liveStoryClaimSchema = new Schema<TLiveStoryClaim>(
  {
    applicant: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Applicant is required'],
      index: true,
    },
    stream: {
      type: Schema.Types.ObjectId,
      ref: 'LiveStream',
      required: [true, 'Stream is required'],
      index: true,
    },
    giftItem: {
      type: Schema.Types.ObjectId,
      ref: 'GiftItem',
      required: [true, 'Gift item is required'],
    },

    storyStatement: {
      type: String,
      required: [true, 'Story statement is required'],
      trim: true,
      maxlength: [3000, 'Story cannot exceed 3000 characters'],
      minlength: [20, 'Story must be at least 20 characters'],
    },
    storyMediaUrl: { type: String, default: '' },

    status: {
      type: String,
      enum: ['pending', 'pinned', 'awarded', 'rejected', 'withdrawn'],
      default: 'pending',
    },

    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
    voterIds: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],

    isPinned: { type: Boolean, default: false },
    pinnedAt: { type: Date, default: null },
    unpinnedAt: { type: Date, default: null },
    awardedAt: { type: Date, default: null },

    adminReviewStatus: {
      type: String,
      enum: ['not_reviewed', 'approved', 'flagged', 'removed'],
      default: 'not_reviewed',
    },
    adminReviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    adminReviewNotes: { type: String, default: '' },
    adminRemovedAt: { type: Date, default: null },

    pickupConfirmed: { type: Boolean, default: false },
    pickupConfirmedAt: { type: Date, default: null },
    pickupNotes: { type: String, default: '', maxlength: 500 },

    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// ===== INDEXES =====
liveStoryClaimSchema.index({ stream: 1, status: 1, createdAt: -1 });
liveStoryClaimSchema.index({ applicant: 1, stream: 1 }, { unique: true }); // one claim per user per stream
liveStoryClaimSchema.index({ stream: 1, isPinned: 1 });
liveStoryClaimSchema.index({ giftItem: 1, status: 1 });
liveStoryClaimSchema.index({ adminReviewStatus: 1 });

// Soft-delete filter
liveStoryClaimSchema.pre<Query<any, TLiveStoryClaim>>(/^find/, function (next) {
  const query = this;
  if (!(query.getOptions() as any).ignoreDeleted) {
    query.find({ isDeleted: { $ne: true } });
  }
  next();
});

export const LiveStoryClaim = model<TLiveStoryClaim, LiveStoryClaimModel>(
  'LiveStoryClaim',
  liveStoryClaimSchema
);
```

---

### 3.6 LiveComment & ModerationFlag

#### Interface: `src/app/modules/LiveComment/liveComment.interface.ts`

```typescript
import { Types, Model } from 'mongoose';

export type CommentType = 'text' | 'emoji_reaction' | 'system';

export interface TLiveComment {
  _id?: Types.ObjectId | string;
  stream: Types.ObjectId;               // ref → LiveStream
  user: Types.ObjectId;                 // ref → User
  message: string;
  commentType: CommentType;
  isPinned: boolean;
  pinnedAt?: Date | null;
  pinnedBy?: Types.ObjectId | null;     // ref → User (host or admin)

  isDeletedByMod: boolean;
  deletedByModAt?: Date | null;
  deletedByModUser?: Types.ObjectId | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface LiveCommentModel extends Model<TLiveComment> {}

// ==========================================
// MODERATION FLAG
// ==========================================
export type FlagTargetType = 'live_comment' | 'story_claim' | 'gift_item' | 'user' | 'live_stream';
export type FlagReasonCode =
  | 'inappropriate_content'
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'scam_fraud'
  | 'misleading_info'
  | 'violence'
  | 'other';
export type FlagResolutionStatus = 'open' | 'reviewed' | 'resolved_no_action' | 'resolved_action_taken';

export interface TModerationFlag {
  _id?: Types.ObjectId | string;
  reporter: Types.ObjectId;             // ref → User (who reported)
  targetType: FlagTargetType;
  targetId: Types.ObjectId;             // polymorphic ref
  targetRef: string;                    // collection name for populate

  reasonCode: FlagReasonCode;
  reasonText?: string;                  // free-text detail

  resolutionStatus: FlagResolutionStatus;
  resolvedBy?: Types.ObjectId | null;   // ref → User (admin)
  resolvedAt?: Date | null;
  resolutionNotes?: string;
  actionTaken?: string;                 // e.g., "user_warned", "content_removed", "user_banned"

  createdAt?: Date;
  updatedAt?: Date;
}

export interface ModerationFlagModel extends Model<TModerationFlag> {}
```

#### Schema: `src/app/modules/LiveComment/liveComment.model.ts`

```typescript
import { Schema, model } from 'mongoose';
import {
  TLiveComment, LiveCommentModel,
  TModerationFlag, ModerationFlagModel,
} from './liveComment.interface';

const liveCommentSchema = new Schema<TLiveComment>(
  {
    stream: {
      type: Schema.Types.ObjectId,
      ref: 'LiveStream',
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    commentType: {
      type: String,
      enum: ['text', 'emoji_reaction', 'system'],
      default: 'text',
    },
    isPinned: { type: Boolean, default: false },
    pinnedAt: { type: Date, default: null },
    pinnedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    isDeletedByMod: { type: Boolean, default: false },
    deletedByModAt: { type: Date, default: null },
    deletedByModUser: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

liveCommentSchema.index({ stream: 1, createdAt: -1 });
liveCommentSchema.index({ stream: 1, isPinned: 1 });
// TTL: Auto-delete comments 7 days after stream ends
liveCommentSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

export const LiveComment = model<TLiveComment, LiveCommentModel>('LiveComment', liveCommentSchema);

// ==========================================
// MODERATION FLAG SCHEMA
// ==========================================
const moderationFlagSchema = new Schema<TModerationFlag>(
  {
    reporter: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ['live_comment', 'story_claim', 'gift_item', 'user', 'live_stream'],
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    targetRef: {
      type: String,
      required: true,
      enum: ['LiveComment', 'LiveStoryClaim', 'GiftItem', 'User', 'LiveStream'],
    },

    reasonCode: {
      type: String,
      enum: [
        'inappropriate_content', 'spam', 'harassment', 'hate_speech',
        'scam_fraud', 'misleading_info', 'violence', 'other',
      ],
      required: true,
    },
    reasonText: { type: String, default: '', maxlength: 1000 },

    resolutionStatus: {
      type: String,
      enum: ['open', 'reviewed', 'resolved_no_action', 'resolved_action_taken'],
      default: 'open',
    },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    resolutionNotes: { type: String, default: '' },
    actionTaken: { type: String, default: '' },
  },
  { timestamps: true }
);

moderationFlagSchema.index({ targetType: 1, targetId: 1 });
moderationFlagSchema.index({ resolutionStatus: 1, createdAt: -1 });
moderationFlagSchema.index({ reporter: 1, targetType: 1, targetId: 1 }, { unique: true }); // prevent duplicate flags

export const ModerationFlag = model<TModerationFlag, ModerationFlagModel>(
  'ModerationFlag',
  moderationFlagSchema
);
```

---

### 3.7 ChatDocument & MediaAttachment

> The existing `Chat` and `Message` models handle DM/group chat. We extend `Message` to support the chat-document upload pattern.

#### Additional Interface fields for `src/app/modules/Message/message.interface.ts`:

```typescript
// EXISTING IMessageAttachment is sufficient. The multer upload pattern
// creates attachments with { url, fileType, name, size }.
// No new model needed — we use the existing Message model with attachments[].
// The route will use multer: upload.fields([{ name: 'uploadChatDocument', maxCount: 5 }])
```

No new model is required. The existing `Message.attachments[]` sub-document already stores `{ url, fileType, name, size }` which matches the multer upload pattern.

---

### 3.8 AdminAuditLog & SystemAnalytics

#### Interface: `src/app/modules/AuditLog/auditLog.interface.ts`

```typescript
import { Types, Model } from 'mongoose';

export type AuditAction =
  | 'GIFT_AWARDED_LIVE'
  | 'STREAM_TERMINATED_BY_ADMIN'
  | 'USER_BANNED'
  | 'USER_UNBANNED'
  | 'USER_SUSPENDED'
  | 'USER_WARNED'
  | 'HOST_MUTED'
  | 'CLAIM_REMOVED'
  | 'CLAIM_APPROVED'
  | 'CLAIM_FLAGGED'
  | 'GIFT_APPROVED'
  | 'GIFT_REJECTED'
  | 'GIFT_FLAGGED'
  | 'COMMENT_DELETED'
  | 'WINNER_REASSIGNED'
  | 'SUBSCRIPTION_PLAN_CREATED'
  | 'SUBSCRIPTION_PLAN_UPDATED'
  | 'SUBSCRIPTION_PLAN_DEACTIVATED'
  | 'MODERATION_FLAG_RESOLVED'
  | 'SYSTEM_SETTING_CHANGED';

export interface TAdminAuditLog {
  _id?: Types.ObjectId | string;
  action: AuditAction;
  performedBy: Types.ObjectId;          // ref → User (admin)
  performedByRole: string;              // 'admin' | 'super_admin'

  // Target references (all optional, depends on action)
  targetUser?: Types.ObjectId | null;
  targetStream?: Types.ObjectId | null;
  targetGiftItem?: Types.ObjectId | null;
  targetClaim?: Types.ObjectId | null;
  targetComment?: Types.ObjectId | null;
  targetFlag?: Types.ObjectId | null;

  // Context
  metadata: Record<string, any>;       // action-specific data
  ipAddress?: string;
  userAgent?: string;

  createdAt?: Date;
}

export interface AdminAuditLogModel extends Model<TAdminAuditLog> {}

// ==========================================
// SYSTEM ANALYTICS (Daily Snapshots)
// ==========================================
export interface TSystemAnalytics {
  _id?: Types.ObjectId | string;
  date: Date;                           // YYYY-MM-DD (daily snapshot)

  // User Metrics
  totalUsers: number;
  newUsersToday: number;
  activeUsersToday: number;             // users with lastActiveAt within 24h
  blockedUsers: number;

  // Gift Metrics
  totalGiftsPublished: number;
  giftsPublishedToday: number;
  giftsClaimedToday: number;
  giftsDeliveredToday: number;

  // Stream Metrics
  totalStreamsHosted: number;
  streamsHostedToday: number;
  peakConcurrentViewersToday: number;
  totalViewMinutesToday: number;

  // Claim Metrics
  totalClaimsSubmitted: number;
  claimsSubmittedToday: number;
  claimsAwardedToday: number;

  // Revenue Metrics
  totalRevenueCents: number;
  revenueTodayCents: number;
  activeSubscriptions: number;
  newSubscriptionsToday: number;
  churnsToday: number;

  // Moderation Metrics
  openFlags: number;
  flagsResolvedToday: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface SystemAnalyticsModel extends Model<TSystemAnalytics> {}
```

#### Schema: `src/app/modules/AuditLog/auditLog.model.ts`

```typescript
import { Schema, model } from 'mongoose';
import {
  TAdminAuditLog, AdminAuditLogModel,
  TSystemAnalytics, SystemAnalyticsModel,
} from './auditLog.interface';

const adminAuditLogSchema = new Schema<TAdminAuditLog>(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'GIFT_AWARDED_LIVE', 'STREAM_TERMINATED_BY_ADMIN',
        'USER_BANNED', 'USER_UNBANNED', 'USER_SUSPENDED', 'USER_WARNED',
        'HOST_MUTED', 'CLAIM_REMOVED', 'CLAIM_APPROVED', 'CLAIM_FLAGGED',
        'GIFT_APPROVED', 'GIFT_REJECTED', 'GIFT_FLAGGED',
        'COMMENT_DELETED', 'WINNER_REASSIGNED',
        'SUBSCRIPTION_PLAN_CREATED', 'SUBSCRIPTION_PLAN_UPDATED', 'SUBSCRIPTION_PLAN_DEACTIVATED',
        'MODERATION_FLAG_RESOLVED', 'SYSTEM_SETTING_CHANGED',
      ],
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    performedByRole: {
      type: String,
      required: true,
      enum: ['admin', 'super_admin'],
    },

    targetUser: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    targetStream: { type: Schema.Types.ObjectId, ref: 'LiveStream', default: null },
    targetGiftItem: { type: Schema.Types.ObjectId, ref: 'GiftItem', default: null },
    targetClaim: { type: Schema.Types.ObjectId, ref: 'LiveStoryClaim', default: null },
    targetComment: { type: Schema.Types.ObjectId, ref: 'LiveComment', default: null },
    targetFlag: { type: Schema.Types.ObjectId, ref: 'ModerationFlag', default: null },

    metadata: { type: Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

adminAuditLogSchema.index({ action: 1, createdAt: -1 });
adminAuditLogSchema.index({ performedBy: 1, createdAt: -1 });
adminAuditLogSchema.index({ targetUser: 1 });
adminAuditLogSchema.index({ targetStream: 1 });
adminAuditLogSchema.index({ createdAt: -1 });

export const AdminAuditLog = model<TAdminAuditLog, AdminAuditLogModel>(
  'AdminAuditLog',
  adminAuditLogSchema
);

// ==========================================
// SYSTEM ANALYTICS SCHEMA
// ==========================================
const systemAnalyticsSchema = new Schema<TSystemAnalytics>(
  {
    date: { type: Date, required: true, unique: true },

    totalUsers: { type: Number, default: 0 },
    newUsersToday: { type: Number, default: 0 },
    activeUsersToday: { type: Number, default: 0 },
    blockedUsers: { type: Number, default: 0 },

    totalGiftsPublished: { type: Number, default: 0 },
    giftsPublishedToday: { type: Number, default: 0 },
    giftsClaimedToday: { type: Number, default: 0 },
    giftsDeliveredToday: { type: Number, default: 0 },

    totalStreamsHosted: { type: Number, default: 0 },
    streamsHostedToday: { type: Number, default: 0 },
    peakConcurrentViewersToday: { type: Number, default: 0 },
    totalViewMinutesToday: { type: Number, default: 0 },

    totalClaimsSubmitted: { type: Number, default: 0 },
    claimsSubmittedToday: { type: Number, default: 0 },
    claimsAwardedToday: { type: Number, default: 0 },

    totalRevenueCents: { type: Number, default: 0 },
    revenueTodayCents: { type: Number, default: 0 },
    activeSubscriptions: { type: Number, default: 0 },
    newSubscriptionsToday: { type: Number, default: 0 },
    churnsToday: { type: Number, default: 0 },

    openFlags: { type: Number, default: 0 },
    flagsResolvedToday: { type: Number, default: 0 },
  },
  { timestamps: true }
);

systemAnalyticsSchema.index({ date: -1 });

export const SystemAnalytics = model<TSystemAnalytics, SystemAnalyticsModel>(
  'SystemAnalytics',
  systemAnalyticsSchema
);
```

---


## 4. Complete Unified API Catalog (Existing + Brand New Modules)

All endpoints conform strictly to the standard architectural pattern:
- **Middleware stack:** `auth(allowedRoles)` -> `fileUpload(...)` (if multipart) -> `parseData()` -> `validateRequest(ZodSchema)` -> `controller` -> `service`.
- **Response Format:** Uniform `sendResponse(res, { statusCode, success, message, meta?, data })`.
- **Errors:** Throws `AppError(httpStatus.*, message)`.
- **Filtering & Pagination:** `QueryBuilder` with `searchTerm`, `page`, `limit`, `sort`, `fields`, and model-specific filters.

---

### Module 0: Authentication & User (Existing — Preserved Context)

#### 0.1 User Registration
- **Method & Route:** `POST /api/v1/users/create`
- **Access Guard:** Public
- **Request Headers:** `Content-Type: application/json`
- **Zod Validation Schema:**
```typescript
export const userValidationSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
    fullName: z.string().min(1, 'Full name is required'),
    role: z.enum([USER_ROLE.USER]).optional(),
  }),
});
```
- **Response Schema (`201 Created`):**
```typescript
{
  success: true,
  statusCode: 201,
  message: "User created successfully. Please verify your email with the OTP sent.",
  data: {
    userId: string,
    email: string,
    fullName: string,
    role: "user"
  }
}
```

#### 0.2 Verify Registration OTP
- **Method & Route:** `POST /api/v1/users/create-user-verify-otp`
- **Access Guard:** Public
- **Request Headers:** `Content-Type: application/json`
- **Zod Validation Schema:**
```typescript
export const verifyOtpZodSchema = z.object({
  body: z.object({
    email: z.string().email(),
    otp: z.string().length(6, 'OTP must be exactly 6 digits'),
  }),
});
```
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Email verified successfully",
  data: {
    accessToken: string,
    refreshToken: string,
    user: TUser
  }
}
```

#### 0.3 Credentials Login
- **Method & Route:** `POST /api/v1/auth/login`
- **Access Guard:** Public
- **Request Headers:** `Content-Type: application/json`
- **Zod Validation Schema:**
```typescript
export const loginZodValidationSchema = z.object({
  body: z.object({
    email: z.string().email('Email is required!'),
    password: z.string().min(1, 'Password is required!'),
  }),
});
```
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Logged in successfully",
  data: {
    accessToken: string,
    refreshToken: string,
    user: {
      _id: string,
      email: string,
      fullName: string,
      role: string,
      subscriptionTier: string,
      isVerifiedByAdmin: boolean
    }
  }
}
```

#### 0.4 Google OAuth Exchange
- **Method & Route:** `POST /api/v1/auth/create-or-login-google-user`
- **Access Guard:** Public
- **Zod Validation Schema:**
```typescript
export const userValidationForGoogleSchema = z.object({
  body: z.object({
    accessToken: z.string().min(1, 'Access Token is required!'),
  }),
});
```
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Google logged in successfully",
  data: { accessToken: string, refreshToken: string, user: TUser }
}
```

#### 0.5 Apple OAuth Exchange
- **Method & Route:** `POST /api/v1/auth/create-or-login-apple-user`
- **Access Guard:** Public
- **Zod Validation Schema:**
```typescript
export const userValidationForAppleSchema = z.object({
  body: z.object({
    accessToken: z.string().min(1, 'Apple Token is required!'),
    appleId: z.string().optional(),
    fullName: z.string().optional(),
  }),
});
```
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Apple logged in successfully",
  data: { accessToken: string, refreshToken: string, user: TUser }
}
```

#### 0.6 Refresh Token Rotation
- **Method & Route:** `POST /api/v1/auth/refresh-token`
- **Access Guard:** Public (Cookie / Header based)
- **Zod Validation Schema:**
```typescript
export const refreshTokenValidationSchema = z.object({
  cookies: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required!'),
  }).optional(),
});
```
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Access token retrieved successfully",
  data: { accessToken: string }
}
```

#### 0.7 Forgot Password (Request OTP via Email)
- **Method & Route:** `POST /api/v1/auth/forgot-password-otpByEmail`
- **Access Guard:** Public
- **Zod Validation Schema:**
```typescript
export const forgetPasswordValidationSchemaByEmail = z.object({
  body: z.object({
    email: z.string().email('Email is required!'),
  }),
});
```
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "An OTP sent to your email!",
  data: { token: string }
}
```

#### 0.8 Forgot Password (Verify OTP)
- **Method & Route:** `PATCH /api/v1/auth/forgot-password-otp-match`
- **Access Guard:** Public (requires verification token in header `token`)
- **Zod Validation Schema:**
```typescript
export const otpMatchValidationSchema = z.object({
  body: z.object({
    otp: z.string().length(6, 'Otp is required and must be 6 digits!'),
  }),
});
```
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Otp match successfully",
  data: { verifiedToken: string }
}
```

#### 0.9 Reset Password
- **Method & Route:** `PATCH /api/v1/auth/forgot-password-reset`
- **Access Guard:** Public (requires `verifiedToken` in header `token`)
- **Zod Validation Schema:**
```typescript
export const resetPasswordValidationSchema = z.object({
  body: z.object({
    newPassword: z.string().min(6, 'New Password is required!'),
    confirmPassword: z.string().min(6, 'Confirm Password is required!'),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  }),
});
```
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Password reset successfully",
  data: null
}
```

#### 0.10 Change Password
- **Method & Route:** `PATCH /api/v1/auth/change-password`
- **Access Guard:** `auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN)`
- **Zod Validation Schema:**
```typescript
export const changePasswordValidationSchema = z.object({
  body: z.object({
    oldPassword: z.string().min(1, 'Old password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  }),
});
```
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Password changed successfully",
  data: null
}
```

#### 0.11 Get My Profile
- **Method & Route:** `GET /api/v1/users/my-profile`
- **Access Guard:** `auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN)`
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Profile retrieved successfully",
  data: TUser
}
```

#### 0.12 Complete Profile
- **Method & Route:** `POST /api/v1/users/complete-my-profile`
- **Access Guard:** `auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN)`
- **Multipart Upload:** `upload.single('image')`
- **Zod Validation Schema:**
```typescript
export const completeProfileSchema = z.object({
  body: z.object({
    about: z.string().min(1, 'About is required'),
    neighborhoodLabel: z.string().optional(),
    agreedToRules: z.boolean().refine(val => val === true, "Must agree to community rules"),
  }),
});
```
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Profile completed successfully",
  data: TUser
}
```

#### 0.13 Update Profile
- **Method & Route:** `PATCH /api/v1/users/update-my-profile`
- **Access Guard:** `auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN)`
- **Multipart Upload:** `upload.single('image')`
- **Zod Validation Schema:**
```typescript
export const updateProfileSchema = z.object({
  body: z.object({
    fullName: z.string().min(1).optional(),
    about: z.string().optional(),
    phone: z.object({
      code: z.string().min(1).optional(),
      number: z.string().min(6).optional(),
    }).optional(),
    address: AddressValidationSchema.optional(),
    dob: z.string().optional(),
    gender: z.enum(['male', 'female', 'other', 'N/A']).optional(),
    neighborhoodLabel: z.string().optional(),
    socialLinks: z.object({
      instagram: z.string().optional(),
      twitter: z.string().optional(),
      tiktok: z.string().optional(),
    }).optional(),
  }),
});
```
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Profile updated successfully",
  data: TUser
}
```

---

### Module 1: Subscriptions & Billing (Brand New)

#### 1.1 List All Active Subscription Plans
- **Method & Route:** `GET /api/v1/subscriptions/plans`
- **Access Guard:** Public
- **Caching:** Cache-Aside in Redis under key `subscriptions:plans` with TTL 3600 seconds.
- **Query Parameters:** None
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Subscription plans retrieved successfully",
  data: [
    {
      _id: string,
      tier: "free" | "premium" | "pro",
      name: string,
      description: string,
      billingCycle: "monthly" | "yearly",
      priceInCents: number,
      currency: "usd",
      stripePriceId: string,
      features: {
        maxGiftPostsPerMonth: number,
        maxLiveStreamsPerMonth: number,
        maxStreamDurationMinutes: number,
        maxStoryClaimsPerDay: number,
        priorityInDiscoverFeed: boolean,
        verifiedBadge: boolean,
        analyticsAccess: boolean,
        adFreeExperience: boolean
      },
      trialDays: number
    }
  ]
}
```

#### 1.2 Create Checkout Session (Stripe)
- **Method & Route:** `POST /api/v1/subscriptions/checkout-session`
- **Access Guard:** `auth(USER_ROLE.USER)`
- **Zod Validation Schema:**
```typescript
export const createCheckoutSessionZodSchema = z.object({
  body: z.object({
    planId: z.string().refine(val => Types.ObjectId.isValid(val), "Invalid plan ID"),
    successUrl: z.string().url("Valid success URL required"),
    cancelUrl: z.string().url("Valid cancel URL required"),
  }),
});
```
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Checkout session created successfully",
  data: {
    sessionId: string,
    sessionUrl: string
  }
}
```

#### 1.3 Stripe Webhook Ingestion Engine
- **Method & Route:** `POST /api/v1/subscriptions/webhook`
- **Access Guard:** Stripe Webhook Signature Verification (`stripe.webhooks.constructEvent`)
- **Headers:** `stripe-signature: <sig>`
- **Raw Payload:** Raw Buffer (parsed using `express.raw({ type: 'application/json' })`)
- **Events Handled:**
  - `checkout.session.completed` -> Provision `UserSubscription` as `active`, update `User.subscriptionTier` and `User.activeSubscription`, invalidate user Redis cache.
  - `invoice.paid` -> Update `UserSubscription.currentPeriodStart` and `currentPeriodEnd`, record `PaymentTransaction`.
  - `invoice.payment_failed` -> Transition `UserSubscription.status` to `past_due`, send push notification.
  - `customer.subscription.deleted` -> Transition `UserSubscription.status` to `canceled`, revert `User.subscriptionTier` to `free`.
- **Response Schema (`200 OK`):**
```typescript
{ received: true }
```

#### 1.4 Get My Active Subscription Status
- **Method & Route:** `GET /api/v1/subscriptions/my-status`
- **Access Guard:** `auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN)`
- **Caching:** Cache-Aside key `user:{userId}:subscription` with TTL 300 seconds.
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "User subscription retrieved successfully",
  data: {
    hasActiveSubscription: boolean,
    tier: "free" | "premium" | "pro",
    status: "active" | "canceled" | "past_due" | "trialing" | "expired",
    plan: TSubscriptionPlan | null,
    currentPeriodEnd: string | null,
    cancelAtPeriodEnd: boolean,
    usage: {
      giftPostsThisMonth: number,
      liveStreamsThisMonth: number,
      storyClaimsToday: number
    }
  }
}
```

#### 1.5 Cancel Subscription
- **Method & Route:** `POST /api/v1/subscriptions/cancel`
- **Access Guard:** `auth(USER_ROLE.USER)`
- **Zod Validation Schema:**
```typescript
export const cancelSubscriptionZodSchema = z.object({
  body: z.object({
    reason: z.string().max(500).optional(),
    cancelImmediately: z.boolean().default(false),
  }),
});
```
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Subscription cancellation requested successfully",
  data: {
    status: "canceled",
    effectiveDate: string
  }
}
```

#### 1.6 Admin Plan Management (Create Plan)
- **Method & Route:** `POST /api/v1/subscriptions/admin/plans`
- **Access Guard:** `auth(USER_ROLE.SUPER_ADMIN)`
- **Zod Validation Schema:**
```typescript
export const createPlanZodSchema = z.object({
  body: z.object({
    tier: z.enum(['free', 'premium', 'pro']),
    name: z.string().min(1).max(50),
    description: z.string().min(1).max(200),
    billingCycle: z.enum(['monthly', 'yearly']),
    priceInCents: z.number().int().min(0),
    currency: z.string().default('usd'),
    stripePriceId: z.string().min(1),
    stripeProductId: z.string().min(1),
    features: z.object({
      maxGiftPostsPerMonth: z.number().int(),
      maxLiveStreamsPerMonth: z.number().int(),
      maxStreamDurationMinutes: z.number().int(),
      maxStoryClaimsPerDay: z.number().int(),
      priorityInDiscoverFeed: z.boolean(),
      verifiedBadge: z.boolean(),
      analyticsAccess: z.boolean(),
      adFreeExperience: z.boolean(),
    }),
    trialDays: z.number().int().min(0).default(0),
    sortOrder: z.number().int().default(0),
  }),
});
```
- **Invalidation:** Evicts `subscriptions:plans`.
- **Response Schema (`201 Created`):**
```typescript
{
  success: true,
  statusCode: 201,
  message: "Subscription plan created successfully",
  data: TSubscriptionPlan
}
```

#### 1.7 Admin Plan Management (Update Plan)
- **Method & Route:** `PATCH /api/v1/subscriptions/admin/plans/:id`
- **Access Guard:** `auth(USER_ROLE.SUPER_ADMIN)`
- **Zod Validation Schema:**
```typescript
export const updatePlanZodSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(50).optional(),
    description: z.string().min(1).max(200).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    features: z.object({
      maxGiftPostsPerMonth: z.number().int().optional(),
      maxLiveStreamsPerMonth: z.number().int().optional(),
      maxStreamDurationMinutes: z.number().int().optional(),
      maxStoryClaimsPerDay: z.number().int().optional(),
      priorityInDiscoverFeed: z.boolean().optional(),
      verifiedBadge: z.boolean().optional(),
      analyticsAccess: z.boolean().optional(),
      adFreeExperience: z.boolean().optional(),
    }).optional(),
  }),
});
```
- **Invalidation:** Evicts `subscriptions:plans`.
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Subscription plan updated successfully",
  data: TSubscriptionPlan
}
```

---

### Module 2: Gift Items Inventory (Brand New)

#### 2.1 Create Gift Item (5-Step Mobile Creation Wizard)
- **Method & Route:** `POST /api/v1/gift-items`
- **Access Guard:** `auth(USER_ROLE.USER)`
- **Multipart Upload:** `upload.array('images', 5)`
- **Parsing Middleware:** `parseData()`
- **Zod Validation Schema:**
```typescript
export const createGiftItemZodSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(120),
    description: z.string().min(10).max(2000),
    condition: z.enum(['new', 'like_new', 'good', 'fair', 'worn']),
    category: z.enum([
      'electronics', 'furniture', 'clothing', 'toys', 'books',
      'kitchen', 'sports', 'home_decor', 'tools', 'other'
    ]),
    estimatedValue: z.number().min(0).optional(),
    tags: z.array(z.string()).max(10).default([]),
    coverImageIndex: z.number().int().min(0).max(4).default(0),
    pickupAddress: z.object({
      address: z.string().min(1),
      location: z.object({
        type: z.literal('Point').default('Point'),
        coordinates: z.tuple([
          z.number().min(-180).max(180),
          z.number().min(-90).max(90)
        ]),
      }),
    }),
    pickupInstructions: z.string().max(500).optional(),
    pickupRadius: z.number().min(1).max(100).default(25),
    availableFrom: z.string().datetime(),
    availableUntil: z.string().datetime().optional(),
    pickupWindowStart: z.string().optional(),
    pickupWindowEnd: z.string().optional(),
    specialInstructions: z.string().max(1000).optional(),
    isPublished: z.boolean().default(true),
  }),
});
```
- **Side Effects & Invalidation:**
  - Evaluates user's monthly gift quota against active subscription tier (`maxGiftPostsPerMonth`).
  - Sets `host = req.user.userId`.
  - Evicts `gifts:featured` and pattern `gifts:public:page:*`.
  - Emits notification if approved or published.
- **Response Schema (`201 Created`):**
```typescript
{
  success: true,
  statusCode: 201,
  message: "Gift item created successfully and is now live",
  data: TGiftItem
}
```

#### 2.2 Get Public Available Gifts (Discover Feed)
- **Method & Route:** `GET /api/v1/gift-items/public`
- **Access Guard:** Public
- **Query Parameters:**
  - `page`: number (default 1)
  - `limit`: number (default 10)
  - `searchTerm`: string (matches title, description, tags)
  - `category`: string
  - `condition`: string
  - `longitude`: number (for geo-near query)
  - `latitude`: number (for geo-near query)
  - `maxDistanceMeters`: number (default 40000 = ~25 miles)
- **Caching:** Cache-Aside for default parameters in `gifts:public:page:{page}` (TTL 300s). Geo-spatial queries are dynamic.
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Available gifts retrieved successfully",
  meta: {
    page: number,
    limit: number,
    total: number,
    totalPage: number
  },
  data: [TGiftItem]
}
```

#### 2.3 Get My Posted Gift Items
- **Method & Route:** `GET /api/v1/gift-items/my-items`
- **Access Guard:** `auth(USER_ROLE.USER)`
- **Query Parameters:** `page`, `limit`, `claimState` (`available` | `claimed` | `pickup_arranged` | `delivered`)
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "My gift items retrieved successfully",
  meta: { page: number, limit: number, total: number, totalPage: number },
  data: [TGiftItem]
}
```

#### 2.4 Get Single Gift Item Details
- **Method & Route:** `GET /api/v1/gift-items/:id`
- **Access Guard:** Public
- **Caching:** Key `gift:{id}` with TTL 300s. Increments `viewCount` asynchronously.
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Gift details retrieved successfully",
  data: TGiftItem & { host: Pick<TUser, '_id' | 'fullName' | 'profileImage' | 'communityTrustScore' | 'neighborhoodLabel'> }
}
```

#### 2.5 Update Gift Item
- **Method & Route:** `PATCH /api/v1/gift-items/:id`
- **Access Guard:** `auth(USER_ROLE.USER, USER_ROLE.ADMIN)`
- **Multipart Upload:** Optional `upload.array('images', 5)`
- **Parsing Middleware:** `parseData()`
- **Zod Validation Schema:** `createGiftItemZodSchema.shape.body.partial()`
- **Invalidation:** Evicts `gift:{id}`, `gifts:featured`, pattern `gifts:public:page:*`.
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Gift item updated successfully",
  data: TGiftItem
}
```

#### 2.6 Delete Gift Item (Soft Delete)
- **Method & Route:** `DELETE /api/v1/gift-items/:id`
- **Access Guard:** `auth(USER_ROLE.USER, USER_ROLE.ADMIN)`
- **Business Rule:** Prohibited if item is in `claimed` or `pickup_arranged` status without admin intervention.
- **Invalidation:** Evicts `gift:{id}`, pattern `gifts:public:page:*`.
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Gift item removed successfully",
  data: null
}
```

---

### Module 3: Live Streaming Engine (Brand New)

#### 3.1 Pre-Live Studio Initialization
- **Method & Route:** `POST /api/v1/live-streams/pre-live-init`
- **Access Guard:** `auth(USER_ROLE.USER)`
- **Zod Validation Schema:**
```typescript
export const preLiveInitZodSchema = z.object({
  body: z.object({
    giftItemId: z.string().refine(val => Types.ObjectId.isValid(val), "Valid GiftItem ID required"),
    channelName: z.string().min(3).max(100),
    timerDurationSeconds: z.number().int().min(60).max(10800).default(900),
  }),
});
```
- **Business Logic:**
  - Verifies gift exists, belongs to caller, has `claimState: 'available'`, and is not bound to another active stream.
  - Verifies host's subscription streaming limit (`maxLiveStreamsPerMonth` and `maxStreamDurationMinutes`).
  - Generates secure `roomId` (UUID format: `live_stream_<timestamp>_<random>`).
  - Generates Host ZEGOCLOUD RTC token + ZIM messaging token with publisher privileges.
  - Creates `LiveStream` document with status `scheduled`.
  - Caches room state in Redis with key `stream:{streamId}:state`.
- **Response Schema (`201 Created`):**
```typescript
{
  success: true,
  statusCode: 201,
  message: "Live studio session initialized successfully",
  data: {
    streamId: string,
    roomId: string,
    channelName: string,
    rtcToken: string,
    zimToken: string,
    appId: number,
    timerDurationSeconds: number,
    giftItem: TGiftItem
  }
}
```

#### 3.2 Start Broadcast (Transition to Live)
- **Method & Route:** `POST /api/v1/live-streams/:id/start`
- **Access Guard:** `auth(USER_ROLE.USER)`
- **Zod Validation Schema:** `z.object({ params: z.object({ id: z.string() }) })`
- **Business Logic:**
  - Updates `LiveStream.status = 'live'` and `startedAt = new Date()`.
  - Associates gift item: `GiftItem.associatedStream = stream._id`.
  - Initializes Redis room metrics: `HSET stream:{id}:state status live startedAt <timestamp> timerDuration <seconds>`.
  - Invalidate `streams:active` and broadcast `stream_started` to global discovery channel.
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Broadcast is officially live!",
  data: {
    streamId: string,
    status: "live",
    startedAt: string
  }
}
```

#### 3.3 Join Live Stream (Viewer Token Generation)
- **Method & Route:** `POST /api/v1/live-streams/:id/join`
- **Access Guard:** `auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN, USER_ROLE.OPTIONAL)`
- **Business Logic:**
  - Validates stream exists and is currently in `status: 'live'`.
  - Generates viewer/subscriber RTC token + ZIM token (playback only, no publish rights).
  - Employs Redis `SADD stream:{id}:viewers {userId}` and increments counter.
  - Updates `peakViewers` in Redis if current count exceeds previous peak.
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Joined live stream session",
  data: {
    streamId: string,
    roomId: string,
    rtcToken: string,
    zimToken: string,
    appId: number,
    currentViewerCount: number,
    giftItem: TGiftItem,
    pinnedClaim: TLiveStoryClaim | null,
    startedAt: string,
    timerDurationSeconds: number
  }
}
```

#### 3.4 Get Active Streams List ("Others Live" / "More Live Today")
- **Method & Route:** `GET /api/v1/live-streams/active`
- **Access Guard:** Public
- **Caching:** Cache-Aside key `streams:active` with TTL 30 seconds.
- **Query Parameters:** `page`, `limit`
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Active live streams retrieved successfully",
  data: [
    {
      _id: string,
      roomId: string,
      channelName: string,
      host: {
        _id: string,
        fullName: string,
        profileImage: string,
        neighborhoodLabel: string
      },
      giftItem: {
        _id: string,
        title: string,
        images: string[],
        category: string
      },
      currentViewerCount: number,
      startedAt: string,
      timerDurationSeconds: number
    }
  ]
}
```

#### 3.5 End Broadcast (Host Triggered)
- **Method & Route:** `POST /api/v1/live-streams/:id/end`
- **Access Guard:** `auth(USER_ROLE.USER)`
- **Zod Validation Schema:**
```typescript
export const endStreamZodSchema = z.object({
  params: z.object({ id: z.string() }),
});
```
- **Business Logic:**
  - Verifies caller is the host of this stream.
  - Calculates `actualDurationSeconds = (now - startedAt) / 1000`.
  - Reads `peakViewers` from Redis and total claims from MongoDB.
  - Updates `LiveStream.status = 'ended'`, `endedAt = new Date()`.
  - Computes `wrapUpSummary`:
    ```typescript
    wrapUpSummary = {
      airTimeFormatted: `${Math.floor(actualDurationSeconds / 60)}m ${actualDurationSeconds % 60}s`,
      totalLiveClaims: totalClaims,
      peakViewerCount: peakViewers,
      totalReachCount: totalUniqueViewers,
      winnerName: winner ? winner.fullName : "None Selected",
      giftTitle: giftItem.title
    }
    ```
  - Flushes Redis ephemeral keys: `stream:{id}:state`, `stream:{id}:viewers`.
  - Emits `stream_ended` event to Socket.IO room.
  - Evicts `streams:active`, `admin:streams:active`.
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Broadcast ended successfully",
  data: {
    streamId: string,
    status: "ended",
    wrapUpSummary: {
      airTimeFormatted: string,
      totalLiveClaims: number,
      peakViewerCount: number,
      totalReachCount: number,
      winnerName: string,
      giftTitle: string
    }
  }
}
```

#### 3.6 Get Stream Wrap-Up Summary ("Broadcast Finished!")
- **Method & Route:** `GET /api/v1/live-streams/:id/wrap-up`
- **Access Guard:** `auth(USER_ROLE.USER, USER_ROLE.ADMIN)`
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Stream wrap-up stats retrieved successfully",
  data: {
    streamId: string,
    channelName: string,
    airTimeFormatted: string,
    peakViewerCount: number,
    totalReachCount: number,
    totalLiveClaims: number,
    winner: {
      _id: string,
      fullName: string,
      profileImage: string
    } | null,
    giftItem: {
      _id: string,
      title: string,
      coverImage: string
    }
  }
}
```

---

### Module 4: Story Claims & Winner Selection (Brand New)

#### 4.1 Submit Story Claim ("Request with Story" 2-Step Flow)
- **Method & Route:** `POST /api/v1/story-claims`
- **Access Guard:** `auth(USER_ROLE.USER)`
- **Multipart Upload:** Optional `upload.single('storyMedia')`
- **Parsing Middleware:** `parseData()`
- **Zod Validation Schema:**
```typescript
export const createStoryClaimZodSchema = z.object({
  body: z.object({
    streamId: z.string().refine(val => Types.ObjectId.isValid(val), "Invalid Stream ID"),
    storyStatement: z.string().min(20, 'Story must be at least 20 characters').max(3000),
  }),
});
```
- **Business Logic:**
  - Verifies stream is active (`status: 'live'`).
  - Verifies applicant is NOT the stream host (cannot claim own gift).
  - Enforces uniqueness: One claim per applicant per stream (compound index `{ applicant: 1, stream: 1 }`).
  - Checks daily story claim limit from caller's active subscription tier (`maxStoryClaimsPerDay`).
  - Creates `LiveStoryClaim` with `status: 'pending'`.
  - Increments `LiveStream.totalClaimsReceived` and `GiftItem.storyClaimCount`.
  - Emits real-time event `new_story_claim` to the host's private channel.
  - Invalidate cache `claims:stream:{streamId}`.
- **Response Schema (`201 Created`):**
```typescript
{
  success: true,
  statusCode: 201,
  message: "Your story is in the community's hands.",
  data: TLiveStoryClaim
}
```

#### 4.2 Get Story Claims for Live Stream ("Live Story Claims" Bottom Sheet)
- **Method & Route:** `GET /api/v1/story-claims/stream/:streamId`
- **Access Guard:** `auth(USER_ROLE.USER, USER_ROLE.ADMIN)`
- **Caching:** Key `claims:stream:{streamId}` with TTL 60 seconds.
- **Query Parameters:** `page`, `limit`, `status` (`pending`, `pinned`, `awarded`), `sort` (`-upvotes`, `-createdAt`)
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Story claims retrieved successfully",
  meta: { page: number, limit: number, total: number, totalPage: number },
  data: [
    {
      _id: string,
      applicant: {
        _id: string,
        fullName: string,
        profileImage: string,
        neighborhoodLabel: string,
        communityTrustScore: number
      },
      storyStatement: string,
      storyMediaUrl: string,
      status: "pending" | "pinned" | "awarded" | "rejected",
      upvotes: number,
      downvotes: number,
      isPinned: boolean,
      createdAt: string
    }
  ]
}
```

#### 4.3 Community Vote on Story Claim ("Community Story Voting")
- **Method & Route:** `POST /api/v1/story-claims/:id/vote`
- **Access Guard:** `auth(USER_ROLE.USER)`
- **Zod Validation Schema:**
```typescript
export const voteStoryClaimZodSchema = z.object({
  body: z.object({
    voteType: z.enum(['upvote', 'downvote']),
  }),
});
```
- **Business Logic:**
  - Prevents applicant from voting on their own claim.
  - Checks if user has already voted (`voterIds.includes(userId)`). If already voted, updates vote direction atomically.
  - Increments `upvotes` or `downvotes` using MongoDB `$inc`.
  - Emits `claim_vote_updated` via Socket.IO room.
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Vote recorded successfully",
  data: {
    claimId: string,
    upvotes: number,
    downvotes: number
  }
}
```

#### 4.4 Pin Story Claim to Stream ("PINNED APPLICANT STORY")
- **Method & Route:** `PATCH /api/v1/story-claims/:id/pin`
- **Access Guard:** `auth(USER_ROLE.USER)`
- **Business Logic:**
  - Verifies caller is the host of the stream associated with this claim.
  - Unpins any previously pinned claim for this stream (`isPinned = false`).
  - Sets current claim `isPinned = true`, `status = 'pinned'`, `pinnedAt = new Date()`.
  - Updates `LiveStream.pinnedClaim = claim._id`.
  - Updates Redis room state: `HSET stream:{streamId}:state pinnedClaimId {claimId}`.
  - Broadcasts Socket.IO event `story_claim_pinned` to all viewers in the room.
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Story claim pinned to stream",
  data: TLiveStoryClaim
}
```

#### 4.5 Unpin Story Claim from Stream
- **Method & Route:** `PATCH /api/v1/story-claims/:id/unpin`
- **Access Guard:** `auth(USER_ROLE.USER)`
- **Business Logic:**
  - Verifies caller is stream host.
  - Sets claim `isPinned = false`, `status = 'pending'`, `unpinnedAt = new Date()`.
  - Sets `LiveStream.pinnedClaim = null`.
  - Updates Redis state.
  - Broadcasts `story_claim_unpinned` to room.
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Story claim unpinned",
  data: null
}
```

#### 4.6 Execute Live Award / Select Winner ("GIFT AWARDED LIVE!")
- **Method & Route:** `POST /api/v1/story-claims/:id/award`
- **Access Guard:** `auth(USER_ROLE.USER)`
- **Concurrency Protection:** MongoDB ACID Transaction with strict conditional update `{ winner: null, status: 'live' }`.
- **Business Logic:**
  1. Starts MongoDB session & transaction.
  2. Acquires conditional lock on `LiveStream`: confirms stream is `live`, caller is host, and `winner` is null.
  3. Transitions `LiveStream.winner = claim.applicant`, `LiveStream.winningClaim = claim._id`, `LiveStream.awardedAt = now`.
  4. Transitions `LiveStoryClaim.status = 'awarded'`, `awardedAt = now`.
  5. Transitions `GiftItem.claimState = 'claimed'`, `claimedBy = claim.applicant`, `claimedAt = now`.
  6. Rejects all other claims for this stream: `updateMany({ stream: streamId, status: 'pending' }, { status: 'rejected' })`.
  7. Inserts `AdminAuditLog` record (`action: 'GIFT_AWARDED_LIVE'`).
  8. Increments `User.totalGiftsGiven` for host and `User.totalGiftsReceived` for winner.
  9. Commits transaction.
  10. Broadcasts `gift_awarded` event to all viewers with confetti celebration payload.
  11. Dispatches FCM push notification to winner with pickup details.
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Gift officially awarded to winner!",
  data: {
    streamId: string,
    winner: {
      _id: string,
      fullName: string,
      profileImage: string
    },
    giftItem: {
      _id: string,
      title: string,
      claimState: "claimed"
    },
    claim: TLiveStoryClaim
  }
}
```

#### 4.7 Get Winner Pickup Instructions (Post-Award)
- **Method & Route:** `GET /api/v1/story-claims/:id/pickup-info`
- **Access Guard:** `auth(USER_ROLE.USER)`
- **Business Logic:** Caller must be either the awarded winner, the host, or an admin. Returns full street address and host pickup instructions.
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Pickup instructions retrieved",
  data: {
    giftTitle: string,
    pickupAddress: string,
    pickupWindowStart: string,
    pickupWindowEnd: string,
    pickupInstructions: string,
    hostPhone: string,
    pickupConfirmed: boolean
  }
}
```

---

### Module 5: Real-Time Chat & Documents (Brand New)

#### 5.1 Send Live Stream Comment
- **Method & Route:** `POST /api/v1/live-comments`
- **Access Guard:** `auth(USER_ROLE.USER)`
- **Zod Validation Schema:**
```typescript
export const createLiveCommentZodSchema = z.object({
  body: z.object({
    streamId: z.string().refine(val => Types.ObjectId.isValid(val), "Invalid Stream ID"),
    message: z.string().min(1).max(500),
    commentType: z.enum(['text', 'emoji_reaction']).default('text'),
  }),
});
```
- **Business Logic:**
  - Verifies user is not blocked or suspended.
  - Persists comment in `LiveComment`.
  - Broadcasts comment via Socket.IO room `stream:{streamId}` under event `new_comment`.
- **Response Schema (`201 Created`):**
```typescript
{
  success: true,
  statusCode: 201,
  message: "Comment sent",
  data: TLiveComment
}
```

#### 5.2 Upload Chat Documents (Multer Fields Implementation)
- **Method & Route:** `POST /api/v1/messages/upload-chat-document`
- **Access Guard:** `auth(USER_ROLE.USER)`
- **Multipart Upload Middleware:**
```typescript
fileUpload('./public/uploads/chat-documents').fields([
  { name: 'uploadChatDocument', maxCount: 5 }
])
```
- **Parsing Middleware:** `parseData()`
- **Zod Validation Schema:**
```typescript
export const uploadChatDocZodSchema = z.object({
  body: z.object({
    chatId: z.string().refine(val => Types.ObjectId.isValid(val), "Invalid Chat ID"),
    content: z.string().optional().default(''),
  }),
});
```
- **Business Logic:**
  - Extracts files from `req.files['uploadChatDocument']`.
  - Validates mimeTypes: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`. Max file size 10MB per document.
  - Constructs `attachments: [{ url, fileType, name, size }]`.
  - Inserts `Message` document and updates `Chat.lastMessage`.
  - Emits `receive_message` to Socket.IO chat room `chat:{chatId}`.
- **Response Schema (`201 Created`):**
```typescript
{
  success: true,
  statusCode: 201,
  message: "Documents uploaded and sent successfully",
  data: IMessage
}
```

#### 5.3 Pin Live Comment (Host / Admin)
- **Method & Route:** `PATCH /api/v1/live-comments/:id/pin`
- **Access Guard:** `auth(USER_ROLE.USER, USER_ROLE.ADMIN)`
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Comment pinned successfully",
  data: TLiveComment
}
```

#### 5.4 Report User / Content ("Report user from chat")
- **Method & Route:** `POST /api/v1/moderation/report`
- **Access Guard:** `auth(USER_ROLE.USER)`
- **Zod Validation Schema:**
```typescript
export const reportContentZodSchema = z.object({
  body: z.object({
    targetType: z.enum(['live_comment', 'story_claim', 'gift_item', 'user', 'live_stream']),
    targetId: z.string().refine(val => Types.ObjectId.isValid(val), "Invalid target ID"),
    reasonCode: z.enum([
      'inappropriate_content', 'spam', 'harassment', 'hate_speech',
      'scam_fraud', 'misleading_info', 'violence', 'other'
    ]),
    reasonText: z.string().max(1000).optional(),
  }),
});
```
- **Business Logic:**
  - Prevents duplicate reporting by the same user for the same target (`unique` index).
  - Creates `ModerationFlag` record.
  - Automatically flags target if report count exceeds threshold (3 flags -> auto-review status).
- **Response Schema (`201 Created`):**
```typescript
{
  success: true,
  statusCode: 201,
  message: "Report submitted. Our moderation team will review this shortly.",
  data: TModerationFlag
}
```

---

### Module 6: Admin Dashboard & Moderation (Brand New)

#### 6.1 Telemetry Overview Stats (Admin KPI Dashboard)
- **Method & Route:** `GET /api/v1/admin/dashboard/telemetry`
- **Access Guard:** `auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN)`
- **Caching:** Key `admin:dashboard:summary` with TTL 300 seconds.
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Telemetry overview retrieved successfully",
  data: {
    totalUsers: number,
    newUsersToday: number,
    activeLiveStreams: number,
    totalGiftsGiven: number,
    totalClaimsSubmitted: number,
    revenueThisMonthInCents: number,
    openModerationFlags: number,
    recentActivity: [
      {
        action: string,
        performedBy: string,
        timestamp: string
      }
    ]
  }
}
```

#### 6.2 Live Stream Active Control Room
- **Method & Route:** `GET /api/v1/admin/live-streams/active`
- **Access Guard:** `auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN)`
- **Caching:** Key `admin:streams:active` with TTL 30s.
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Active streams retrieved for control room",
  data: [
    {
      _id: string,
      roomId: string,
      channelName: string,
      host: TUser,
      giftItem: TGiftItem,
      currentViewerCount: number,
      startedAt: string,
      flagCount: number,
      adminToken: string
    }
  ]
}
```

#### 6.3 Force Terminate Stream ("Remote Stream Force-End")
- **Method & Route:** `PATCH /api/v1/admin/live-streams/:id/force-terminate`
- **Access Guard:** `auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN)`
- **Zod Validation Schema:**
```typescript
export const forceTerminateStreamZodSchema = z.object({
  body: z.object({
    reason: z.string().min(5, 'Termination reason is required').max(500),
  }),
});
```
- **Business Logic:**
  - Transitions `LiveStream.status = 'terminated_by_admin'`, sets `terminatedBy = req.user.userId`.
  - Reverts associated `GiftItem.claimState = 'available'`.
  - Creates `AdminAuditLog` (`action: 'STREAM_TERMINATED_BY_ADMIN'`).
  - Broadcasts `admin_force_end_stream` via Socket.IO room (client immediately ejects viewers and host).
  - Flushes Redis stream keys.
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Stream successfully terminated by admin moderation",
  data: null
}
```

#### 6.4 Mute Host Mic Remotely
- **Method & Route:** `PATCH /api/v1/admin/live-streams/:id/mute-host`
- **Access Guard:** `auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN)`
- **Zod Validation Schema:**
```typescript
export const muteHostZodSchema = z.object({
  body: z.object({
    reason: z.string().min(3).max(300),
  }),
});
```
- **Business Logic:**
  - Broadcasts Socket.IO event `admin_user_muted` targeting host's socket.
  - Logs action in `AdminAuditLog`.
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Host microphone mute command dispatched",
  data: null
}
```

#### 6.5 User Suspension / Permanent Ban ("User Monitoring" Table Action)
- **Method & Route:** `PATCH /api/v1/admin/users/:id/moderation-action`
- **Access Guard:** `auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN)`
- **Zod Validation Schema:**
```typescript
export const userModerationActionZodSchema = z.object({
  body: z.object({
    action: z.enum(['warn', 'suspend', 'ban', 'unban', 'lift_suspension']),
    reason: z.string().min(5).max(500),
    suspensionDurationDays: z.number().int().min(1).max(365).optional(),
  }),
});
```
- **Business Logic:**
  - `ban`: Sets `isBlocked = true`, invalidates all active JWT tokens by clearing `fcmToken` and disconnecting active sockets.
  - `suspend`: Sets `isSuspended = true` and `suspendedUntil = now + duration`.
  - Logs to `AdminAuditLog`.
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Moderation action executed successfully",
  data: null
}
```

#### 6.6 Moderate Reported Stories & Claims ("Stories & Claims Audit")
- **Method & Route:** `PATCH /api/v1/admin/story-claims/:id/review`
- **Access Guard:** `auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN)`
- **Zod Validation Schema:**
```typescript
export const reviewStoryClaimZodSchema = z.object({
  body: z.object({
    action: z.enum(['approve', 'flag', 'remove']),
    notes: z.string().max(500).optional(),
  }),
});
```
- **Business Logic:**
  - If `remove`: Soft-deletes `LiveStoryClaim`, unpins if pinned, emits `claim_removed` to stream room.
  - Updates `adminReviewStatus`, `adminReviewedBy`, `adminReviewedAt`.
  - Logs to `AdminAuditLog`.
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Story claim review action recorded",
  data: TLiveStoryClaim
}
```

#### 6.7 Admin Audit Log Listing
- **Method & Route:** `GET /api/v1/admin/audit-logs`
- **Access Guard:** `auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN)`
- **Query Parameters:** `page`, `limit`, `action`, `performedBy`, `sort`
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Audit logs retrieved successfully",
  meta: { page: number, limit: number, total: number, totalPage: number },
  data: [TAdminAuditLog]
}
```

#### 6.8 Subscription Revenue Analytics ("Revenue" Admin Screen)
- **Method & Route:** `GET /api/v1/admin/revenue/analytics`
- **Access Guard:** `auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN)`
- **Caching:** Key `admin:revenue:summary` with TTL 900 seconds.
- **Query Parameters:** `startDate`, `endDate`, `interval` (`day` | `month`)
- **Response Schema (`200 OK`):**
```typescript
{
  success: true,
  statusCode: 200,
  message: "Revenue analytics retrieved successfully",
  data: {
    totalRevenueInCents: number,
    recurringMonthlyInCents: number,
    activeSubscribersByTier: {
      free: number,
      premium: number,
      pro: number
    },
    churnRatePercentage: number,
    timeSeries: [
      {
        date: string,
        amountInCents: number,
        transactionCount: number
      }
    ]
  }
}
```

---

## 5. Real-Time Socket.IO & Signaling Event Contract

All Socket connections authenticate on connection via JWT token passed in `auth.token`.  
Room namespace naming conventions:
- Live Stream Room: `stream:{streamId}`
- User Private Room: `user:{userId}`
- Direct Chat Room: `chat:{chatId}`

```typescript
// Socket Context Definition
export interface AuthenticatedSocket extends Socket {
  user: {
    userId: string;
    role: string;
    email: string;
  };
}
```

### Event Contract Matrix

| Event Name | Direction | Room / Recipient | Payload Schema | Description |
|---|---|---|---|---|
| `join_stream` | Client → Server | `stream:{streamId}` | `{ streamId: string }` | Viewer or host joins live stream room. Server updates Redis viewer set. |
| `leave_stream` | Client → Server | `stream:{streamId}` | `{ streamId: string }` | Viewer leaves live stream room. Server removes user from Redis viewer set. |
| `stream_ended` | Server → Client | `stream:{streamId}` | `{ streamId: string, reason: 'host_ended' \| 'admin_terminated', wrapUpSummary: object }` | Broadcast to all room members when stream concludes or is terminated. |
| `viewer_count_update` | Server → Client | `stream:{streamId}` | `{ streamId: string, viewerCount: number }` | Emitted every 5 seconds (debounced) when Redis viewer count changes. |
| `timer_tick` | Server → Client | `stream:{streamId}` | `{ streamId: string, remainingSeconds: number, elapsedSeconds: number }` | Emitted every second from server-authoritative timer. |
| `pin_story_claim` | Client → Server | Host only | `{ claimId: string, streamId: string }` | Host requests to pin an applicant's claim card. |
| `story_claim_pinned` | Server → Client | `stream:{streamId}` | `{ streamId: string, claim: TLiveStoryClaim }` | Broadcast to all viewers: renders pinned story overlay card. |
| `unpin_story_claim` | Client → Server | Host only | `{ claimId: string, streamId: string }` | Host removes pinned claim. |
| `story_claim_unpinned` | Server → Client | `stream:{streamId}` | `{ streamId: string, claimId: string }` | Broadcast to all viewers: dismisses pinned story overlay card. |
| `new_story_claim` | Server → Client | Host private (`user:{hostId}`) | `{ streamId: string, claim: TLiveStoryClaim }` | Real-time notification to host that a new story has arrived. |
| `claim_vote_updated` | Server → Client | `stream:{streamId}` | `{ claimId: string, upvotes: number, downvotes: number }` | Real-time community voting update. |
| `award_gift` | Client → Server | Host only | `{ claimId: string, streamId: string }` | Host selects winner. Server initiates ACID transaction. |
| `gift_awarded` | Server → Client | `stream:{streamId}` | `{ streamId: string, winner: { _id: string, fullName: string, profileImage: string }, giftItem: { _id: string, title: string }, claimId: string }` | Triggered upon successful transaction: launches celebratory animation across all clients. |
| `send_live_comment` | Client → Server | Any member | `{ streamId: string, message: string, commentType: 'text' \| 'emoji_reaction' }` | Client sends live chat comment. |
| `new_live_comment` | Server → Client | `stream:{streamId}` | `{ comment: TLiveComment }` | Broadcast comment to stream room. |
| `admin_force_end_stream` | Server → Client | `stream:{streamId}` | `{ streamId: string, reason: string, terminatedBy: 'admin' }` | Remote admin killswitch: forcefully closes stream on all devices. |
| `admin_user_muted` | Server → Client | `user:{targetUserId}` | `{ streamId: string, isMuted: true, reason: string }` | Remote admin mute: forces SDK to disable host microphone. |
| `admin_warning_issued` | Server → Client | `user:{targetUserId}` | `{ warningMessage: string, issuedAt: string }` | Moderation warning banner displayed to host or user. |

---

## 6. Step-by-Step Granular Implementation Phases

```
┌────────────────────────────────────────────────────────────────────────┐
│                      IMPLEMENTATION ROADMAP                            │
├──────────────┬─────────────────────────────────────────────────────────┤
│  PHASE 1     │  Foundation, Subscriptions & Stripe Billing Engine      │
├──────────────┼─────────────────────────────────────────────────────────┤
│  PHASE 2     │  Gift Items Inventory & 5-Step Creation Pipeline        │
├──────────────┼─────────────────────────────────────────────────────────┤
│  PHASE 3     │  Live Streaming Engine & ZEGOCLOUD RTC/RTM Signaling   │
├──────────────┼─────────────────────────────────────────────────────────┤
│  PHASE 4     │  Story Claims, Real-Time Community Voting & Live Award  │
├──────────────┼─────────────────────────────────────────────────────────┤
│  PHASE 5     │  Real-Time Chat Documents & Moderation Flagging Engine  │
├──────────────┼─────────────────────────────────────────────────────────┤
│  PHASE 6     │  Admin Control Room, Telemetry Analytics & Audit Logs   │
└──────────────┴─────────────────────────────────────────────────────────┘
```

---

### Phase 1: Subscriptions, Tiers & Billing Engine

#### 1.1 Goal & Pre-requisites
- **Goal:** Implement master subscription tiers (Free, Premium, Pro), Stripe checkout session generation, webhook processing, subscription status checks, and monthly quota enforcement.
- **Pre-requisites:** Working Auth module (already present), MongoDB connection, Redis service, Stripe secret key and webhook signing secret.

#### 1.2 Files to Create / Update
- `src/app/modules/Subscription/subscription.interface.ts`
- `src/app/modules/Subscription/subscription.model.ts`
- `src/app/modules/Subscription/subscription.validation.ts`
- `src/app/modules/Subscription/subscription.service.ts`
- `src/app/modules/Subscription/subscription.controller.ts`
- `src/app/modules/Subscription/subscription.route.ts`
- `src/app/modules/user/user.interface.ts` (Extend with subscription fields)
- `src/app/modules/user/user.models.ts` (Add subscription fields & indexes)
- `src/app/routes/index.ts` (Register `/subscriptions` route)

#### 1.3 API Endpoints Implemented in This Phase
1. `GET /api/v1/subscriptions/plans` (Public, Cached)
2. `POST /api/v1/subscriptions/checkout-session` (`auth(USER)`)
3. `POST /api/v1/subscriptions/webhook` (Stripe signature guard)
4. `GET /api/v1/subscriptions/my-status` (`auth(USER, ADMIN)`)
5. `POST /api/v1/subscriptions/cancel` (`auth(USER)`)
6. `POST /api/v1/subscriptions/admin/plans` (`auth(SUPER_ADMIN)`)
7. `PATCH /api/v1/subscriptions/admin/plans/:id` (`auth(SUPER_ADMIN)`)

#### 1.4 Redis Caching Logic & Invalidation Triggers
- **Read Cache:** `subscriptions:plans` (TTL 3600s), `user:{userId}:subscription` (TTL 300s).
- **Eviction Triggers:**
  - Plan creation/update -> `RedisService.del('subscriptions:plans')`.
  - Webhook `invoice.paid` / `subscription.deleted` -> `RedisService.del('user:{userId}:subscription')`.

#### 1.5 Admin vs User Impact
- **User:** Can view plans, checkout via Stripe, view active limits and renew/cancel.
- **Admin:** Can create new subscription plans, edit pricing/features, and view active subscriber stats.

#### 1.6 Post-Phase Testing Checklist
- [ ] Seed Free, Premium, and Pro plans in database. Verify `GET /plans` returns cached data.
- [ ] Test Stripe checkout session creation with mock Stripe account.
- [ ] Test Stripe CLI webhook forwarding (`stripe listen --forward-to localhost:5000/api/v1/subscriptions/webhook`).
- [ ] Verify `checkout.session.completed` transitions user tier from `free` to `premium`.
- [ ] Verify cancellation sets `cancelAtPeriodEnd: true`.

---

### Phase 2: Gift Items Inventory & 5-Step Mobile Creation Wizard

#### 2.1 Goal & Pre-requisites
- **Goal:** Implement the full gift item lifecycle (Photos, Details, Location, Timing, Review & Publish) with geo-spatial search, category filtering, and monthly quota enforcement.
- **Pre-requisites:** Phase 1 complete (subscription tier determines maximum allowed gift posts).

#### 2.2 Files to Create / Update
- `src/app/modules/GiftItem/giftItem.interface.ts`
- `src/app/modules/GiftItem/giftItem.model.ts`
- `src/app/modules/GiftItem/giftItem.validation.ts`
- `src/app/modules/GiftItem/giftItem.service.ts`
- `src/app/modules/GiftItem/giftItem.controller.ts`
- `src/app/modules/GiftItem/giftItem.route.ts`
- `src/app/routes/index.ts` (Register `/gift-items` route)

#### 2.3 API Endpoints Implemented in This Phase
1. `POST /api/v1/gift-items` (`auth(USER)`, Multer 5 images)
2. `GET /api/v1/gift-items/public` (Public Discover feed, Geo-spatial, Cached)
3. `GET /api/v1/gift-items/my-items` (`auth(USER)`)
4. `GET /api/v1/gift-items/:id` (Public, Single Item)
5. `PATCH /api/v1/gift-items/:id` (`auth(USER, ADMIN)`)
6. `DELETE /api/v1/gift-items/:id` (`auth(USER, ADMIN)`)

#### 2.4 Redis Caching Logic & Invalidation Triggers
- **Read Cache:** `gifts:public:page:{page}` (TTL 300s), `gift:{id}` (TTL 300s), `gifts:featured` (TTL 600s).
- **Eviction Triggers:**
  - Create gift -> `RedisService.delByPattern('gifts:public:page:*')`, `RedisService.del('gifts:featured')`.
  - Update/Delete gift -> `RedisService.del('gift:{id}')`, `RedisService.delByPattern('gifts:public:page:*')`.

#### 2.5 Admin vs User Impact
- **User:** Can post up to their subscription limit, preview their post, and browse gifts in their neighborhood.
- **Admin:** Can review pending gifts, approve/reject listings, and inspect gift metadata.

#### 2.6 Post-Phase Testing Checklist
- [ ] Post gift with 5 uploaded images using Postman multipart form-data.
- [ ] Attempt 4th gift on a Free tier account (limit = 3) -> Assert `403 Forbidden: Monthly gift post limit reached`.
- [ ] Query `/gift-items/public` with `longitude` and `latitude` coordinates -> Assert geo-spatial 2dsphere filtering returns closest items first.
- [ ] Test soft delete: deleted item must not appear in `/public` or `/my-items`.

---

### Phase 3: Live Streaming Engine & ZEGOCLOUD RTC/RTM Signaling

#### 3.1 Goal & Pre-requisites
- **Goal:** Implement pre-live room initialization, ZEGOCLOUD server-side token generation, stream lifecycle transitions, server-authoritative timer, and Redis-backed active viewer counters.
- **Pre-requisites:** Phase 2 complete (every stream must associate with a verified `GiftItem`). ZEGOCLOUD AppID and ServerSecret in environment variables.

#### 3.2 Files to Create / Update
- `src/app/modules/LiveStream/liveStream.interface.ts`
- `src/app/modules/LiveStream/liveStream.model.ts`
- `src/app/modules/LiveStream/liveStream.validation.ts`
- `src/app/modules/LiveStream/liveStream.service.ts`
- `src/app/modules/LiveStream/liveStream.controller.ts`
- `src/app/modules/LiveStream/liveStream.route.ts`
- `src/app/modules/LiveStream/zego.utils.ts` (HMAC token generator & webhook verifier)
- `src/app/modules/LiveStream/liveStream.socket.ts` (Socket.IO room lifecycle & viewer counters)
- `src/app/routes/index.ts` (Register `/live-streams` route)

#### 3.3 API Endpoints Implemented in This Phase
1. `POST /api/v1/live-streams/pre-live-init` (`auth(USER)`)
2. `POST /api/v1/live-streams/:id/start` (`auth(USER)`)
3. `POST /api/v1/live-streams/:id/join` (`auth(OPTIONAL)`)
4. `GET /api/v1/live-streams/active` (Public, Cached)
5. `POST /api/v1/live-streams/:id/end` (`auth(USER)`)
6. `GET /api/v1/live-streams/:id/wrap-up` (`auth(USER, ADMIN)`)
7. `POST /api/v1/live-streams/webhook/zego` (ZEGOCLOUD callback verification)

#### 3.4 Redis Caching Logic & Invalidation Triggers
- **Read Cache:** `streams:active` (TTL 30s), `stream:{id}:state` (HSET, TTL 3600s), `stream:{id}:viewers` (SET, TTL 3600s).
- **Eviction Triggers:**
  - `start` or `end` -> `RedisService.del('streams:active')`, `RedisService.del('admin:streams:active')`.
  - Stream completion -> clean up `stream:{id}:*` keys.

#### 3.5 Admin vs User Impact
- **User:** Host can initialize live studio, verify audio/video, broadcast, see live timers and viewer counters. Viewers can join room with ultra-low latency.
- **Admin:** Can observe all active streams from the admin control room.

#### 3.6 Post-Phase Testing Checklist
- [ ] Initialize pre-live studio -> verify ZEGOCLOUD RTC token validates with official ZEGOCLOUD token decoder.
- [ ] Call `/start` -> verify stream appears in `/active` cached list.
- [ ] Simulate 50 concurrent socket joins to `stream:{id}` -> verify Redis viewer set cardinality matches 50 and `viewer_count_update` emits 50.
- [ ] Call `/end` -> verify `wrapUpSummary` calculates duration accurately.

---

### Phase 4: Story Claims, Community Voting & Live Winner Selection (ACID)

#### 4.1 Goal & Pre-requisites
- **Goal:** Implement the "Request with Story" applicant pipeline, real-time claim pinning to the live broadcast, community voting, and the ACID transaction for live gift awarding with celebration broadcasts.
- **Pre-requisites:** Phase 3 complete (live stream session must be running to receive and pin claims).

#### 4.2 Files to Create / Update
- `src/app/modules/StoryClaim/storyClaim.interface.ts`
- `src/app/modules/StoryClaim/storyClaim.model.ts`
- `src/app/modules/StoryClaim/storyClaim.validation.ts`
- `src/app/modules/StoryClaim/storyClaim.service.ts`
- `src/app/modules/StoryClaim/storyClaim.controller.ts`
- `src/app/modules/StoryClaim/storyClaim.route.ts`
- `src/app/routes/index.ts` (Register `/story-claims` route)

#### 4.3 API Endpoints Implemented in This Phase
1. `POST /api/v1/story-claims` (`auth(USER)`, story statement + optional media)
2. `GET /api/v1/story-claims/stream/:streamId` (`auth(USER, ADMIN)`)
3. `POST /api/v1/story-claims/:id/vote` (`auth(USER)`)
4. `PATCH /api/v1/story-claims/:id/pin` (`auth(USER)`)
5. `PATCH /api/v1/story-claims/:id/unpin` (`auth(USER)`)
6. `POST /api/v1/story-claims/:id/award` (`auth(USER)` — ACID Transaction)
7. `GET /api/v1/story-claims/:id/pickup-info` (`auth(USER)`)

#### 4.4 Redis Caching Logic & Invalidation Triggers
- **Read Cache:** `claims:stream:{streamId}` (TTL 60s).
- **Eviction Triggers:**
  - Submit claim -> `RedisService.del('claims:stream:{streamId}')`.
  - Pin/Unpin/Award -> update `stream:{id}:state` HSET and invalidate claims cache.

#### 4.5 Admin vs User Impact
- **User:** Viewers can write and submit stories. Host can view bottom sheet claims, pin applicant story to the screen, and execute live award.
- **Admin:** Can review claims in audit table and intervene in disputed awards.

#### 4.6 Post-Phase Testing Checklist
- [ ] Submit claim -> verify uniqueness constraint prevents second claim by same user for same stream.
- [ ] Test Pin claim -> verify all connected sockets in `stream:{id}` receive `story_claim_pinned` event with full claim data.
- [ ] **Race Condition / Concurrency Test:** Execute 10 concurrent requests to `/award` for different claims on the same stream simultaneously.
  - **Expected Result:** Exactly 1 request succeeds with `200 OK`. 9 requests fail with `409 Conflict`.
  - **Verify in Database:** `LiveStream.winner` has exactly 1 ObjectId, `GiftItem.claimState` is `'claimed'`, exactly 1 claim has status `'awarded'`.

---

### Phase 5: Real-Time Live Comments, Documents & Moderation Flagging

#### 5.1 Goal & Pre-requisites
- **Goal:** Implement live stream comments, chat document uploads via multer fields, comment pinning, and user/content report generation.
- **Pre-requisites:** Phase 3 and Phase 4 complete. Existing Chat and Message modules.

#### 5.2 Files to Create / Update
- `src/app/modules/LiveComment/liveComment.interface.ts`
- `src/app/modules/LiveComment/liveComment.model.ts`
- `src/app/modules/LiveComment/liveComment.validation.ts`
- `src/app/modules/LiveComment/liveComment.service.ts`
- `src/app/modules/LiveComment/liveComment.controller.ts`
- `src/app/modules/LiveComment/liveComment.route.ts`
- `src/app/modules/Message/message.route.ts` (Add `upload-chat-document` route with multer fields)
- `src/app/modules/Message/message.controller.ts` (Add handler)
- `src/app/routes/index.ts` (Register `/live-comments` and `/moderation` routes)

#### 5.3 API Endpoints Implemented in This Phase
1. `POST /api/v1/live-comments` (`auth(USER)`)
2. `POST /api/v1/messages/upload-chat-document` (`auth(USER)`, Multer fields `uploadChatDocument`)
3. `PATCH /api/v1/live-comments/:id/pin` (`auth(USER, ADMIN)`)
4. `POST /api/v1/moderation/report` (`auth(USER)`)

#### 5.4 Redis Caching Logic & Invalidation Triggers
- Comments are ephemeral; TTL index auto-deletes from MongoDB after 7 days.
- In-memory rate limiting via Redis (`ratelimit:comments:{userId}`) to prevent chat spam (max 5 comments per 10 seconds).

#### 5.5 Admin vs User Impact
- **User:** Can chat, react with emojis, upload PDF/image documents to private chat, and report abusive content or users.
- **Admin:** Flagged messages automatically queue up in the admin moderation dashboard.

#### 5.6 Post-Phase Testing Checklist
- [ ] Post a live comment -> verify Socket.IO broadcasts `new_live_comment` to stream room in <50ms.
- [ ] Test rate limiter: submit 6 comments in 5 seconds -> assert 6th comment is rejected with `429 Too Many Requests`.
- [ ] Upload chat document with multer field `uploadChatDocument` -> verify file saved to disk and metadata stored in Message attachments array.
- [ ] Report user from chat -> verify `ModerationFlag` created and duplicate report prevented.

---

### Phase 6: Admin Control Room, Telemetry Analytics & Audit Logs

#### 6.1 Goal & Pre-requisites
- **Goal:** Implement all 10 Figma admin screens: Telemetry Overview, User Monitoring with suspension/ban controls, Listings Monitoring, Stories & Claims Audit, Live Stream Watch with remote force-end and mute controls, Revenue Analytics, and immutable audit logs.
- **Pre-requisites:** Phases 1 through 5 complete.

#### 6.2 Files to Create / Update
- `src/app/modules/AuditLog/auditLog.interface.ts`
- `src/app/modules/AuditLog/auditLog.model.ts`
- `src/app/modules/Admin/admin.interface.ts` (Extend with moderation & telemetry types)
- `src/app/modules/Admin/admin.validation.ts` (Add all admin schemas)
- `src/app/modules/Admin/admin.service.ts` (Add moderation, remote stream killswitch, telemetry aggregation)
- `src/app/modules/Admin/admin.controller.ts`
- `src/app/modules/Admin/admin.route.ts` (Wire up all admin endpoints)
- `src/jobs/dailyAnalyticsSnapshot.job.ts` (Daily cron snapshot for `SystemAnalytics`)

#### 6.3 API Endpoints Implemented in This Phase
1. `GET /api/v1/admin/dashboard/telemetry` (`auth(ADMIN, SUPER_ADMIN)`)
2. `GET /api/v1/admin/live-streams/active` (`auth(ADMIN, SUPER_ADMIN)`)
3. `PATCH /api/v1/admin/live-streams/:id/force-terminate` (`auth(ADMIN, SUPER_ADMIN)`)
4. `PATCH /api/v1/admin/live-streams/:id/mute-host` (`auth(ADMIN, SUPER_ADMIN)`)
5. `PATCH /api/v1/admin/users/:id/moderation-action` (`auth(ADMIN, SUPER_ADMIN)`)
6. `PATCH /api/v1/admin/story-claims/:id/review` (`auth(ADMIN, SUPER_ADMIN)`)
7. `GET /api/v1/admin/audit-logs` (`auth(ADMIN, SUPER_ADMIN)`)
8. `GET /api/v1/admin/revenue/analytics` (`auth(ADMIN, SUPER_ADMIN)`)

#### 6.4 Redis Caching Logic & Invalidation Triggers
- **Read Cache:** `admin:dashboard:summary` (TTL 300s), `admin:revenue:summary` (TTL 900s), `admin:streams:active` (TTL 30s).
- **Eviction Triggers:**
  - Moderation action / force-terminate -> evict `admin:dashboard:summary` and `admin:streams:active`.
  - Subscription transaction -> evict `admin:revenue:summary`.

#### 6.5 Admin vs User Impact
- **User:** Users who violate terms are suspended or banned; streams violating policy are terminated remotely with instant client ejection.
- **Admin:** Complete visibility and operational control over users, listings, live streams, revenue, and audits.

#### 6.6 Post-Phase Testing Checklist
- [ ] Call `/admin/dashboard/telemetry` -> verify KPIs match actual document counts in MongoDB.
- [ ] Trigger remote force-terminate on an active stream -> assert:
  - `LiveStream.status` becomes `'terminated_by_admin'`.
  - Connected viewer sockets receive `admin_force_end_stream`.
  - `AdminAuditLog` record created with admin's userId and reason.
- [ ] Test User Ban: call `/admin/users/:id/moderation-action` with `action: 'ban'` -> verify user's next request fails with `400 Bad Request: Your account is blocked`.
- [ ] Verify `AdminAuditLog` is immutable (no update or delete endpoints exposed).
- [ ] Run daily analytics snapshot job -> verify `SystemAnalytics` document created with correct daily aggregations.

---

## 7. Master Architectural Verification Matrix

| Figma UI Requirement | Backend Mechanism | Concurrency / Cache Protection | Tested In Phase |
|---|---|---|---|
| **Pre-Live Studio (Camera prep & Gift selector)** | `POST /live-streams/pre-live-init` | Verifies gift item `claimState: 'available'`. Single host session lock. | Phase 3 |
| **Real-time Live Badge & Timer** | Server-authoritative timer via Socket.IO `timer_tick` + Redis HSET | Prevents client clock drift or manipulation. | Phase 3 |
| **Live Viewer Counter ("125 Viewers")** | Redis Set `stream:{id}:viewers` + `SADD`/`SREM` + debounced Socket.IO broadcast | Handles thousands of concurrent viewer fluctuations without MongoDB writes. | Phase 3 |
| **Pinned Gift Card Overlay** | ZIM Room Attribute `giftItemId` + Redis state HSET | Synchronized on viewer join via initial room payload. | Phase 3 |
| **Live Story Claims Bottom Sheet** | `POST /story-claims` + `GET /story-claims/stream/:id` | Compound unique index `{ applicant: 1, stream: 1 }` prevents double claims. | Phase 4 |
| **Pin Applicant Story Card** | `PATCH /story-claims/:id/pin` + Socket.IO `story_claim_pinned` | Atomic unpin-old / pin-new sequence. | Phase 4 |
| **Live Award Winner Celebration** | `POST /story-claims/:id/award` + Socket.IO `gift_awarded` | **MongoDB ACID Transaction** with `{ winner: null }` filter. 100% race-condition free. | Phase 4 |
| **End Broadcast & Wrap-Up Summary** | `POST /live-streams/:id/end` + `wrapUpSummary` calculation | Redis counters written to MongoDB on stream end; Redis ephemeral keys flushed. | Phase 3 |
| **Admin Live Stream Watch & Controls** | ZEGOCLOUD Admin Spectator Token + Socket.IO moderation channel | Admin can join any stream invisibly and issue commands. | Phase 6 |
| **Remote Stream Force-End** | `PATCH /admin/live-streams/:id/force-terminate` | Emits `admin_force_end_stream`; reverts gift to available; logs audit trail. | Phase 6 |
| **Chat Document Uploads** | `POST /messages/upload-chat-document` | Multer fields with strict mimeType & file size validation. | Phase 5 |
| **Stripe Subscriptions & Limits** | Stripe Webhook Engine + subscription limits enforcement | Cache-aside on plans; webhook-driven tier synchronization. | Phase 1 |

---

> **Plan Status:** READY FOR EXECUTION.  
> Proceed to Phase 1 implementation upon review and confirmation.
