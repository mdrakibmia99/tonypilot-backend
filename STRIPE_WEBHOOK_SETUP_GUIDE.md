# 🪝 Stripe Webhook Setup Guide for TonyPilot Subscriptions
> **Document Purpose:** Complete A-to-Z guide on creating, configuring, and verifying Stripe Webhooks for TonyPilot's subscription billing engine.  
> **Backend Endpoint:** `POST /api/v1/subscriptions/webhook`  
> **Stripe Account:** `acct_1TZoUM3P24vhJq5R` (*Olive Dome*)

---

## 📌 ১. সরাসরি প্রশ্নের উত্তর (Quick Answers to Your Core Questions)

| প্রশ্ন (Question) | সঠিক উত্তর (Answer) | বিস্তারিত কারণ (Why & Technical Explanation) |
| :--- | :--- | :--- |
| **1. Event Destination Scope কি হবে? (`Your account` নাকি `Connected account`)** | **`Your account`** *(Direct / Platform Account)* | TonyPilot-এ ব্যবহারকারীরা যে সাবস্ক্রিপশন প্ল্যান (Basic Host, Pro Host) কিনছেন, তার পুরো টাকা সরাসরি আপনার TonyPilot প্ল্যাটফর্ম অ্যাকাউন্টে জমা হয়। `Connected accounts` কেবল তখনই ব্যবহার করা হয় যখন আপনি Stripe Connect (যেমন: Uber, Airbnb, বা মাল্টি-ভেন্ডর মার্কেটপ্লেস) তৈরি করেন যেখানে থার্ড-পার্টি সেলারদের সরাসরি পে-আউট পাঠানো হয়। তাই এখানে **`Your account`** সিলেক্ট করতে হবে (`connect: false`)। |
| **2. Payload Style কি হবে? (`Snapshot` নাকি `Thin`)** | **`Snapshot`** *(Full Event Payload)* | Stripe-এর নতুন Workbench / Event Destinations ইন্টারফেসে দুটি অপশন থাকে: `Snapshot` ও `Thin`। `Thin` পে-লোড কেবল রিসোর্স আইডি পাঠায় (`id: "sub_123"`), যার ফলে ব্যাকএন্ডে আবার আলাদা API কল করে ডাটা আনতে হয়। পক্ষান্তরে, **`Snapshot`** সম্পূর্ণ রিসোর্স অবজেক্ট (`Customer`, `Subscription`, `Invoice`, `amount_paid`, `period_end`, `metadata`) একবারে পাঠায়। TonyPilot ব্যাকএন্ড কোড সরাসরি `event.data.object` থেকে সম্পূর্ণ তথ্য রিড করে, তাই **`Snapshot (Full event data)`** নির্বাচন করা **বাধ্যতামূলক**! |
| **3. কোন কোন ইভেন্ট (Event Names) সিলেক্ট করতে হবে?** | **৫টি নির্দিষ্ট ইভেন্ট** *(নিচে তালিকা দেখুন)* | সাবস্ক্রিপশন চালু, ১ মাস পর অটো-রিনিউয়াল, পেমেন্ট ফেইল্ড এবং ক্যান্সেলেশন ট্র্যাক করার জন্য ৫টি ইভেন্ট সিলেক্ট করতে হবে। |

---

## 🔔 ২. সিলেক্ট করার মতো ইভেন্টের তালিকা (Required Webhook Events Note)

Stripe ড্যাশবোর্ডে নিচের ৫টি ইভেন্ট সিলেক্ট করতে হবে:

### ① `checkout.session.completed`
- **কখন ট্রিগার হয়:** যখন ব্যবহারকারী Stripe Checkout পেজে গিয়ে প্রথমবার কার্ড দিয়ে সফলভাবে সাবস্ক্রিপশন পারচেজ করে।
- **TonyPilot ব্যাকএন্ড যা করে:**
  - `session.metadata.userId` এবং `planId` রিড করে ডাটাবেজে `UserSubscription` ডকুমেন্ট তৈরি/আপডেট করে।
  - ব্যবহারকারীর `subscriptionTier` আপডেট করে (`basic` বা `pro`)।
  - Redis ক্যাশ ইভিক্ট করে ইনস্ট্যান্ট অ্যাক্টিভেশন নিশ্চিত করে।

