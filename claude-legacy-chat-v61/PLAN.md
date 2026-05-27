# App Store Conversion Plan

How to take this PWA from web app → iOS App Store + Google Play Store, with minimum changes and minimum cost.

---

## TL;DR — Recommended approach

**Use Capacitor + your existing PWA code.**

- **Total cost:** $99/year (Apple) + $25 one-time (Google) = ~$10/month
- **Total effort:** ~1 week of evening work
- **Code rewrite:** None. Your existing HTML/CSS/JS works as-is.
- **Hosting:** Free (Railway free tier or GitHub Pages for assets)

This wraps your existing PWA in a thin native shell. Apple/Google see it as a real app, you keep using your web code.

---

## Path comparison

| Approach | Effort | Cost | App Store | iCloud sync | Push notifications |
|---|---|---|---|---|---|
| **PWA only (current)** | 0 | Free | ❌ | ❌ | ❌ |
| **Capacitor wrapper** | 1 week | $99+$25/yr | ✅ | ⚠️ Setup needed | ✅ |
| **React Native rebuild** | 4 weeks | $99+$25/yr | ✅ | ✅ | ✅ |
| **Full native SwiftUI** | 8 weeks | $99/yr | ✅ iOS only | ✅ | ✅ |

Capacitor is the sweet spot. Going forward I'll detail that path.

---

## Phase 1 — Prerequisites (1 day)

### Apple Developer account ($99/year)

1. Go to **developer.apple.com/programs/enroll**
2. Sign in with your Apple ID (same as iCloud)
3. Choose **Individual** enrollment (not Organization — simpler, no DUNS number needed)
4. Pay $99
5. Wait 24–48 hours for approval

### Google Play Console ($25 one-time)

1. Go to **play.google.com/console**
2. Sign in with Google account
3. Pay $25 (one-time, for life)
4. Verify identity

### Required tools

- **Mac** (you have one) — Xcode is Mac-only, required for iOS builds
- **Xcode** (free) — `xcode-select --install` then download from App Store
- **Android Studio** (free) — only needed for Android build
- **Node.js 18+** (you have it)

---

## Phase 2 — Capacitor setup (2 hours)

### Step 1: Convert PWA to Capacitor project

```bash
# From your existing claude-ios-v5 folder
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android

# Initialize
npx cap init "Claude Companion" "com.yourname.claudecompanion" --web-dir=public

# Add platforms
npx cap add ios
npx cap add android
```

This creates `ios/` and `android/` folders alongside your existing `public/`.

### Step 2: Adjust for native context

The server-based architecture won't work in a packaged app — the app needs to call Anthropic directly. Two small changes:

**A. Replace the proxy with direct API calls.** Modify `index.html`'s `send()` function:

```javascript
// OLD (uses your server proxy):
fetch('/api/chat', ...)

// NEW (direct to Anthropic):
fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({ model, max_tokens, messages, system })
})
```

**B. Use Capacitor's secure storage instead of localStorage** for the API key:

```javascript
import { Preferences } from '@capacitor/preferences';
await Preferences.set({ key: 'api_key', value: apiKey });
const { value } = await Preferences.get({ key: 'api_key' });
```

This uses iOS Keychain / Android Keystore — much more secure than localStorage.

### Step 3: Build assets

```bash
npx cap copy   # Copy web assets into native projects
npx cap sync   # Update native dependencies
```

### Step 4: Test on simulator

```bash
npx cap open ios  # Opens Xcode
# Press the Play button → iPhone simulator launches with your app
```

---

## Phase 3 — App Store assets (1–2 days)

You'll need to produce these regardless of platform.

### App icon

