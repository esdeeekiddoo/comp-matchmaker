# Bloxlink Rate Limit Strategy (2,000 Requests/Day)

## Challenge

Bloxlink API has a **2,000 requests per day** limit. For an active server with 100+ players and multiple matches per day, this requires careful request management.

---

## Request Budget Analysis

### Daily Request Breakdown

**Scenario: 100 active players, 10 matches/day**

| Activity | Requests per Event | Events/Day | Total Requests |
|----------|-------------------|------------|----------------|
| Match creation (10 players) | 10 | 10 matches | 100 |
| Player verification checks | 1 | 50 checks | 50 |
| Manual /verify commands | 1 | 20 commands | 20 |
| Background sync (optional) | 100 | 1 sync | 100 |
| **Total** | | | **270/day** |

**Result:** Well within 2,000 limit with aggressive caching ✅

**Worst Case: 200 players, 20 matches/day**
- Match creation: 200 requests
- Verification checks: 100 requests
- Manual commands: 50 requests
- Background sync: 200 requests
- **Total: 550/day** ✅

---

## Caching Strategy (Critical)

### 1. Long-Term Cache (24 Hours)

**Store in Database:**
```sql
-- roblox_accounts table already has this
CREATE TABLE roblox_accounts (
  discord_id TEXT PRIMARY KEY,
  roblox_id BIGINT NOT NULL UNIQUE,
  roblox_username TEXT NOT NULL,
  source TEXT DEFAULT 'bloxlink',
  bloxlink_synced_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_roblox_accounts_synced ON roblox_accounts(bloxlink_synced_at);
```

**Cache Logic:**
```javascript
async function getPlayerRobloxId(discordId, env, db) {
  // 1. Check database cache (24-hour TTL)
  const cached = await db.getRobloxAccountByDiscordId(discordId);
  const cacheAge = cached ? Date.now() - new Date(cached.bloxlink_synced_at) : Infinity;
  const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  if (cached && cacheAge < CACHE_TTL) {
    console.log(`Cache HIT for ${discordId} (age: ${Math.floor(cacheAge / 1000 / 60)}m)`);
    return cached.roblox_id;
  }

  // 2. Fetch from Bloxlink (counts against rate limit)
  console.log(`Cache MISS for ${discordId} - fetching from Bloxlink`);
  const bloxlink = new BloxlinkAPI(env.BLOXLINK_API_KEY, env.DISCORD_GUILD_ID);
  const mapping = await bloxlink.getDiscordToRoblox(discordId);

  if (mapping) {
    // Update cache
    await db.upsertRobloxAccount({
      discord_id: mapping.discordId,
      roblox_id: mapping.robloxId,
      roblox_username: mapping.robloxUsername,
      source: 'bloxlink',
    });
    return mapping.robloxId;
  }

  // 3. Use stale cache if Bloxlink fails
  if (cached) {
    console.log(`Using stale cache for ${discordId} (age: ${Math.floor(cacheAge / 1000 / 60 / 60)}h)`);
    return cached.roblox_id;
  }

  return null;
}
```

### 2. In-Memory Cache (5 Minutes)

**For high-frequency lookups within same request:**
```javascript
// worker/src/services/bloxlink-cache.js
const memoryCache = new Map();
const MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class BloxlinkCache {
  constructor(bloxlinkAPI, db) {
    this.api = bloxlinkAPI;
    this.db = db;
  }

  async getDiscordToRoblox(discordId) {
    // 1. Check memory cache (5 min)
    const memCached = memoryCache.get(discordId);
    if (memCached && Date.now() - memCached.timestamp < MEMORY_CACHE_TTL) {
      return memCached.data;
    }

    // 2. Check database cache (24 hours)
    const data = await getPlayerRobloxId(discordId, this.api.env, this.db);
    
    // 3. Store in memory cache
    if (data) {
      memoryCache.set(discordId, {
        data: { discordId, robloxId: data },
        timestamp: Date.now(),
      });
    }

    return data ? { discordId, robloxId: data } : null;
  }

  clearMemoryCache() {
    memoryCache.clear();
  }
}
```

