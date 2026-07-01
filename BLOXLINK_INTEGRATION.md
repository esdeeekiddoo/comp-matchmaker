# Bloxlink Integration Guide

## Overview

Integration with Bloxlink bot to automatically fetch Discord ↔ Roblox account mappings, eliminating the need for custom verification.

---

## What is Bloxlink?

**Bloxlink** is a popular Discord bot that verifies Roblox accounts and manages server nicknames. It has already verified millions of Discord ↔ Roblox account links.

- **Bot Invite:** https://blox.link/
- **API Documentation:** https://blox.link/developers
- **Support Server:** https://discord.gg/bloxlink

---

## Why Use Bloxlink?

### Advantages
✅ **No custom verification needed** - Players already verified via Bloxlink
✅ **Trusted by millions** - Industry-standard verification
✅ **Automatic updates** - Bloxlink handles username changes
✅ **Zero maintenance** - No verification code system to maintain
✅ **Instant setup** - Just add Bloxlink to server

### Requirements
- Bloxlink bot must be in your Discord server
- Players must verify with Bloxlink (one-time setup)
- Bloxlink API key (free for basic usage)

---

## Setup Instructions

### Step 1: Add Bloxlink to Server

1. Go to https://blox.link/
2. Click "Add to Discord"
3. Select your server
4. Grant required permissions

### Step 2: Get Bloxlink API Key

1. Join Bloxlink Support Server: https://discord.gg/bloxlink
2. Run `/api` command in support server
3. Copy your API key
4. Store as environment variable: `BLOXLINK_API_KEY`

### Step 3: Configure Cloudflare Worker

```bash
cd worker
npx wrangler secret put BLOXLINK_API_KEY
# Paste your API key when prompted
```

### Step 4: Test Integration

```bash
# In your Discord server
/verify @user
# Bot will fetch Roblox account from Bloxlink
```

---

## Bloxlink API Integration

### API Endpoint

```
GET https://api.blox.link/v4/public/guilds/{guild_id}/discord-to-roblox/{discord_id}
Authorization: {api_key}
```

### Response Format

**Success (200):**
```json
{
  "success": true,
  "user": {
    "robloxId": "123456789",
    "primaryAccount": "123456789",
    "matchingAccount": "123456789"
  },
  "robloxUsername": "fujinkochi",
  "resolved": {
    "roblox": {
      "id": 123456789,
      "username": "fujinkochi",
      "displayName": "Fujin",
      "description": "Counter-Blox player",
      "created": "2020-01-01T00:00:00.000Z",
      "badges": [],
      "avatar": {
        "bust": "https://...",
        "headshot": "https://...",
        "fullBody": "https://..."
      }
    }
  }
}
```

**Not Found (404):**
```json
{
  "success": false,
  "error": "This user is not verified with Bloxlink."
}
```

---

## Implementation

### 1. Bloxlink API Client

**File:** `worker/src/services/bloxlink.js`

```javascript
export class BloxlinkAPI {
  constructor(apiKey, guildId) {
    this.apiKey = apiKey;
    this.guildId = guildId;
    this.baseUrl = 'https://api.blox.link/v4/public';
  }

  async getDiscordToRoblox(discordId) {
    const url = `${this.baseUrl}/guilds/${this.guildId}/discord-to-roblox/${discordId}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': this.apiKey,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // User not verified
      }
      throw new Error(`Bloxlink API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      return null;
    }

    return {
      discordId,
      robloxId: parseInt(data.user.robloxId),
      robloxUsername: data.robloxUsername,
      displayName: data.resolved?.roblox?.displayName,
      avatar: data.resolved?.roblox?.avatar?.headshot,
    };
  }

  async getRobloxToDiscord(robloxId) {
    const url = `${this.baseUrl}/guilds/${this.guildId}/roblox-to-discord/${robloxId}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': this.apiKey,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Bloxlink API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success || !data.discordIDs || data.discordIDs.length === 0) {
      return null;
    }

    return {
      robloxId: parseInt(robloxId),
      discordIds: data.discordIDs,
      primaryDiscordId: data.discordIDs[0],
    };
  }

  async bulkGetDiscordToRoblox(discordIds) {
    const results = await Promise.allSettled(
      discordIds.map(id => this.getDiscordToRoblox(id))
    );

    return results
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value);
  }
}
```

### 2. Cache Layer (Optional but Recommended)

**File:** `worker/src/services/bloxlink-cache.js`

```javascript
// Cache Bloxlink responses to reduce API calls
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class BloxlinkCache {
  constructor(bloxlinkAPI) {
    this.api = bloxlinkAPI;
  }

  async getDiscordToRoblox(discordId) {
    const cacheKey = `d2r:${discordId}`;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const data = await this.api.getDiscordToRoblox(discordId);
    
    cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });

    return data;
  }

  async getRobloxToDiscord(robloxId) {
    const cacheKey = `r2d:${robloxId}`;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const data = await this.api.getRobloxToDiscord(robloxId);
    
    cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });

    return data;
  }

  clearCache() {
    cache.clear();
  }
}
```

### 3. Integration with Match System

**File:** `worker/src/commands/host.js` (updated)

```javascript
import { BloxlinkAPI } from '../services/bloxlink.js';

