# Performance-Based ELO System Design

## Overview

Enhanced ELO system that rewards individual performance (K/D ratio, headshot %, etc.) in addition to match wins/losses.

---

## ELO Calculation Formula

### Base ELO Change
```
Base ELO = K-factor × (Actual Score - Expected Score)
- K-factor: 32 (current)
- Expected Score: Based on team average ELO difference
```

### Performance Multiplier
```
Final ELO Change = Base ELO × Performance Multiplier

Performance Multiplier = 1.0 + (KD Bonus + HS Bonus + MVP Bonus)

Where:
- KD Bonus: -0.3 to +0.3 (based on K/D ratio)
- HS Bonus: 0 to +0.15 (based on headshot %)
- MVP Bonus: +0.2 (if match MVP)
```

### K/D Ratio Bonus Calculation
```javascript
function calculateKDBonus(kills, deaths) {
  const kd = deaths === 0 ? kills : kills / deaths;
  
  if (kd >= 2.0) return 0.3;      // Exceptional: +30%
  if (kd >= 1.5) return 0.2;      // Great: +20%
  if (kd >= 1.2) return 0.1;      // Good: +10%
  if (kd >= 0.8) return 0;        // Average: 0%
  if (kd >= 0.5) return -0.1;     // Below avg: -10%
  return -0.3;                     // Poor: -30%
}
```

### Headshot % Bonus Calculation
```javascript
function calculateHSBonus(headshots, kills) {
  if (kills === 0) return 0;
  const hsPercent = (headshots / kills) * 100;
  
  if (hsPercent >= 70) return 0.15;  // Elite: +15%
  if (hsPercent >= 50) return 0.10;  // Great: +10%
  if (hsPercent >= 30) return 0.05;  // Good: +5%
  return 0;                          // Below 30%: 0%
}
```

### MVP Determination
```javascript
// MVP = Highest score on winning team
function determineMVP(winningTeam) {
  return winningTeam.reduce((mvp, player) => 
    player.score > mvp.score ? player : mvp
  );
}
```

### Example Calculations

**Scenario 1: Win with great performance**
- Base ELO: +25 (win)
- K/D: 2.5 (15 kills, 6 deaths) → +0.3 bonus
- HS%: 60% (9/15) → +0.10 bonus
- MVP: Yes → +0.2 bonus
- **Multiplier:** 1.0 + 0.3 + 0.10 + 0.2 = **1.6**
- **Final ELO:** +25 × 1.6 = **+40 ELO**

**Scenario 2: Win with poor performance**
- Base ELO: +25 (win)
- K/D: 0.4 (4 kills, 10 deaths) → -0.3 penalty
- HS%: 25% (1/4) → 0 bonus
- MVP: No → 0 bonus
- **Multiplier:** 1.0 - 0.3 = **0.7**
- **Final ELO:** +25 × 0.7 = **+18 ELO**

**Scenario 3: Loss with exceptional performance**
- Base ELO: -20 (loss)
- K/D: 3.0 (18 kills, 6 deaths) → +0.3 bonus
- HS%: 75% (13/18) → +0.15 bonus
- MVP: No (losing team) → 0 bonus
- **Multiplier:** 1.0 + 0.3 + 0.15 = **1.45**
- **Final ELO:** -20 × 1.45 = **-29 ELO** (larger loss, but still loss)

---

## Database Schema Updates

### Players Table - Add Stats Columns
```sql
ALTER TABLE players ADD COLUMN total_kills INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN total_deaths INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN total_headshots INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN total_score INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN mvp_count INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN avg_kd DECIMAL(4,2) DEFAULT 0;
ALTER TABLE players ADD COLUMN avg_hs_percent DECIMAL(5,2) DEFAULT 0;
```

### New Table: Match Player Stats
```sql
CREATE TABLE match_player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL,
  team TEXT NOT NULL, -- 'atk' or 'def'
  kills INTEGER NOT NULL DEFAULT 0,
  deaths INTEGER NOT NULL DEFAULT 0,
  assists INTEGER DEFAULT 0,
  headshots INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  damage_dealt INTEGER DEFAULT 0,
  is_mvp BOOLEAN DEFAULT FALSE,
  kd_ratio DECIMAL(4,2),
  hs_percent DECIMAL(5,2),
  performance_multiplier DECIMAL(3,2),
  base_elo_change INTEGER,
  final_elo_change INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, discord_id)
);

CREATE INDEX idx_match_player_stats_match ON match_player_stats(match_id);
CREATE INDEX idx_match_player_stats_player ON match_player_stats(discord_id);
```