---

## Request Optimization Strategies

### 1. Batch Fetching with Smart Caching

**Before (Naive):**
```javascript
// 10 players = 10 API requests
for (const playerId of playerIds) {
  const robloxId = await bloxlink.getDiscordToRoblox(playerId);
}
```

**After (Optimized):**
```javascript
// Check cache first, only fetch uncached
async function batchGetRobloxIds(playerIds, env, db) {
  const results = new Map();
  const uncached = [];

  // 1. Check database cache for all players
  for (const discordId of playerIds) {
    const cached = await db.getRobloxAccountByDiscordId(discordId);
    const cacheAge = cached ? Date.now() - new Date(cached.bloxlink_synced_at) : Infinity;
    
    if (cached && cacheAge < 24 * 60 * 60 * 1000) {
      results.set(discordId, cached.roblox_id);
    } else {
      uncached.push(discordId);
    }
  }

  console.log(`Cache: ${results.size} hits, ${uncached.length} misses`);

  // 2. Fetch only uncached players from Bloxlink
  if (uncached.length > 0) {
    const bloxlink = new BloxlinkAPI(env.BLOXLINK_API_KEY, env.DISCORD_GUILD_ID);
    
    for (const discordId of uncached) {
      const mapping = await bloxlink.getDiscordToRoblox(discordId);
      if (mapping) {
        results.set(discordId, mapping.robloxId);
        await db.upsertRobloxAccount({
          discord_id: mapping.discordId,
          roblox_id: mapping.robloxId,
          roblox_username: mapping.robloxUsername,
          source: 'bloxlink',
        });
      }
      
      // Rate limit: 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}
```

**Result:** 10 players with 80% cache hit rate = **2 API requests** instead of 10 ✅

### 2. Pre-cache on Queue Join

**When player joins queue:**
```javascript
// src/routes/api/queue/join.post.ts
export async function POST({ request }) {
  const session = parseSession(request);
  if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

  // Add to queue
  await db.addToQueue({
    guild_id: GUILD_ID,
    user_id: session.user_id,
    username: session.username,
    avatar_url: session.avatar_url,
  });

  // Pre-cache Bloxlink data (async, don't wait)
  preCacheBloxlinkData(session.user_id).catch(err => 
    console.error('Pre-cache failed:', err)
  );

  return json({ success: true });
}

async function preCacheBloxlinkData(discordId) {
  const cached = await db.getRobloxAccountByDiscordId(discordId);
  const cacheAge = cached ? Date.now() - new Date(cached.bloxlink_synced_at) : Infinity;
  
  // Only fetch if cache is old or missing
  if (!cached || cacheAge > 24 * 60 * 60 * 1000) {
    const bloxlink = new BloxlinkAPI(env.BLOXLINK_API_KEY, env.DISCORD_GUILD_ID);
    const mapping = await bloxlink.getDiscordToRoblox(discordId);
    
    if (mapping) {
      await db.upsertRobloxAccount({
        discord_id: mapping.discordId,
        roblox_id: mapping.robloxId,
        roblox_username: mapping.robloxUsername,
        source: 'bloxlink',
      });
    }
  }
}
```

**Result:** By the time `/host` is called, all players are already cached ✅

### 3. Disable Background Sync

**Remove daily sync job:**
```javascript
// DON'T DO THIS with 2k limit:
// export async function syncBloxlinkDaily(env, db) {
//   const players = await db.getAllPlayers(); // 200 players
//   for (const player of players) {
//     await bloxlink.getDiscordToRoblox(player.discord_id); // 200 requests!
//   }
// }
```

**Instead: On-demand sync only:**
- Pre-cache when joining queue
- Fetch on match creation (with cache)
- Manual `/verify` command (1 request)

---

## Rate Limit Tracking

### 1. Request Counter

**Store in database:**
```sql
CREATE TABLE bloxlink_rate_limit (
  date DATE PRIMARY KEY,
  request_count INTEGER DEFAULT 0,
  last_reset TIMESTAMPTZ DEFAULT NOW()
);
```

