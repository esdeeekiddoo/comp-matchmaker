# Nickname-Based Roblox ID Matching Strategy

## Overview

Instead of using Bloxlink API, match Roblox IDs directly from Discord server nicknames. This assumes all players have their server nickname set to their Roblox ID.

---

## Advantages

✅ **Zero API calls** - No rate limits, no external dependencies
✅ **Instant matching** - No cache needed, direct lookup
✅ **Simple implementation** - Just parse nickname as integer
✅ **No verification flow** - Players just set nickname
✅ **Free** - No API costs

## Disadvantages

⚠️ **Manual enforcement** - Players must set nickname correctly
⚠️ **Easy to spoof** - Anyone can set any Roblox ID
⚠️ **No validation** - Can't verify ownership of Roblox account
⚠️ **Nickname changes** - Players can change anytime
⚠️ **Admin overhead** - Need to enforce nickname policy

---

## Implementation

### 1. Extract Roblox ID from Nickname

**Discord Member Object:**
```javascript
{
  user: {
    id: "123456789012345678",
    username: "fujinkochi",
    discriminator: "1234"
  },
  nick: "987654321", // Server nickname = Roblox ID
  roles: ["role1", "role2"]
}
```

**Extraction Function:**
```javascript
function getRobloxIdFromNickname(member) {
  // Try nickname first (server-specific)
  if (member.nick) {
    const robloxId = parseInt(member.nick.trim());
    if (!isNaN(robloxId) && robloxId > 0) {
      return robloxId;
    }
  }
  
  // Fallback: Try username (global)
  const robloxId = parseInt(member.user.username.trim());
  if (!isNaN(robloxId) && robloxId > 0) {
    return robloxId;
  }
  
  return null;
}
```

### 2. Validate Roblox ID