async function createMatch(interaction, env, db, vars, playerIds, region, isTest) {
  // ... existing code ...

  // Fetch Roblox IDs for all players
  const bloxlink = new BloxlinkAPI(env.BLOXLINK_API_KEY, interaction.guild_id);
  const robloxMappings = await bloxlink.bulkGetDiscordToRoblox(playerIds);

  // Store mappings in database for later use
  for (const mapping of robloxMappings) {
    await db.upsertRobloxAccount({
      discord_id: mapping.discordId,
      roblox_id: mapping.robloxId,
      roblox_username: mapping.robloxUsername,
      source: 'bloxlink',
    });
  }

  // Warn about unverified players
  const unverified = playerIds.filter(
    id => !robloxMappings.find(m => m.discordId === id)
  );

  if (unverified.length > 0) {
    const unverifiedTags = unverified.map(id => `<@${id}>`).join(', ');
    await Discord.sendMessage(
      hostChannel.id,
      `⚠️ **Warning:** The following players are not verified with Bloxlink and their stats will not be tracked:\n${unverifiedTags}\n\nThey can verify by running \`!verify\` in <#${vars.verifyChannelId}>`
    );
  }

  // ... rest of existing code ...
}
```

### 4. Counter Blox WebSocket Integration

**File:** `worker/src/services/counterblox-ws.js`

```javascript
import { BloxlinkAPI } from './bloxlink.js';

async function handleGameAdded(gameData, env, db) {
  const guildId = env.DISCORD_GUILD_ID;
  const bloxlink = new BloxlinkAPI(env.BLOXLINK_API_KEY, guildId);

  // Extract Roblox IDs from game data
  const robloxIds = gameData.players.map(p => p.userid);

  // Fetch Discord IDs from Bloxlink
  const discordMappings = await Promise.allSettled(
    robloxIds.map(async (robloxId) => {
      const mapping = await bloxlink.getRobloxToDiscord(robloxId);
      return mapping ? mapping.primaryDiscordId : null;
    })
  );

  // Build player stats with Discord IDs
  const playerStats = gameData.players.map((player, i) => {
    const result = discordMappings[i];
    const discordId = result.status === 'fulfilled' ? result.value : null;

    return {
      robloxId: player.userid,
      discordId,
      kills: player.kills,
      deaths: player.deaths,
      headshots: player.headshots,
      score: player.score,
      team: player.team,
    };
  });

  // Find matching Discord match
  const match = await findMatchingDiscordMatch(playerStats, gameData, db);

  if (match) {
    // Store stats and calculate ELO
    await processMatchStats(match.id, playerStats, gameData.winner, db);
  } else {
    // Store as unmatched game for manual verification
    await db.createUnmatchedGame({
      roblox_game_id: gameData.gameid,
      game_data: gameData,
      player_stats: playerStats,
    });
  }
}
```

---

## Database Schema Updates

### Table: `roblox_accounts`

```sql
-- Add source column to track where mapping came from
ALTER TABLE roblox_accounts ADD COLUMN source TEXT DEFAULT 'bloxlink';
ALTER TABLE roblox_accounts ADD COLUMN bloxlink_synced_at TIMESTAMPTZ;

-- Update constraint to allow updates
ALTER TABLE roblox_accounts DROP CONSTRAINT IF EXISTS roblox_accounts_roblox_id_key;
CREATE UNIQUE INDEX idx_roblox_accounts_roblox_id ON roblox_accounts(roblox_id);
```

### Supabase Functions

```javascript
// worker/src/supabaseApi.js

async upsertRobloxAccount(data) {
  const { error } = await this.supabase
    .from('roblox_accounts')
    .upsert({
      discord_id: data.discord_id,
      roblox_id: data.roblox_id,
      roblox_username: data.roblox_username,
      source: data.source || 'bloxlink',
      bloxlink_synced_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    }, {
      onConflict: 'discord_id',
    });

  if (error) throw error;
}