**Track requests:**
```javascript
async function trackBloxlinkRequest(db) {
  const today = new Date().toISOString().split('T')[0];
  
  await db.query(`
    INSERT INTO bloxlink_rate_limit (date, request_count)
    VALUES ($1, 1)
    ON CONFLICT (date)
    DO UPDATE SET request_count = bloxlink_rate_limit.request_count + 1
  `, [today]);
}

async function getRequestCount(db) {
  const today = new Date().toISOString().split('T')[0];
  const result = await db.query(`
    SELECT request_count FROM bloxlink_rate_limit WHERE date = $1
  `, [today]);
  
  return result.rows[0]?.request_count || 0;
}
```

### 2. Rate Limit Guard

**Prevent exceeding limit:**
```javascript
async function safeBloxlinkFetch(bloxlink, discordId, db) {
  const count = await getRequestCount(db);
  const DAILY_LIMIT = 2000;
  const SAFETY_BUFFER = 100; // Keep 100 requests as buffer

  if (count >= DAILY_LIMIT - SAFETY_BUFFER) {
    console.warn(`Bloxlink rate limit approaching: ${count}/${DAILY_LIMIT}`);
    return null; // Use cache only
  }

  try {
    const result = await bloxlink.getDiscordToRoblox(discordId);
    await trackBloxlinkRequest(db);
    return result;
  } catch (err) {
    console.error('Bloxlink API error:', err);
    return null;
  }
}
```

### 3. Admin Dashboard

**Show rate limit status:**
```javascript
// New command: /bloxlinkstats (admin only)
export const bloxlinkStatsCommand = {
  name: 'bloxlinkstats',
  description: 'View Bloxlink API usage (Admin only)',
};

async function handleBloxlinkStats(interaction, db) {
  const count = await getRequestCount(db);
  const limit = 2000;
  const percentage = ((count / limit) * 100).toFixed(1);

  const embed = {
    color: count > 1800 ? 0xED4245 : 0x57F287, // Red if >90%, green otherwise
    title: '📊 Bloxlink API Usage',
    fields: [
      { name: 'Today\'s Requests', value: `${count} / ${limit}`, inline: true },
      { name: 'Usage', value: `${percentage}%`, inline: true },
      { name: 'Remaining', value: `${limit - count}`, inline: true },
    ],
    footer: { text: 'Resets daily at midnight UTC' },
  };

  return { embeds: [embed] };
}
```

---

## Fallback Strategies

### 1. Graceful Degradation

**When rate limit is reached:**
```javascript
async function getPlayerRobloxIdWithFallback(discordId, env, db) {
  const count = await getRequestCount(db);
  
  if (count >= 1900) {
    // Use cache only, even if stale
    const cached = await db.getRobloxAccountByDiscordId(discordId);
    if (cached) {
      console.log(`Rate limit reached - using stale cache for ${discordId}`);
      return cached.roblox_id;
    }
    
    // No cache available
    console.warn(`Rate limit reached - no cache for ${discordId}`);
    return null;
  }

  // Normal flow with fresh fetch
  return await getPlayerRobloxId(discordId, env, db);
}
```

### 2. Manual Verification Fallback

**If Bloxlink unavailable:**
```javascript
// Allow host to manually enter Roblox IDs
export const manualLinkCommand = {
  name: 'manuallink',
  description: 'Manually link Discord to Roblox (Host only)',
  options: [
    { name: 'user', type: 6, required: true },
    { name: 'roblox_id', type: 4, required: true },
  ],
};

async function handleManualLink(interaction, db) {
  // Check host role
  if (!interaction.member.roles.includes(env.HOST_ROLE_ID)) {
    return reply('Only hosts can use this command.', true);
  }

  const discordId = interaction.data.options[0].value;
  const robloxId = interaction.data.options[1].value;

  // Verify Roblox ID exists
  const robloxUser = await getRobloxUserById(robloxId);
  if (!robloxUser) {
    return reply('Invalid Roblox ID.', true);
  }

  // Store manual link
  await db.upsertRobloxAccount({
    discord_id: discordId,
    roblox_id: robloxId,
    roblox_username: robloxUser.name,
    source: 'manual',
  });

  return reply(
    `✅ Manually linked <@${discordId}> to ${robloxUser.name} (${robloxId})`,
    false
  );
}
```