### Matches Table - Add Stats Summary
```sql
ALTER TABLE matches ADD COLUMN atk_total_kills INTEGER DEFAULT 0;
ALTER TABLE matches ADD COLUMN def_total_kills INTEGER DEFAULT 0;
ALTER TABLE matches ADD COLUMN match_mvp_id TEXT;
ALTER TABLE matches ADD COLUMN stats_verified BOOLEAN DEFAULT FALSE;
```

---

## Updated `/endmatch` Command

### Command Structure
```
/endmatch winner:<atk|def> [stats:<json>]
```

### Stats JSON Format (Optional)
```json
{
  "players": [
    {
      "discord_id": "123456789",
      "kills": 15,
      "deaths": 8,
      "assists": 3,
      "headshots": 9,
      "score": 2450,
      "damage": 3200
    },
    ...
  ]
}
```

### Command Flow

**Without Stats (Current Behavior):**
1. Select winner team
2. Calculate base ELO (win/loss only)
3. Update player records
4. Post results embed

**With Stats (New Behavior):**
1. Select winner team
2. Parse player stats JSON
3. Calculate performance multipliers for each player
4. Calculate final ELO changes
5. Update player stats (kills, deaths, HS%, etc.)
6. Update match_player_stats table
7. Post enhanced results embed with stats

### Enhanced Results Embed
```
🏆 Match #123 Results — NA

Winner: 🔴 ATK Team

MVP: @Player1 (K/D: 2.5, HS: 60%, +40 ELO)

🔴 ATK Team:
• @Player1: 15-6-3 | HS: 60% | +40 ELO ⭐
• @Player2: 12-8-5 | HS: 45% | +28 ELO
• @Player3: 10-9-4 | HS: 30% | +25 ELO
• @Player4: 8-10-6 | HS: 25% | +18 ELO
• @Player5: 7-11-2 | HS: 20% | +15 ELO

🔵 DEF Team:
• @Player6: 18-10-4 | HS: 75% | -29 ELO (Best Loser)
• @Player7: 12-12-3 | HS: 50% | -20 ELO
• @Player8: 8-13-5 | HS: 35% | -20 ELO
• @Player9: 6-14-2 | HS: 20% | -20 ELO
• @Player10: 4-15-1 | HS: 10% | -26 ELO

Map: Mirage | Duration: 24:35
```

---

## Counter Blox API Integration

### GameData Object (Expected Fields)
```javascript
{
  "gameid": "abc123",
  "map": "Mirage",
  "duration": 1475, // seconds
  "winner": "atk",
  "players": [
    {
      "userid": 123456789, // Roblox ID
      "team": "atk",
      "kills": 15,
      "deaths": 8,
      "assists": 3,
      "headshots": 9,
      "score": 2450,
      "damage": 3200
    },
    ...
  ]
}
```

### Auto-Verification Flow
1. WebSocket receives `game_added` event
2. Extract player stats from GameData
3. Match Roblox IDs to Discord IDs via `roblox_accounts` table
4. Find corresponding Discord match (within 30 min window)
5. Auto-populate stats in `match_player_stats` table
6. Calculate performance-based ELO
7. Update match status to "stats_verified"
8. Notify host: "Match stats verified! Use /endmatch to finalize."

---

## Leaderboards

### Multiple Leaderboard Types

**1. ELO Leaderboard (Primary)**
- Sorted by ELO rating
- Shows: Rank, Username, ELO, W/L, Win%

**2. K/D Leaderboard**
- Sorted by average K/D ratio
- Minimum 10 matches played
- Shows: Rank, Username, K/D, Total Kills, Total Deaths

**3. Headshot % Leaderboard**
- Sorted by headshot percentage
- Minimum 50 kills total
- Shows: Rank, Username, HS%, Total HS, Total Kills

**4. MVP Leaderboard**
- Sorted by MVP count
- Shows: Rank, Username, MVPs, Matches Played, MVP%

### Discord Commands

**`/leaderboard [type]`**
- `type`: elo (default), kd, headshot, mvp
- Shows top 10 players

**`/stats [@user]`**
- Shows detailed stats for user
- If no user specified, shows your own stats

---

## Profile Page Updates

### Enhanced Profile Display

**Stats Overview:**
```
┌─────────────────────────────────┐
│ Player Profile                  │
├─────────────────────────────────┤
│ ELO: 1250 (#15)                │
│ W/L: 45-23 (66.2%)             │
│ K/D: 1.85                       │
│ HS%: 52.3%                      │
│ MVPs: 12 (17.6%)               │
│ Total Kills: 1,234             │
│ Total Deaths: 667              │
│ Avg Score: 2,150               │
└─────────────────────────────────┘
```

**Recent Performance:**
- Last 10 matches with K/D and HS%
- Performance trend graph
- Best match highlight

---

## Implementation Steps

### Phase 1: Database & Schema (Week 1)
- [ ] Add stats columns to players table
- [ ] Create match_player_stats table
- [ ] Update matches table with stats fields
- [ ] Write migration scripts
- [ ] Test schema changes

