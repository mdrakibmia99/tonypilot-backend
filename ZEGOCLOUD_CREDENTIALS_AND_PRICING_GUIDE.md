# 🎥 ZEGOCLOUD Live Streaming Setup, Credentials & Pricing Guide
> **Document Purpose:** ক্লায়েন্ট (Client) বা বিজনেস ওনারকে সহজে বোঝানোর জন্য সম্পূর্ণ গাইড — ZEGOCLOUD কি, কোথায় অ্যাকাউন্ট খুলতে হবে, কীভাবে `AppID`, `ServerSecret` এবং `CallbackSecret` সংগ্রহ করতে হবে, এবং লাইভ স্ট্রিমিংয়ে কেমন খরচ (Pricing) হবে।  
> **Target Audience:** Project Manager, Client, Frontend/Mobile Team, and Backend Developers.  
> **Official Website:** [https://www.zegocloud.com](https://www.zegocloud.com)  
> **Admin Console:** [https://console.zegocloud.com](https://console.zegocloud.com)

---

## 📑 সূচিপত্র (Table of Contents)
1. [ZEGOCLOUD কি এবং TonyPilot অ্যাপে এটি কেন ব্যবহৃত হচ্ছে?](#1-zegocloud-কি-এবং-tonypilot-অ্যাপে-এটি-কেন-ব্যবহৃত-হচ্ছে)
2. [ক্রেডেনশিয়াল পরিচিতি (What are these 3 keys?)](#2-ক্রেডেনশিয়াল-পরিচিতি-what-are-these-3-keys)
3. [ক্লায়েন্টের জন্য অ্যাকাউন্ট খোলার ও Key সংগ্রহ করার স্টেপ-বাই-স্টেপ গাইড](#3-ক্লায়েন্টের-জন্য-অ্যাকাউন্ট-খোলার-ও-key-সংগ্রহ-করার-স্টেপ-বাই-স্টেপ-গাইড)
4. [ZEGOCLOUD খরচ ও প্রাইসিং কাঠামো (Cost & Pricing Estimation)](#4-zegocloud-খরচ-ও-প্রাইসিং-কাঠামো-cost--pricing-estimation)
5. [বাস্তব উদাহরণ: লাইভ স্ট্রিমে প্রতি মাসে কেমন খরচ হতে পারে? (Real Cost Scenarios)](#5-বাস্তব-উদাহরণ-লাইভ-স্ট্রিমে-প্রতি-মাসে-কেমন-খরচ-হতে-পারে-real-cost-scenarios)
6. [ক্লায়েন্টকে পাঠানোর মতো রেডিমেড মেসেজ/ইমেইল টেমপ্লেট (Client Copy-Paste Message)](#6-ক্লায়েন্টকে-পাঠানোর-মতো-রেডিমেড-মেসেজইমেইল-টেমপ্লেট-client-copy-paste-message)
7. [সিকিউরিটি ও বেস্ট প্র্যাকটিস (Security Rules)](#7-সিকিউরিটি-ও-বেস্ট-প্র্যাকটিস-security-rules)

---

## 1. ZEGOCLOUD কি এবং TonyPilot অ্যাপে এটি কেন ব্যবহৃত হচ্ছে?

**ZEGOCLOUD** হলো বিশ্বমানের একটি রিয়েল-টাইম অডিও/ভিডিও ক্লাউড প্ল্যাটফর্ম (WebRTC RTC Infrastructure)।
- TonyPilot-এ ব্যবহারকারীরা লাইভ ভিডিও সম্প্রচার করে গিফট অনুদান দেয় এবং দর্শকরা রিয়েল-টাইমে লাইভ ভিডিও দেখে আবেদন ও ভোট প্রদান করে।
- ফেসবুক লাইভ বা টিকটক লাইভের মতো মিলিসেকেন্ডের আল্ট্রা-লো ল্যাটেন্সিতে (Ultra-low latency < 300ms) ভিডিও ব্রডকাস্ট করার জন্য ZEGOCLOUD ব্যবহৃত হচ্ছে।
- এটি ব্যাকএন্ডে **AES-256-GCM Token04** ক্রিপ্টোগ্রাফিক অথেন্টিকেশন সাপোর্ট করে, যার ফলে অনুমোদনহীন কোনো দর্শক বা হ্যাকার লাইভ ভিডিও স্ট্রিম হ্যাক করতে পারে না।

---

## 2. ক্রেডেনশিয়াল পরিচিতি (What are these 3 keys?)

ব্যাকএন্ডের `.env` ফাইলের ৩টি চাবি ZEGOCLOUD থেকে পাওয়া যায়:

```env
ZEGO_APP_ID=123456789
ZEGO_SERVER_SECRET=12345678901234567890123456789012
ZEGO_CALLBACK_SECRET=tonypilot_zego_callback_secret_2026
```

| Key Name | কি ধরনের ডাটা? | এর কাজ কি? (Purpose) |
| :--- | :--- | :--- |
| **`ZEGO_APP_ID`** | ৯-১০ সংখ্যার একটি ইউনিক নাম্বার (Number) | এটি হলো ZEGOCLOUD-এ আপনার TonyPilot প্রজেক্টের ইউনিক পরিচিতি আইডি (Project ID)। মোবাইল অ্যাপ ও ব্যাকএন্ড উভয় জায়গায় এটি প্রয়োজন হয়। |
| **`ZEGO_SERVER_SECRET`** | ৩২ অক্ষরের একটি গোপন কোড (32-Character String) | এটি সবচেয়ে সংবেদনশীল চাবি। ব্যাকএন্ড এই সিক্রেট কোডটি দিয়ে হোস্ট এবং দর্শকদের জন্য ক্রিপ্টোগ্রাফিক **Token04** জেনারেট করে। এটি কখনো মোবাইল অ্যাপে এক্সপোজ করা হয় না। |
| **`ZEGO_CALLBACK_SECRET`** | আপনার পছন্দমতো যেকোনো ৩২ অক্ষরের স্ট্রিং | ZEGOCLOUD যখন আপনার ব্যাকএন্ডে Webhook পাঠায় (যেমন: লাইভ স্ট্রিম বন্ধ হওয়া, রুম ক্লোজ হওয়া), তখন সেটির সত্যতা ভেরিফাই করতে এই চাবিটি ব্যবহৃত হয়। |

---

## 3. ক্লায়েন্টের জন্য অ্যাকাউন্ট খোলার ও Key সংগ্রহ করার স্টেপ-বাই-স্টেপ গাইড

ক্লায়েন্ট নিচে উল্লেখিত ৭টি সহজ ধাপ অনুসরণ করে ৫ মিনিটের মধ্যে ক্রেডেনশিয়াল সংগ্রহ করতে পারবেন:

### 🔹 ধাপ ১: ZEGOCLOUD ওয়েবসাইটে সাইন আপ করুন
1. ব্রাউজারে যান: 👉 **[https://console.zegocloud.com](https://console.zegocloud.com)**
2. **"Sign up"** বাটনে ক্লিক করুন।
3. ক্লায়েন্টের বিজনেস ইমেইল এবং পাসওয়ার্ড দিয়ে অ্যাকাউন্ট তৈরি করুন।
4. ইমেইলে যাওয়া ভেরিফিকেশন কোড দিয়ে অ্যাকাউন্ট ভেরিফাই করুন।

> [!TIP]
> সাইন আপ করার সাথে সাথেই ZEGOCLOUD প্রতিটি নতুন অ্যাকাউন্টে **প্রতি মাসে ১০,০০০ মিনিট বিনামূল্যে (10,000 Free Minutes/month)** প্রদান করে!

---

### 🔹 ধাপ ২: নতুন প্রজেক্ট তৈরি করুন (Create Project)
1. লগইন করার পর ড্যাশবোর্ডে **"Project Management"** মেনুতে ক্লিক করুন।
2. নীল রঙের **"+ Create Project"** বাটনে ক্লিক করুন।
3. প্রজেক্টের ব্যবহার ক্যাটাগরি (Scenario) হিসেবে সিলেক্ট করুন:  
   👉 **"Live Streaming"** অথবা **"Interactive Live Streaming"**।
4. এরপর নিচে **"Next"** বাটনে ক্লিক করুন।
5. **Project Name** দিন: `TonyPilot` (বা আপনার পছন্দের নাম)।
6. SDK টাইপ হিসেবে সিলেক্ট করুন: **"Custom UI SDK"** অথবা **"UIKits"**।
7. নিচে **"Start with UIKits"** বা **"Create"** বাটনে ক্লিক করুন। কয়েক সেকেন্ডের মধ্যে প্রজেক্টটি তৈরি হয়ে যাবে।

---

### 🔹 ধাপ ৩: `AppID` এবং `ServerSecret` কপি করুন
1. **"Project Management"** লিস্ট থেকে আপনার তৈরি করা `TonyPilot` প্রজেক্টের নামের উপর ক্লিক করুন।
2. **"Project Configuration"** ট্যাবে যান।
3. এখানে স্পষ্টভাবে নিচের দুটি মান দেখতে পাবেন:
   - **AppID:** এখানে ৯ বা ১০ ডিজিটের সংখ্যা থাকবে (যেমন: `1892837461`)। এটি কপি করে নিন।
   - **ServerSecret:** এখানে ৩২ অক্ষরের গোপন কোড থাকবে। **Eye (চোখ)** আইকনটিতে ক্লিক করুন অথবা **Copy** বাটনে চাপ দিয়ে ৩২ ডিজিটের স্ট্রিংটি কপি করুন।

---

### 🔹 ধাপ ৪: Webhook Callback Secret কনফিগার করুন (Optional but Recommended)
1. একই প্রজেক্ট পেজে নিচে স্ক্রোল করে **"Server-to-Server Callback"** বা **"Callback Settings"** সেকশনে যান।
2. **Callback URL** ফিল্ডে আপনার ব্যাকএন্ড Webhook URL দিন:
   ```text
   https://api.tonypilot.com/api/v1/live-streams/webhook/zego
   ```
3. **Callback Secret:** ফিল্ডে একটি গোপন স্ট্রিং দিন (যেমন: `tonypilot_zego_callback_secret_2026`) অথবা সিস্টেমের জেনারেট করা সিক্রেটটি কপি করে নিন।
4. নিচের ইভেন্টগুলোতে টিক চিহ্ন (Checkmark) দিন:
   - [x] Stream Create (লাইভ শুরু হওয়া)
   - [x] Stream Close (লাইভ শেষ হওয়া)
   - [x] Room Close (রুম বন্ধ হওয়া)
5. **Save** বাটনে ক্লিক করুন।

---

## 4. ZEGOCLOUD খরচ ও প্রাইসিং কাঠামো (Cost & Pricing Estimation)

ক্লায়েন্টের সবচেয়ে সাধারণ প্রশ্ন থাকে: **"লাইভ স্ট্রিমিংয়ে কেমন খরচ হবে?"**

### 🎁 ১. বিনামূল্যে সুবিধা (100% Free Tier):
- **প্রতি মাসে ১০,০০০ মিনিট ফ্রি (10,000 Free Minutes Every Month):**
  - ZEGOCLOUD কোনো ক্রেডিট কার্ড ছাড়া অথবা পেইড প্ল্যানে থাকা সত্ত্বেও প্রতি মাসে প্রথম ১০,০০০ মিনিট বিনামূল্যে দেয়।
  - প্রাথমিক ডেভেলপমেন্ট, টেস্টিং এবং ছোটখাটো ব্রডকাস্টের জন্য এই ফ্রি মিনিটই যথেষ্ট।

### 💳 ২. পে-অ্যাজ-ইউ-গো প্রাইসিং (Pay-as-you-go Rates):
১০,০০০ ফ্রি মিনিট শেষ হওয়ার পর প্রতি মিনিটের জন্য নগণ্য পরিমাণ চার্জ হয়:

| সার্ভিস টাইপ | রেজোলিউশন / কোয়ালিটি | প্রতি ইউজার প্রতি মিনিট খরচ (USD) | ১০০০ ইউজার-মিনিটের খরচ |
| :--- | :--- | :--- | :--- |
| **Interactive Video RTC (HD)** | 720p (30fps) — *প্রস্তাবিত* | **$0.0039** / মিনিট | **$3.90** |
| **Interactive Video RTC (FHD)** | 1080p Full HD | **$0.0075** / মিনিট | **$7.50** |
| **Audio Only (ভয়েস কল/স্পিকার)** | Ultra-clean Audio | **$0.00099** / মিনিট | **$0.99** |
| **Live Streaming CDN (Massive Audience)**| Ultra-low latency L3 CDN | **$0.0006 - $0.001** / মিনিট | **$0.60 - $1.00** |

> [!NOTE]
> **ইউজার-মিনিট (User-Minute) হিসাব করার নিয়ম:**  
> মোট মিনিট = (লাইভের সময়কাল) × (মোট দর্শকের সংখ্যা + হোস্ট)।  
> উদাহরণ: ১ জন হোস্ট এবং ১৯ জন দর্শক যদি ৩০ মিনিট লাইভ দেখে, তবে মোট মিনিট = ২০ জন × ৩০ মিনিট = **৬০০ মিনিট**।

---

## 5. বাস্তব উদাহরণ: লাইভ স্ট্রিমে প্রতি মাসে কেমন খরচ হতে পারে? (Real Cost Scenarios)

### 🟢 দৃশ্যপট ১: প্রাথমিক পর্যায় (Small / Testing Phase)
- মাসে ২০টি লাইভ স্ট্রিম।
- প্রতিটি লাইভ স্ট্রিম ২০ মিনিট স্থায়ী।
- প্রতিটি লাইভে গড়ে ১০ জন দর্শক।
- **মোট মিনিট:** ২০টি স্ট্রিম × ২০ মিনিট × ১১ জন (১০ দর্শক + ১ হোস্ট) = **৪,৪০০ মিনিট**।
- **মাসিক খরচ:** **$0.00 (একদম ফ্রি!)**  
  *(কারণ এটি ZEGOCLOUD-এর ১০,০০০ ফ্রি মিনিটের কোটার মধ্যেই শেষ হয়ে যাচ্ছে)*।

---

### 🟡 দৃশ্যপট ২: মাঝারি আকারের লাইভ প্ল্যাটফর্ম (Growing Business)
- মাসে ৩০টি লাইভ স্ট্রিম (প্রতিদিন ১টি করে)।
- প্রতিটি লাইভে ৩০ মিনিট স্থায়ী।
- প্রতিটি লাইভে গড়ে ৫০ জন দর্শক।
- **মোট মিনিট:** ৩০টি স্ট্রিম × ৩০ মিনিট × ৫১ জন = **৪৫,৯০০ মিনিট**।
- **হিসাব:**
  - প্রথম ১০,০০০ মিনিট = **$0.00 (ফ্রি)**
  - অবশিষ্ট ৩৫,৯০০ মিনিট × $0.0039 = **$140.01**
- **মাসিক খরচ:** প্রায় **$140 ডলার** (প্রতিদিন ৫০ জন দর্শক নিয়ে ৩০ মিনিট লাইভ করার পর)।

---

### 🔴 দৃশ্যপট ৩: বিশাল প্ল্যাটফর্ম (High Traffic Scale with CDN)
- মাসে ৫০টি লাইভ স্ট্রিম।
- প্রতিটি লাইভে ৫০০ জন দর্শক ১ ঘণ্টা ধরে দেখছে।
- এই ধরণের বড় অডিয়েন্সে ZEGOCLOUD CDN ব্যবহার করা হয়, যেখানে প্রতি দর্শকের খরচ নেমে আসে মাত্র $0.0008 প্রতি মিনিটে।
- **মাসিক খরচ:** প্রায় **$180 - $220 ডলার**।

---

## 6. ক্লায়েন্টকে পাঠানোর মতো রেডিমেড মেসেজ/ইমেইল টেমপ্লেট (Client Copy-Paste Message)

ক্লায়েন্টকে আপনি সরাসরি নিচের মেসেজটি কপি করে পাঠাতে পারেন:

````markdown
Hi [Client Name],

For our TonyPilot live video streaming & gift-giving feature, we are using **ZEGOCLOUD** (a world-class ultra-low-latency WebRTC video infrastructure).

To integrate the live video engine with our backend and mobile app, we need you to create a ZEGOCLOUD account and provide us with 3 project keys.

### 📝 Step-by-Step Instructions (Takes ~5 Minutes):
1. Go to: https://console.zegocloud.com and sign up with your business email.
2. Go to **"Project Management"** -> Click **"+ Create Project"**.
3. Select **"Live Streaming"** -> Click **Next**.
4. Set the project name as **"TonyPilot"** and select **"Custom UI SDK"**.
5. Once created, click on your project to open **Project Configuration**.
6. Copy the following credentials and share them with us securely:
   - **AppID** (a 9-10 digit number)
   - **ServerSecret** (a 32-character secret code; click the eye/copy icon)

### 💰 Pricing & Free Tier Info:
- ZEGOCLOUD provides **10,000 FREE video minutes every month** to every account.
- For our initial testing and initial launch, it will be **$0.00 (Completely Free)**.
- When the platform scales beyond 10,000 minutes/month, it costs approximately **$3.90 per 1,000 participant-minutes** (very affordable and pay-as-you-go).

Please let us know once you have created the project so we can plug the keys into our production environment.

Thank you!
````

---

## 7. সিকিউরিটি ও বেস্ট প্র্যাকটিস (Security Rules)

1. **ServerSecret কখনো মোবাইল অ্যাপে রাখবেন না:**  
   `ZEGO_SERVER_SECRET` শুধুমাত্র ব্যাকএন্ড সার্ভারের `.env` ফাইলে থাকবে। মোবাইল ক্লায়েন্ট সরাসরি ব্যাকএন্ডের `/api/v1/live-streams/pre-live-init` এবং `/api/v1/live-streams/:id/join` এন্ডপয়েন্টে কল করে টাইম-লিমিটেড AES-256 টোকেন সংগ্রহ করবে।
2. **Token04 Expiration:**  
   TonyPilot ব্যাকএন্ড প্রতিটি টোকেনের মেয়াদ সর্বোচ্চ ২ ঘণ্টার জন্য নির্ধারণ করে। মেয়াদ শেষ হলে টোকেনটি স্বয়ংক্রিয়ভাবে বাতিল হয়ে যায়।
3. **Webhook Verification:**  
   `ZEGO_CALLBACK_SECRET` ব্যবহার করে ব্যাকএন্ড প্রতিটি ওয়েবহুক রিকোয়েস্টের SHA-256 সিগনেচার যাচাই করে, যাতে ভুয়া কোনো থার্ড-পার্টি রিকোয়েস্ট আসতে না পারে।

---

> ✅ **Summary:**  
> - Website: [console.zegocloud.com](https://console.zegocloud.com)  
> - Required Keys: `ZEGO_APP_ID`, `ZEGO_SERVER_SECRET`, `ZEGO_CALLBACK_SECRET`  
> - Free Quota: **10,000 minutes/month**  
> - Pricing after free quota: ~$0.0039 / user-minute
