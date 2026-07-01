# Counter Blox API Integration Plan

## Overview

Integration of Counter Blox Public API with BloxArena matchmaking system to automatically verify match results from Roblox games and sync player statistics.

---

## API Information

### WebSocket API
- **URL:** `ws://mm.counterblox.io/ws`
- **Limitation:** 1 connection per IP address
- **Data Retention:** 30 minutes (in-memory only)

### Game Registration Requirements

Games are automatically registered when:
- Played in **VIP Server**
- Gamemode set to **COMPETITIVE**
- Started with **6+ players**
- Played for **5+ minutes**
- Played for **4+ rounds**

### Available Events

1. **game_added** (auto-subscribed)
   - Fires when new game is registered
   - Provides: `gameid` and `GameData` object

2. **rac_added**
   - Fires when player is banned by anti-cheat
   - Provides: `userid` (Roblox user ID)

---

## Architecture Design

### 1. WebSocket Service (New Worker)

**Location:** `worker/src/services/counterblox-ws.js`

**Responsibilities:**
- Maintain persistent WebSocket connection to Counter Blox API
- Subscribe to `game_added` and `rac_added` events
- Parse incoming game data
- Match Roblox games to Discord matches
- Update match results in Supabase

**Connection Management:**
```javascript
// Reconnection strategy
- Initial connection on worker startup
- Auto-reconnect on disconnect (exponential backoff)
- Heartbeat/ping every 30 seconds
- Log all connection events
```

### 2. Game Verification System

**Matching Strategy:**

```
Discord Match → Roblox Game Verification
1. When /host creates match → Store match metadata
2. Host provides VIP Server link in Discord
3. Players join Roblox VIP server
4. Game completes → Counter Blox API fires game_added
5. Match game_added data to Discord match:
   - Compare player lists (Discord ID → Roblox ID mapping)
   - Verify timing (game started within 10 min of Discord match)
   - Verify player count matches
6. If verified → Auto-update match results
```

**Database Schema Updates:**

```sql
-- New table: roblox_accounts
CREATE TABLE roblox_accounts (
  discord_id TEXT PRIMARY KEY,
  roblox_id BIGINT NOT NULL,
  roblox_username TEXT,
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(roblox_id)
);

-- New table: game_verifications
CREATE TABLE game_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id),
  roblox_game_id TEXT NOT NULL,
  game_data JSONB NOT NULL,
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  verification_status TEXT DEFAULT 'pending',
  UNIQUE(roblox_game_id)
);

-- Add to matches table
ALTER TABLE matches ADD COLUMN roblox_game_id TEXT;
ALTER TABLE matches ADD COLUMN vip_server_link TEXT;
ALTER TABLE matches ADD COLUMN auto_verified BOOLEAN DEFAULT FALSE;
```

### 3. Player Linking System

**Discord → Roblox Account Linking:**

New Discord command: `/link <roblox_username>`

**Verification Flow:**
1. User runs `/link fujinkochi`
2. Bot fetches Roblox user ID via Roblox API
3. Bot generates verification code
4. User adds code to Roblox profile description
5. Bot verifies code → Links accounts
6. Stores in `roblox_accounts` table

**Alternative:** OAuth flow via Roblox (if available)

### 4. Data Sync Strategy

**30-Minute Window Challenge:**

Since Counter Blox API only retains data for 30 minutes:

```
Solution: Real-time WebSocket Processing
1. WebSocket receives game_added event
2. Immediately process and store in our database
3. Match to Discord match within 5 minutes
4. If no match found → Store as unmatched game
5. Manual verification available via /verify command
```

**Fallback for Missed Events:**
- Store all game_added events in `game_verifications` table
- Host can manually link via `/verify <game_id>` command
- Admin dashboard to review unmatched games

### 5. RAC Ban Integration

**Auto-ban System:**

```javascript
// When rac_added event received
1. Look up Roblox ID → Discord ID mapping
2. Check if player is in our system
3. If found:
   - Flag account in database
   - Notify admins in Discord
   - Optional: Auto-ban from matchmaking
4. Log all RAC bans for review
```

**Database Schema:**