- **1024×1024 PNG** master icon (no transparency, no rounded corners — Apple adds them)
- I can generate one for you that matches your app's gold/dark aesthetic
- Tools: Figma, or [makeappicon.com](https://makeappicon.com) auto-generates all sizes

### Screenshots

Required for Apple/Google. Take from simulator:
- **iPhone:** 6.7" (iPhone 14 Pro Max), 6.5", 5.5" screens — at least 3 screenshots each
- **Android:** 16:9 or 9:16 aspect, 1080p+
- Show: chat screen, model picker, memory feature, settings

### Marketing copy

**App name:** "Claude Companion" or "Personal Claude" (search "Claude" — must be unique)

**Subtitle (Apple, 30 chars):** "AI chat with memory"

**Description (4000 chars max):**
```
A private, persistent companion for Claude AI conversations.

KEY FEATURES
• Long-term memory across all sessions
• Switch between Claude models (Opus, Sonnet, Haiku)
• Extended thinking mode shows Claude's reasoning
• Profile notes Claude remembers about you
• Full chat history browsable and exportable
• Bring your own Anthropic API key

PRIVACY-FIRST
• All conversations stored only on your device
• Your API key never leaves your iPhone
• No tracking, no analytics, no servers see your data

REQUIRES
• Anthropic API key (free to create at console.anthropic.com)
• Pay-as-you-use pricing (~$5–10/month for typical use)
```

### Privacy policy

Required by Apple/Google. Mine looks like:

> This app does not collect any user data. All conversations, API keys, and settings are stored locally on your device. When you send a message, it is transmitted directly to Anthropic's API; we do not see or store this data. See Anthropic's privacy policy for their data handling.

Host on GitHub Pages or any free static host. Need a public URL.

---

## Phase 4 — App Store submission (1 day + waiting)

### Apple App Store Connect

1. Go to **appstoreconnect.apple.com**
2. **My Apps → +** → New App
3. Fill in:
   - Name, subtitle, category (Productivity or Utilities)
   - Privacy policy URL
   - Age rating (17+ — unrestricted AI generated content)
   - Screenshots
   - Description
4. **Build** → select the build you uploaded from Xcode
5. **Submit for Review**

Review takes **24–72 hours typically.**

### Google Play Console

Similar process — slightly less strict review. Usually approved in 1–3 days.

---

## Phase 5 — Apple review pitfalls (important!)

Apple has specifically tightened rules on AI apps and "bring your own key" apps. Likely issues you'll face:

### Issue 1: "Apps must work without external setup"

Apple often rejects apps that require users to set up API keys elsewhere.

**Mitigation:**
- Make the setup guide VERY prominent in onboarding
- Add a "Try with demo key" option (you pay for a limited demo, then ask user to set up their own)
- Mention in App Store description: "Requires Anthropic API key"
- Include a free trial credit if budget allows (~$5 per signup) — write off as marketing cost

### Issue 2: AI content policies

Apple requires:
- Way to report offensive content (add a "Report" button in chat)
- Content filtering for child safety
- Age gate (17+ is sufficient)

**Mitigation:** Anthropic's API has built-in safety; document it in your privacy/terms.

### Issue 3: "Looks like a web view"

Apple sometimes rejects PWA wrappers as "just a website".

**Mitigation:**
- Add **native iOS features** that prove it's not just a webpage:
  - Native share sheet integration
  - Haptic feedback on send
  - iCloud sync for memory across user's devices
  - Push notifications (optional)
- Each of these is one-line Capacitor plugins

### Issue 4: In-app purchase requirement

If you offer a "premium" tier inside the app, Apple takes 30% (15% for small developers). Since you're "BYO key" only, this doesn't apply.

---

## Phase 6 — Free hosting strategy

### For your existing PWA (web version)

- **Railway free tier** (current) — sleeps after idle, wakes on request
- **Vercel free tier** — better for static + serverless
- **Cloudflare Pages** — best for performance, free tier generous

For the App Store version, you don't need hosting at all — the app calls Anthropic directly.

### For privacy policy + setup guide

- **GitHub Pages** — free, custom domain, no ads
- **Cloudflare Pages** — same
- Both host static HTML for free forever

---

## Suggested timeline

| Week | Task |
|---|---|
| **Week 1** | Apple Developer enrollment (waits for approval), Capacitor setup, design app icon |
| **Week 2** | Implement direct-API calls, Keychain storage, native polish (haptics, sharing) |
| **Week 3** | Generate screenshots, write copy, create privacy policy site |
| **Week 4** | Submit to Apple + Google, respond to review feedback |
| **Week 5+** | Iterate based on user feedback |

---

## Cost summary

| Item | Cost |
|---|---|
| Apple Developer Program | $99/year |
| Google Play Console | $25 one-time |
| Cloudflare Pages (privacy policy) | $0 |
| Railway/Vercel (web PWA hosting) | $0 |
| App icon (DIY) | $0 |
| Total Year 1 | **~$125** |
| Total Year 2+ | **~$99/year** |

If the app gains users and you want a "we pay for the API" subscription model later, that comes with revenue and you can add it then.

---

## Next concrete step

When you're ready, say the word and I'll:
1. Generate a polished app icon set (1024×1024 + all sizes)
2. Refactor v5 into a Capacitor-ready structure
3. Add the direct-API + Keychain code changes
4. Generate the privacy policy HTML page
5. Walk you through screenshot generation on simulator

We can do this incrementally over a few sessions — no need to do it all at once.