### Phase 2: ELO Calculation (Week 1-2)
- [ ] Implement performance multiplier functions
- [ ] Update ELO calculation in endmatch.js
- [ ] Add stats validation
- [ ] Test various scenarios
- [ ] Document edge cases

### Phase 3: Command Updates (Week 2)
- [ ] Update /endmatch to accept stats JSON
- [ ] Create enhanced results embed
- [ ] Add stats validation and error handling
- [ ] Update help documentation
- [ ] Test with real matches

### Phase 4: Counter Blox Integration (Week 2-3)
- [ ] Parse GameData from WebSocket
- [ ] Map Roblox IDs to Discord IDs
- [ ] Auto-populate match_player_stats
- [ ] Implement auto-verification
- [ ] Test with real Roblox games

### Phase 5: Leaderboards (Week 3)
- [ ] Create K/D leaderboard query
- [ ] Create HS% leaderboard query
- [ ] Create MVP leaderboard query
- [ ] Update /leaderboard command
- [ ] Add leaderboard to website

### Phase 6: Profile Updates (Week 3-4)
- [ ] Update profile page with stats
- [ ] Add performance graphs
- [ ] Create /stats command
- [ ] Add stats to OG images
- [ ] Test all displays

---

## Edge Cases & Handling

### 1. Missing Stats Data
**Scenario:** Match completed without Roblox verification
**Solution:** Use base ELO only (current system), mark as "unverified"

### 2. Partial Stats
**Scenario:** Some players have stats, others don't
**Solution:** Apply performance multiplier only to players with stats

### 3. Extreme Performance
**Scenario:** Player goes 30-0 (K/D = ∞)
**Solution:** Cap K/D bonus at +0.3 (already handled)

### 4. AFK Players
**Scenario:** Player has 0 kills, 0 deaths
**Solution:** Treat as 0 K/D bonus, apply base ELO only

### 5. Stat Manipulation
**Scenario:** Players try to game the system
**Solution:** 
- Require Roblox verification for stats
- Admin review for suspicious stats
- Cap maximum multiplier at 2.0x

---

## Configuration

### Tunable Parameters
```javascript
const ELO_CONFIG = {
  K_FACTOR: 32,
  
  // Performance multiplier caps
  MAX_MULTIPLIER: 2.0,
  MIN_MULTIPLIER: 0.5,
  
  // K/D thresholds
  KD_EXCEPTIONAL: 2.0,  // +0.3
  KD_GREAT: 1.5,        // +0.2
  KD_GOOD: 1.2,         // +0.1
  KD_AVERAGE: 0.8,      // 0
  KD_BELOW: 0.5,        // -0.1
  KD_POOR: 0.0,         // -0.3
  
  // Headshot % thresholds
  HS_ELITE: 70,         // +0.15
  HS_GREAT: 50,         // +0.10
  HS_GOOD: 30,          // +0.05
  
  // MVP bonus
  MVP_BONUS: 0.2,
  
  // Leaderboard minimums
  MIN_MATCHES_KD: 10,
  MIN_KILLS_HS: 50,
};
```

---

## Testing Plan

### Unit Tests
- [ ] K/D bonus calculation
- [ ] HS% bonus calculation
- [ ] MVP determination
- [ ] Performance multiplier
- [ ] Final ELO calculation

### Integration Tests
- [ ] /endmatch with stats
- [ ] Auto-verification flow
- [ ] Leaderboard queries
- [ ] Profile page display

### Scenarios to Test
1. Win with great stats → High ELO gain
2. Win with poor stats → Low ELO gain
3. Loss with great stats → Reduced ELO loss
4. Loss with poor stats → High ELO loss
5. Match without stats → Base ELO only
6. Partial stats → Mixed calculation
7. Extreme stats → Capped multipliers

---

## Success Metrics

### Must Have
- ✅ Performance multipliers working correctly
- ✅ Stats stored in database
- ✅ Enhanced results embed
- ✅ K/D and HS% leaderboards
- ✅ Profile page shows stats

### Nice to Have
- Performance trend graphs
- Stat comparison between players
- Season-based stats reset
- Achievement system (e.g., "5 MVPs in a row")

---

## Migration Strategy

### For Existing Matches
```sql
-- Backfill stats columns with defaults
UPDATE players SET 
  total_kills = 0,
  total_deaths = 0,
  total_headshots = 0,
  avg_kd = 0,
  avg_hs_percent = 0
WHERE total_kills IS NULL;

-- Mark existing matches as unverified
UPDATE matches SET stats_verified = FALSE;
```

### For Existing Players
- Keep current ELO ratings
- Start tracking stats from implementation date
- Historical matches show "Stats not available"

---

*Last Updated: 2026-06-29*
*Status: Design Complete - Ready for Implementation*