```sql
-- New table: rac_bans
CREATE TABLE rac_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roblox_id BIGINT NOT NULL,
  discord_id TEXT,
  banned_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed BOOLEAN DEFAULT FALSE,
  action_taken TEXT
);
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1)
- [ ] Create WebSocket service worker
- [ ] Implement connection management
- [ ] Add database schema updates
- [ ] Create `/link` command for account linking
- [ ] Test WebSocket connection and event parsing

### Phase 2: Game Verification (Week 2)
- [ ] Implement game matching algorithm
- [ ] Add VIP server link field to match creation
- [ ] Create auto-verification system
- [ ] Add `/verify` manual verification command
- [ ] Test with real games

### Phase 3: RAC Integration (Week 3)
- [ ] Implement RAC ban detection
- [ ] Add admin notification system
- [ ] Create ban review dashboard
- [ ] Test anti-cheat integration

### Phase 4: Polish & Monitoring (Week 4)
- [ ] Add comprehensive logging
- [ ] Create admin dashboard for unmatched games
- [ ] Implement error handling and retries
- [ ] Add monitoring alerts
- [ ] Documentation and training

---

## Technical Considerations

### 1. WebSocket Reliability

**Challenges:**
- Single connection per IP
- Connection drops
- Rate limiting

**Solutions:**
- Deploy WebSocket service on dedicated IP
- Implement robust reconnection logic
- Queue messages during disconnection
- Monitor connection health

### 2. Player Matching Accuracy

**Challenges:**
- Players may have different usernames
- Not all players may be linked
- Timing mismatches

**Solutions:**
- Require minimum 80% player match rate
- Allow manual verification by host
- Store all game data for review
- Implement fuzzy matching for usernames

### 3. Data Retention

**Challenge:** 30-minute API retention window

**Solutions:**
- Real-time processing (< 1 minute latency)
- Store all events immediately
- Alert on processing delays
- Manual verification fallback

### 4. Security

**Considerations:**
- Validate all incoming WebSocket data
- Prevent spoofed game results
- Secure Roblox account linking
- Rate limit verification attempts

---

## Discord Commands

### New Commands

1. **`/link <roblox_username>`**
   - Links Discord account to Roblox account
   - Requires verification via profile description

2. **`/verify <game_id>`**
   - Manually verify a Roblox game for a Discord match
   - Host-only command

3. **`/unlink`**
   - Unlinks Roblox account from Discord

4. **`/gameinfo <game_id>`**
   - Shows details about a Roblox game
   - Useful for debugging

5. **`/racstatus <@user>`**
   - Check if user has RAC bans
   - Admin-only command

---

## Monitoring & Alerts

### Key Metrics

1. **WebSocket Health**
   - Connection uptime
   - Reconnection frequency
   - Event processing latency

2. **Verification Success Rate**
   - Auto-verified matches %
   - Manual verification needed %
   - Failed verifications

3. **Player Linking**
   - Total linked accounts
   - Verification success rate
   - Unlinked players in matches

### Alerts

- WebSocket disconnected > 5 minutes
- Verification queue > 10 games
- RAC ban detected
- Processing latency > 2 minutes

---

## API Limitations & Workarounds

### Known Limitations

1. **No REST API endpoints found**
   - Only WebSocket available
   - Cannot query historical data
   - Cannot fetch specific game by ID

2. **30-minute data retention**
   - Must process in real-time
   - Cannot retrieve old games
   - No backup/recovery mechanism

3. **Single connection per IP**
   - Cannot scale horizontally easily
   - Single point of failure
   - Must implement robust reconnection

### Workarounds

1. **Store everything locally**
   - Cache all game_added events
   - Build our own historical database
   - Enable manual verification

2. **Implement verification window**
   - Match games within 30 minutes of Discord match
   - Alert host if no game detected
   - Provide manual verification option

3. **Dedicated WebSocket service**
   - Deploy on separate infrastructure
   - Implement health monitoring
   - Auto-restart on failure

---

## Success Criteria

### Must Have
- ✅ WebSocket connection maintained 99%+ uptime
- ✅ Auto-verification for 80%+ of matches
- ✅ RAC ban detection and notification
- ✅ Player account linking system

### Nice to Have
- Admin dashboard for game review
- Historical game statistics
- Player performance analytics from Roblox data
- Integration with existing leaderboard

---

## Next Steps

1. **Immediate:** Research GameData object structure
   - Need to understand what fields are available
   - Contact Counter Blox Discord for API docs
   - Test WebSocket connection to see actual data

2. **Short-term:** Set up development environment
   - Create test VIP server
   - Set up WebSocket test client
   - Capture sample game_added events

3. **Medium-term:** Begin Phase 1 implementation
   - Create WebSocket service
   - Add database migrations
   - Implement `/link` command

---

## Questions for Counter Blox Team

1. What fields are included in the `GameData` object?
2. Is there a REST API for querying games by ID?
3. Can we get player performance stats (K/D, score, etc.)?
4. Is there rate limiting on WebSocket messages?
5. How do we map Roblox user IDs to in-game data?
6. Are there any undocumented endpoints?
7. Can we get historical data beyond 30 minutes?

---

## Resources

- **Documentation:** https://docs.counterblox.io/docs/intro
- **WebSocket URL:** ws://mm.counterblox.io/ws
- **Support:** Counter Blox Discord (#rating-api channel)
- **Headwind Support:** Discord Server

---

*Last Updated: 2026-06-29*
*Status: Planning Phase*