---

## Monitoring & Alerts

### 1. Daily Usage Report

**Send to admin channel:**
```javascript
// Cron job: Daily at 11:59 PM UTC
export async function sendDailyUsageReport(env, db) {
  const count = await getRequestCount(db);
  const limit = 2000;
  const percentage = ((count / limit) * 100).toFixed(1);

  const embed = {
    color: count > 1800 ? 0xED4245 : 0x57F287,
    title: '📊 Daily Bloxlink API Usage Report',
    fields: [
      { name: 'Requests Used', value: `${count} / ${limit}`, inline: true },
      { name: 'Usage', value: `${percentage}%`, inline: true },
    ],
    footer: { text: 'Resets in 1 hour' },
  };

  await Discord.sendMessage(env.ADMIN_CHANNEL_ID, '', { embeds: [embed] });
}
```

### 2. Threshold Alerts

**Alert when approaching limit:**
```javascript
async function checkRateLimitThreshold(db, env) {
  const count = await getRequestCount(db);
  const thresholds = [1500, 1800, 1900, 1950];

  for (const threshold of thresholds) {
    const alerted = await db.getAlertSent(threshold);
    
    if (count >= threshold && !alerted) {
      await Discord.sendMessage(
        env.ADMIN_CHANNEL_ID,
        `⚠️ **Bloxlink Rate Limit Alert**\n\nUsage: ${count}/2000 (${((count/2000)*100).toFixed(1)}%)\n\nConsider reducing API calls or upgrading Bloxlink plan.`
      );
      await db.markAlertSent(threshold);
    }
  }
}
```

---

## Best Practices Summary

### ✅ DO

1. **Cache aggressively** (24-hour TTL minimum)
2. **Pre-cache on queue join** (async, non-blocking)
3. **Check cache before every API call**
4. **Track request count** in database
5. **Use stale cache** when rate limit reached
6. **Monitor usage daily**
7. **Set up alerts** at 75%, 90%, 95%

### ❌ DON'T

1. **Don't run background sync jobs** (wastes requests)
2. **Don't fetch on every command** (use cache)
3. **Don't ignore rate limits** (will break system)
4. **Don't fetch without checking cache first**
5. **Don't fetch for display purposes** (cache is enough)

---

## Expected Request Usage

### Conservative Estimate (100 players, 10 matches/day)

| Activity | Requests/Day | Notes |
|----------|--------------|-------|
| Match creation | 20 | 80% cache hit rate (10 matches × 10 players × 20% miss) |
| Queue pre-cache | 30 | Only uncached players |
| Manual /verify | 20 | User-initiated |
| **Total** | **70/day** | **3.5% of limit** ✅ |

### Aggressive Estimate (200 players, 20 matches/day)

| Activity | Requests/Day | Notes |
|----------|--------------|-------|
| Match creation | 80 | 80% cache hit rate (20 matches × 10 players × 40% miss) |
| Queue pre-cache | 100 | More new players |
| Manual /verify | 50 | More activity |
| **Total** | **230/day** | **11.5% of limit** ✅ |

### Worst Case (500 players, 50 matches/day, cold cache)

| Activity | Requests/Day | Notes |
|----------|--------------|-------|
| Match creation | 250 | 50% cache hit rate |
| Queue pre-cache | 300 | Many new players |
| Manual /verify | 100 | High activity |
| **Total** | **650/day** | **32.5% of limit** ✅ |

**Conclusion:** With proper caching, 2,000 requests/day is sufficient for even large servers ✅

---

## Upgrade Path (If Needed)

If you consistently hit rate limits:

1. **Bloxlink Premium:** Higher rate limits
2. **Custom /link system:** Fallback for rate-limited users
3. **Hybrid approach:** Bloxlink primary, custom /link backup
4. **Longer cache TTL:** 48-hour or 7-day cache

---

*Last Updated: 2026-06-29*
*Status: Optimized for 2,000 requests/day limit*