### ② `invoice.paid` *(অথবা `invoice.payment_succeeded`)*
- **কখন ট্রিগার হয়:** প্রতি ১ মাস পর পর যখন Stripe স্বয়ংক্রিয়ভাবে গ্রাহকের সেভ করা কার্ড থেকে রিনিউয়াল বিল চার্জ করে (**Auto-Renewal Engine**)।
- **TonyPilot ব্যাকএন্ড যা করে:**
  - সাবস্ক্রিপশনের মেয়াদ আরও ৩০ দিন বৃদ্ধি করে (`currentPeriodEnd` আপডেট হয়)।
  - ডাটাবেজে একটি `PaymentTransaction` লগ তৈরি করে (`status: 'succeeded'`)।
  - সাবস্ক্রিপশনের স্ট্যাটাস `active` নিশ্চিত করে।

### ③ `invoice.payment_failed`
- **কখন ট্রিগার হয়:** যদি অটো-রিনিউয়ালের সময় গ্রাহকের কার্ডে পর্যাপ্ত ব্যালেন্স না থাকে বা কার্ড এক্সপায়ার হয়ে পেমেন্ট ফেইল করে।
- **TonyPilot ব্যাকএন্ড যা করে:**
  - সাবস্ক্রিপশন স্ট্যাটাস `past_due` করে দেয়।
  - ডাটাবেজে ফেইল্ড ট্রানজ্যাকশন হিস্ট্রি রেকর্ড করে (`status: 'failed'`) যাতে ইউজার অ্যাপে সতর্কবার্তা দেখতে পায়।

### ④ `customer.subscription.updated`
- **কখন ট্রিগার হয়:** গ্রাহক যখন অটো-রিনিউয়াল চালু বা বন্ধ করে (`cancel_at_period_end: true/false`), অথবা প্ল্যান আপগ্রেড/ডাউনগ্রেড হয়।
- **TonyPilot ব্যাকএন্ড যা করে:**
  - ডাটাবেজে `autoRenew` এবং `cancelAtPeriodEnd` ফ্ল্যাগ সিনক্রোনাইজ করে।

### ⑤ `customer.subscription.deleted`
- **কখন ট্রিগার হয়:** সাবস্ক্রিপশন বাতিল হওয়ার পর যখন বিলিং পিরিয়ড পুরোপুরি শেষ হয়ে যায়, অথবা অ্যাডমিন সরাসরি সাবস্ক্রিপশন ডিলিট করে।
- **TonyPilot ব্যাকএন্ড যা করে:**
  - সাবস্ক্রিপশন স্ট্যাটাস `canceled` করে দেয়।
  - ব্যবহারকারীকে স্বয়ংক্রিয়ভাবে **`free`** টিয়ারে নামিয়ে দেয় (`subscriptionTier: 'free'`)।

---

## 🖥️ ৩. Stripe ড্যাশবোর্ড থেকে Webhook সেটআপ করার স্টেপ-বাই-স্টেপ গাইড