**Check if ID exists on Roblox:**
```javascript
async function validateRobloxId(robloxId) {
  try {
    const response = await fetch(
      `https://users.roblox.com/v1/users/${robloxId}`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      id: data.id,
      username: data.name,
      displayName: data.displayName,
      created: data.created,
      isBanned: data.isBanned,
    };
  } catch (err) {
    console.error('Failed to validate Roblox ID:', err);
    return null;
  }
}
```

### 3. Match Creation Flow

**Updated `/host` command:**
```javascript
async function createMatch(interaction, env, db, vars, playerIds, region, isTest) {
  // ... existing code ...

  // Extract Roblox IDs from nicknames
  const robloxMappings = [];
  const invalidNicknames = [];

  for (const discordId of playerIds) {
    const member = await Discord.getGuildMember(interaction.guild_id, discordId);
    const robloxId = getRobloxIdFromNickname(member);
    
    if (robloxId) {
      // Optional: Validate Roblox ID exists
      const robloxUser = await validateRobloxId(robloxId);
      if (robloxUser) {
        robloxMappings.push({
          discordId,
          robloxId,
          robloxUsername: robloxUser.username,
        });
        
        // Store in database for future use
        await db.upsertRobloxAccount({
          discord_id: discordId,
          roblox_id: robloxId,
          roblox_username: robloxUser.username,
          source: 'nickname',
        });
      } else {
        invalidNicknames.push({ discordId, nickname: member.nick });
      }
    } else {
      invalidNicknames.push({ discordId, nickname: member.nick || member.user.username });
    }
  }

  // Warn about invalid nicknames
  if (invalidNicknames.length > 0) {
    const warnings = invalidNicknames.map(
      ({ discordId, nickname }) => `<@${discordId}> (nickname: "${nickname}")`
    ).join('\n');
    
    await Discord.sendMessage(
      hostChannel.id,
      `⚠️ **Warning:** The following players have invalid nicknames (must be Roblox ID):\n${warnings}\n\nTheir stats will not be tracked. Please set server nickname to your Roblox ID.`
    );
  }

  // ... rest of existing code ...
}
```

### 4. Counter Blox WebSocket Integration

**Match Roblox IDs from game to Discord:**
```javascript
async function handleGameAdded(gameData, env, db) {
  // Extract Roblox IDs from game data
  const robloxIds = gameData.players.map(p => p.userid);

  // Look up Discord IDs from database (cached from match creation)
  const playerStats = [];
  
  for (const player of gameData.players) {
    const discordId = await db.getDiscordIdByRobloxId(player.userid);
    
    playerStats.push({
      robloxId: player.userid,
      discordId, // May be null if not found
      kills: player.kills,
      deaths: player.deaths,
      headshots: player.headshots,
      score: player.score,
      team: player.team,
    });
  }

  // Find matching Discord match
  const match = await findMatchingDiscordMatch(playerStats, gameData, db);

  if (match) {
    await processMatchStats(match.id, playerStats, gameData.winner, db);
  } else {
    await db.createUnmatchedGame({
      roblox_game_id: gameData.gameid,
      game_data: gameData,
      player_stats: playerStats,
    });
  }
}
```

---

## Nickname Enforcement

### 1. Auto-Rename on Join

**Welcome message with instructions:**
```javascript
// events/guildMemberAdd.js
export async function handleMemberJoin(member, env) {
  const welcomeChannel = env.WELCOME_CHANNEL_ID;
  
  const embed = {
    color: 0x5865F2,
    title: '👋 Welcome to CAPL!',
    description: `Welcome <@${member.user.id}>!`,
    fields: [
      {
        name: '📝 Set Your Nickname',
        value: [
          '1. Right-click your name in the member list',
          '2. Click "Edit Server Profile"',
          '3. Set your nickname to your **Roblox User ID**',
          '4. Find your ID at: https://www.roblox.com/users/profile',
        ].join('\n'),
      },
      {
        name: '🎮 Join Matchmaking',
        value: 'Once your nickname is set, you can join the queue!',
      },
    ],
    footer: { text: 'Stats tracking requires correct Roblox ID nickname' },
  };

  await Discord.sendMessage(welcomeChannel, '', { embeds: [embed] });
}
```

### 2. Bloxlink Auto-Configuration

**Bloxlink handles verification automatically:**

When users run Bloxlink's `/verify` command:
1. ✅ Bloxlink verifies Roblox account ownership
2. ✅ Bloxlink auto-sets server nickname to Roblox ID
3. ✅ Bloxlink auto-assigns "Verified" role
4. ✅ Our bot reads nickname directly (guaranteed to be Roblox ID)

**No custom commands needed!** Bloxlink does all the work.

**Configuration in Bloxlink:**
```
/bloxlink settings
- Set nickname format to: {roblox-id}
- Set verified role to: @Verified
- Enable auto-update nicknames: Yes
```

---

## Database Schema

**Same as Bloxlink integration:**
```sql
CREATE TABLE roblox_accounts (
  discord_id TEXT PRIMARY KEY,
  roblox_id BIGINT NOT NULL UNIQUE,
  roblox_username TEXT NOT NULL,
  source TEXT DEFAULT 'nickname', -- 'nickname', 'bloxlink', or 'manual'
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_roblox_accounts_roblox_id ON roblox_accounts(roblox_id);
```

---

## Hybrid Approach (Recommended)

**Use both nickname and Bloxlink:**

```javascript
async function getPlayerRobloxId(discordId, guildId, env, db) {
  // 1. Check database cache first
  const cached = await db.getRobloxAccountByDiscordId(discordId);
  if (cached) {
    return cached.roblox_id;
  }

  // 2. Try nickname (instant, no API call)
  const member = await Discord.getGuildMember(guildId, discordId);
  const nicknameId = getRobloxIdFromNickname(member);
  
  if (nicknameId) {
    // Validate and store
    const robloxUser = await validateRobloxId(nicknameId);
    if (robloxUser) {
      await db.upsertRobloxAccount({
        discord_id: discordId,
        roblox_id: nicknameId,
        roblox_username: robloxUser.username,
        source: 'nickname',
      });
      return nicknameId;
    }
  }

  // 3. Fallback to Bloxlink (if available)
  if (env.BLOXLINK_API_KEY) {
    const bloxlink = new BloxlinkAPI(env.BLOXLINK_API_KEY, guildId);
    const mapping = await bloxlink.getDiscordToRoblox(discordId);
    
    if (mapping) {
      await db.upsertRobloxAccount({
        discord_id: mapping.discordId,
        roblox_id: mapping.robloxId,
        roblox_username: mapping.robloxUsername,
        source: 'bloxlink',
      });
      return mapping.robloxId;
    }
  }

  return null;
}
```

---

## Nickname Policy Enforcement

### Server Rules

**Add to server rules:**
```
📝 Nickname Policy

All members must set their server nickname to their Roblox User ID.

How to find your Roblox ID:
1. Go to https://www.roblox.com/users/profile
2. Look at the URL: roblox.com/users/[YOUR_ID]/profile
3. Copy the number (e.g., 123456789)

How to set your nickname:
1. Right-click your name in the member list
2. Click "Edit Server Profile"
3. Set nickname to your Roblox ID
4. Click "Save"

Why? This allows us to track your stats from Counter-Blox matches!

Use /checknickname to verify your nickname is correct.
```

### Auto-Moderation

**Kick/warn users with invalid nicknames:**
```javascript
// Cron job: Daily check
export async function enforceNicknamePolicy(env, db) {
  const members = await Discord.listGuildMembers(env.DISCORD_GUILD_ID);
  const warnings = [];

  for (const member of members) {
    // Skip bots and admins
    if (member.user.bot || member.roles.includes(env.ADMIN_ROLE_ID)) {
      continue;
    }

    const robloxId = getRobloxIdFromNickname(member);
    
    if (!robloxId) {
      // Send DM warning
      await Discord.sendDM(
        member.user.id,
        `⚠️ **Nickname Policy Violation**\n\nYour server nickname must be set to your Roblox User ID.\n\nPlease update your nickname within 24 hours or you may be removed from the server.\n\nUse /checknickname to verify.`
      );
      
      warnings.push(member.user.id);
    }
  }

  // Log to admin channel
  if (warnings.length > 0) {
    await Discord.sendMessage(
      env.ADMIN_CHANNEL_ID,
      `⚠️ **Nickname Policy Warnings Sent**\n\n${warnings.length} members have invalid nicknames and have been warned.`
    );
  }
}
```

---

## Comparison: Nickname vs Bloxlink

| Feature | Nickname | Bloxlink | Hybrid |
|---------|----------|----------|--------|
| **API Calls** | 0 | 2k/day limit | Minimal |
| **Verification** | Manual | Automatic | Best of both |
| **Reliability** | Low | High | High |
| **Setup** | Simple | Moderate | Moderate |
| **Spoofing Risk** | High | Low | Low |
| **Admin Overhead** | High | Low | Low |
| **Cost** | Free | Free (2k limit) | Free |

**Recommendation:** Use **Hybrid approach** for best results:
- Primary: Nickname (instant, no API calls)
- Fallback: Bloxlink (verified, trusted)
- Cache: Database (24-hour TTL)

---

## Implementation Steps

### Phase 1: Bloxlink Setup (Simplest)
1. Configure Bloxlink nickname format: `{roblox-id}`
2. Configure Bloxlink verified role: `@Verified`
3. Update `/host` to extract Roblox IDs from nicknames
4. Add validation on match creation
5. Update welcome message: "Run `/verify` to get started"

### Phase 2: Database Integration
1. Store Roblox ID mappings on match creation
2. Cache all results in database
3. Use cached data for WebSocket matching

### Phase 3: Optional Enhancements
1. Add Bloxlink API fallback (if needed)
2. Set up monitoring for unverified players
3. Add stats to profile pages

---

## Testing Checklist

- [ ] Bloxlink configured with `{roblox-id}` nickname format
- [ ] Bloxlink assigns "Verified" role after `/verify`
- [ ] Extract Roblox ID from nickname in `/host`
- [ ] Validate Roblox ID exists (Roblox API)
- [ ] Store mapping in database on match creation
- [ ] Match creation with nickname IDs works
- [ ] WebSocket matching with cached IDs works
- [ ] Invalid nickname warnings shown in match channel
- [ ] Database cache prevents duplicate API calls
- [ ] Optional: Bloxlink API fallback works

---

*Last Updated: 2026-06-29*
*Status: Nickname-based matching strategy*