async getRobloxAccountByDiscordId(discordId) {
  const { data, error } = await this.supabase
    .from('roblox_accounts')
    .select('*')
    .eq('discord_id', discordId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async getDiscordIdByRobloxId(robloxId) {
  const { data, error } = await this.supabase
    .from('roblox_accounts')
    .select('discord_id')
    .eq('roblox_id', robloxId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data?.discord_id || null;
}
```

---

## Discord Commands

### `/verify` - Check Bloxlink Status

```javascript
export const verifyCommand = {
  name: 'verify',
  description: 'Check Bloxlink verification status',
  options: [
    {
      name: 'user',
      description: 'User to check (defaults to yourself)',
      type: 6, // USER
      required: false,
    },
  ],
};

async function handleVerify(interaction, env, db) {
  const targetUser = interaction.data.options?.[0]?.value || interaction.user.id;
  const bloxlink = new BloxlinkAPI(env.BLOXLINK_API_KEY, interaction.guild_id);

  const mapping = await bloxlink.getDiscordToRoblox(targetUser);

  if (!mapping) {
    return reply(
      targetUser === interaction.user.id
        ? '❌ You are not verified with Bloxlink.\n\nRun `!verify` in <#verify-channel> to link your Roblox account.'
        : '❌ This user is not verified with Bloxlink.',
      true
    );
  }

  // Store in database
  await db.upsertRobloxAccount({
    discord_id: mapping.discordId,
    roblox_id: mapping.robloxId,
    roblox_username: mapping.robloxUsername,
    source: 'bloxlink',
  });

  const embed = {
    color: 0x57F287, // Green
    title: '✅ Bloxlink Verification Status',
    thumbnail: { url: mapping.avatar },
    fields: [
      { name: 'Discord', value: `<@${mapping.discordId}>`, inline: true },
      { name: 'Roblox', value: `${mapping.robloxUsername} (${mapping.robloxId})`, inline: true },
    ],
    description: 'Stats will be automatically tracked from Counter-Blox matches!',
  };

  return { embeds: [embed] };
}
```

### `/syncbloxlink` - Bulk Sync (Admin Only)

```javascript
export const syncBloxlinkCommand = {
  name: 'syncbloxlink',
  description: 'Sync all server members with Bloxlink (Admin only)',
};

async function handleSyncBloxlink(interaction, env, db) {
  // Check admin permission
  if (!interaction.member.roles.includes(env.ADMIN_ROLE_ID)) {
    return reply('You need admin permissions to use this command.', true);
  }

  await reply('🔄 Syncing Bloxlink data for all members... This may take a while.', false);

  const bloxlink = new BloxlinkAPI(env.BLOXLINK_API_KEY, interaction.guild_id);

  // Get all players from database
  const players = await db.getAllPlayers();
  const discordIds = players.map(p => p.discord_id);

  let synced = 0;
  let failed = 0;

  for (const discordId of discordIds) {
    try {
      const mapping = await bloxlink.getDiscordToRoblox(discordId);
      if (mapping) {
        await db.upsertRobloxAccount({
          discord_id: mapping.discordId,
          roblox_id: mapping.robloxId,
          roblox_username: mapping.robloxUsername,
          source: 'bloxlink',
        });
        synced++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error(`Failed to sync ${discordId}:`, err);
      failed++;
    }

    // Rate limit: 1 request per 100ms
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  await editInteraction(
    env,
    interaction,
    `✅ Sync complete!\n\n**Synced:** ${synced}\n**Not verified:** ${failed}`
  );
}
```

---

## Player Onboarding Flow

### New Player Joins Server

1. **Welcome Message:**
```
Welcome to CAPL! 🎮

To participate in ranked matches, you need to verify your Roblox account:

1. Go to <#verify-channel>
2. Run `!verify` and follow Bloxlink's instructions
3. Once verified, you're ready to queue!

Run `/verify` anytime to check your verification status.
```

2. **Auto-verify on First Match:**
When player joins queue, bot automatically checks Bloxlink and stores mapping.

3. **Unverified Warning:**
If player is not verified, show warning in match channel:
```
⚠️ @Player is not verified with Bloxlink!
Stats will not be tracked for this player.
Run `!verify` in <#verify-channel> to link your account.
```

---

## Error Handling

### Bloxlink API Errors

```javascript
async function safeBloxlinkFetch(bloxlink, discordId) {
  try {
    return await bloxlink.getDiscordToRoblox(discordId);
  } catch (err) {
    if (err.message.includes('429')) {
      // Rate limited - wait and retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await bloxlink.getDiscordToRoblox(discordId);
    }
    
    if (err.message.includes('401')) {
      // Invalid API key
      console.error('Invalid Bloxlink API key!');
      return null;
    }
    
    // Other errors - log and continue
    console.error('Bloxlink API error:', err);
    return null;
  }
}
```

### Fallback Strategy

```javascript
async function getPlayerRobloxId(discordId, env, db) {
  // 1. Check database cache first
  const cached = await db.getRobloxAccountByDiscordId(discordId);
  if (cached && Date.now() - new Date(cached.bloxlink_synced_at) < 24 * 60 * 60 * 1000) {
    return cached.roblox_id;
  }

  // 2. Fetch from Bloxlink
  const bloxlink = new BloxlinkAPI(env.BLOXLINK_API_KEY, env.DISCORD_GUILD_ID);
  const mapping = await safeBloxlinkFetch(bloxlink, discordId);
  
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

  // 3. Use cached data even if old
  if (cached) {
    return cached.roblox_id;
  }

  // 4. Player not verified
  return null;
}
```

---

## Rate Limiting

Bloxlink API has rate limits. Implement these strategies:

### 1. Request Batching
```javascript
// Batch requests with delays
async function batchBloxlinkRequests(discordIds, bloxlink) {
  const results = [];
  const batchSize = 10;
  
  for (let i = 0; i < discordIds.length; i += batchSize) {
    const batch = discordIds.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(id => bloxlink.getDiscordToRoblox(id))
    );
    results.push(...batchResults);
    
    // Wait 1 second between batches
    if (i + batchSize < discordIds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}
```

### 2. Caching Strategy
- Cache successful responses for 24 hours
- Cache "not found" responses for 1 hour
- Invalidate cache on manual `/verify` command

### 3. Background Sync
```javascript
// Sync Bloxlink data in background (daily cron job)
export async function syncBloxlinkDaily(env, db) {
  const players = await db.getAllPlayers();
  const bloxlink = new BloxlinkAPI(env.BLOXLINK_API_KEY, env.DISCORD_GUILD_ID);
  
  for (const player of players) {
    try {
      const mapping = await bloxlink.getDiscordToRoblox(player.discord_id);
      if (mapping) {
        await db.upsertRobloxAccount({
          discord_id: mapping.discordId,
          roblox_id: mapping.robloxId,
          roblox_username: mapping.robloxUsername,
          source: 'bloxlink',
        });
      }
      
      // Rate limit: 1 request per 200ms
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (err) {
      console.error(`Failed to sync ${player.discord_id}:`, err);
    }
  }
}
```

---

## Testing Checklist

- [ ] Bloxlink bot added to server
- [ ] API key configured in worker
- [ ] `/verify` command works for verified users
- [ ] `/verify` shows error for unverified users
- [ ] Match creation fetches Roblox IDs
- [ ] Unverified players get warning message
- [ ] Stats auto-populate for verified players
- [ ] Cache reduces API calls
- [ ] Rate limiting prevents errors
- [ ] `/syncbloxlink` command works (admin)
- [ ] Background sync job works

---

## Migration from Custom `/link`

If you previously implemented custom `/link`:

1. Keep `roblox_accounts` table structure
2. Add `source` column to track origin
3. Bloxlink data will coexist with custom links
4. Prioritize Bloxlink data (more trusted)
5. Deprecate custom `/link` command

---

## FAQ

**Q: Do players need to verify with Bloxlink first?**
A: Yes, players must run `!verify` in your server before their stats can be tracked.

**Q: What if Bloxlink is down?**
A: The system uses cached data (24-hour TTL) as fallback. Stats tracking continues with cached mappings.

**Q: Can players change their linked Roblox account?**
A: Yes, they update it through Bloxlink (`!verify` again), and our system syncs automatically.

**Q: Is there a cost for Bloxlink API?**
A: Basic usage is free. High-volume servers may need a premium plan.

**Q: What if a player is not verified?**
A: They can still play matches, but their stats won't be tracked. They'll see a warning message.

**Q: How often does the system sync with Bloxlink?**
A: On-demand (during match creation) + daily background sync + manual `/syncbloxlink` command.

---

*Last Updated: 2026-06-29*
*Status: Design Complete - Ready for Implementation*