### ধাপ ১: Stripe Dashboard এ লগইন করুন
1. [Stripe Dashboard](https://dashboard.stripe.com/acct_1TZoUM3P24vhJq5R) এ যান।
2. উপরে ডানপাশে **Test Mode** টগল বাটনটি চালু (ON) আছে কিনা নিশ্চিত করুন।

### ধাপ ২: Webhooks পেজে যান
- বামপাশের মেনু থেকে **Developers** এ ক্লিক করুন -> এরপর **Webhooks** সিলেক্ট করুন।  
  *(অথবা সরাসরি লিঙ্ক: `https://dashboard.stripe.com/test/webhooks`)*
- অথবা নতুন Stripe UI হলে: **Workbench** -> **Event destinations** এ যান।

### ধাপ ৩: Add Destination / Add Endpoint বাটনে ক্লিক করুন
- **"+ Add destination"** অথবা **"+ Add endpoint"** বাটনে ক্লিক করুন।

### ধাপ ৪: সঠিক কনফিগারেশন ইনপুট দিন
1. **Event Destination Scope:**
   - রেডিও বাটন থেকে সিলেক্ট করুন: **`Your account`** (Listen to events on your account)।
2. **Endpoint URL:**
   - আপনার লাইভ সার্ভার ডোমেন অথবা ngrok URL দিন:
     ```text
     https://api.yourdomain.com/api/v1/subscriptions/webhook
     ```
   *(লোকাল ডেভেলপমেন্টের জন্য নিচের ৪ নম্বর সেকশনে Stripe CLI ব্যবহার দেখুন)*।
3. **Payload Style (যদি অপশন থাকে):**
   - সিলেক্ট করুন: **`Snapshot`** *(Full event data)*।
4. **Description (ঐচ্ছিক):**
   - `TonyPilot Production Subscription Billing Webhook`।
5. **Version:**
   - Latest API Version অথবা আপনার অ্যাকাউন্টের ডিফল্ট ভার্সন রাখুন।

### ধাপ ৫: ইভেন্ট সিলেক্ট করুন (Select events to listen to)
**"+ Select events"** বাটনে ক্লিক করে নিচের ইভেন্টগুলো টিক দিন:
- [x] `checkout.session.completed`
- [x] `invoice.paid`
- [x] `invoice.payment_succeeded`
- [x] `invoice.payment_failed`
- [x] `customer.subscription.updated`
- [x] `customer.subscription.deleted`

### ধাপ ৬: Add Endpoint এ ক্লিক করে সেভ করুন
- নিচে **"Add endpoint"** বাটনে ক্লিক করুন।

### ধাপ ৭: Webhook Signing Secret কপি করুন
1. তৈরি হওয়া Webhook Endpoint-এর ডিটেইলস পেজে **"Signing secret"** সেকশন দেখতে পাবেন।
2. **"Reveal"** বাটনে ক্লিক করুন।
3. এটি `whsec_...` দিয়ে শুরু হওয়া একটি স্ট্রিং দেখাবে (যেমন: `whsec_1a2b3c4d5e...`)।
4. এই সিক্রেটটি কপি করে আপনার ব্যাকএন্ডের `.env` ফাইলে বসিয়ে দিন:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_your_copied_secret_here
   ```

---

## 💻 ৪. লোকাল কম্পিউটারে টেস্ট করার পদ্ধতি (Stripe CLI Local Setup)

লোকাল কম্পিউটারে (`localhost:5000`) কোনো পাবলিক ডোমেইন বা ngrok ছাড়াও Stripe CLI দিয়ে শতভাগ নিখুঁতভাবে রিয়েল ইভেন্ট টেস্ট করা যায়।

### ধাপ ১: Stripe CLI ইন্সটল ও লগইন
```bash
# Stripe CLI লগইন করুন
stripe login
```
ব্রাউজারে একটি অথোরাইজেশন পেজ খুলবে, সেখানে আপনার `Olive Dome` অ্যাকাউন্ট অ্যাপ্রুভ করুন।

### ধাপ ২: লোকাল ব্যাকএন্ডে Webhook ফরওয়ার্ড করুন
```bash
stripe listen --forward-to localhost:5000/api/v1/subscriptions/webhook
```
এটি টার্মিনালে সাথে সাথে একটি লোকাল টেস্ট সিক্রেট প্রিন্ট করবে:
```text
> Ready! Your webhook signing secret is whsec_test_local_secret_abcdef123456 (^C to quit)
```
এই `whsec_test_local_...` সিক্রেটটি আপনার লোকাল `.env` ফাইলের `STRIPE_WEBHOOK_SECRET`-এ পেস্ট করে সার্ভার রিস্টার্ট দিন।

### ধাপ ৩: টেস্ট ইভেন্ট ট্রিগার করুন (Testing Webhooks)
আরেকটি টার্মিনাল খুলে নিচের কমান্ডগুলো দিয়ে টেস্ট ইভেন্ট ফায়ার করুন:

```bash
# ১. সাবস্ক্রিপশন চেকআউট টেস্ট
stripe trigger checkout.session.completed

# ২. অটো-রিনিউয়াল ইনভয়েস পেইড টেস্ট (+৩০ দিন বৃদ্ধি ও পেমেন্ট ট্রানজ্যাকশন)
stripe trigger invoice.paid

# ৩. পেমেন্ট ফেইল্ড টেস্ট (past_due স্ট্যাটাস)
stripe trigger invoice.payment_failed

# ৪. সাবস্ক্রিপশন ক্যান্সেলেশন টেস্ট (ফ্রি টিয়ারে ডাউনগ্রেড)
stripe trigger customer.subscription.deleted
```

প্রতিটি কমান্ড চালানোর সাথে সাথে আপনার ব্যাকএন্ড টার্মিনালে লগ আসবে:
```text
[INFO] [Stripe Webhook] Processing event: invoice.paid [evt_1...]
[INFO] [Stripe Webhook] Auto-renewal succeeded for subscription sub_1...
```

---

## 🤖 ৫. Stripe MCP / API দিয়ে সরাসরি Webhook তৈরি করার নিয়ম

আপনার Stripe MCP সার্ভারে `stripe_api_write` ও `stripe_api_read` টুল ইন্টিগ্রেট করা আছে। 

### বিদ্যমান Webhook চেক করার MCP কল:
```json
{
  "stripe_api_operation_id": "GetWebhookEndpoints",
  "parameters": {}
}
```

### প্রোগ্রাম্যাটিকভাবে Webhook তৈরি করার MCP কল:
যখন আপনার পাবলিক লাইভ সার্ভার URL (বা ngrok URL) প্রস্তুত থাকবে, তখন Stripe MCP দিয়ে নিচের মতো কল পাঠালেই স্বয়ংক্রিয়ভাবে Webhook তৈরি হয়ে যাবে:

```json
{
  "stripe_api_operation_id": "PostWebhookEndpoints",
  "parameters": {
    "url": "https://api.tonypilot.com/api/v1/subscriptions/webhook",
    "connect": false,
    "enabled_events": [
      "checkout.session.completed",
      "invoice.paid",
      "invoice.payment_succeeded",
      "invoice.payment_failed",
      "customer.subscription.updated",
      "customer.subscription.deleted"
    ],
    "description": "TonyPilot Subscription Billing Webhook"
  }
}
```
*(যেখানে `"connect": false` নিশ্চিত করে এটি **Your account** স্কোপেই তৈরি হবে)।*

---

## ⚠️ ৬. সিকিউরিটি ও কমন এরর সমাধান (Troubleshooting)

### ১. `StripeSignatureVerificationError: No signatures found matching that expected for payload`
- **কারণ:** `.env` ফাইলের `STRIPE_WEBHOOK_SECRET` এর সাথে Stripe ড্যাশবোর্ড বা Stripe CLI-এর সিক্রেট মিলছে না।
- **সমাধান:** ড্যাশবোর্ডের "Signing secret" reveal করে কপি করুন অথবা লোকাল টেস্টিংয়ে `stripe listen` যে `whsec_...` প্রিন্ট করে তা হুবহু `.env`-এ বসান।

### ২. Raw Body Parsing
- **কারণ:** Stripe Webhook সিগনেচার ভেরিফাই করার জন্য এক্সপ্রেসের পার্স করা JSON অবজেক্ট নয়, বরং অরিজিনাল **Raw Buffer** প্রয়োজন হয়।
- **TonyPilot স্ট্যাটাস:** আমাদের [src/app.ts](file:///E:/project/tonypilot-backend/src/app.ts) ফাইলে ইতিমধ্যে এক্সপ্রেসের ভেরিফাই ফাংশন দিয়ে `req.rawBody = buf;` সেভ করা আছে, তাই কোনো অতিরিক্ত বডি-পার্সার কনফ্লিক্ট হবে না।

### ৩. Idempotency & Duplicate Events
- Stripe একই ইভেন্ট নেটওয়ার্ক ল্যাগ বা ফেইল্ড রেসপন্সের কারণে একাধিকবার ডেলিভার করতে পারে। TonyPilot-এর `subscription.service.ts` এ প্রতিটি হ্যান্ডলারে MongoDB `findOneAndUpdate` এবং `lastWebhookAt` ব্যবহার করা হয়েছে, যাতে একই ইভেন্ট দুইবার আসলেও ডাটাবেজে ডুপ্লিকেট ইনভ্যালিড স্টেট তৈরি না হয়।

---

> ✅ **Summary Checklist:**
> 1. Scope: **Your account**
> 2. Payload: **Snapshot**
> 3. Events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
> 4. Secret: Copy `whsec_...` into `.env` as `STRIPE_WEBHOOK_SECRET`
