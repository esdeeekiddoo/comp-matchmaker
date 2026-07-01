# Automatic Match Flow (No Server ID Needed)

## Overview

The system automatically matches Counter-Blox games to Discord matches without requiring the host to provide a server ID. This is achieved through intelligent player matching and timing analysis.

---

## Complete Flow

### 1. Match Creation (`/host`)

**Discord Bot:**
```javascript
async function createMatch(interaction, env, db, vars, playerIds, region, isTest) {
  // Extract Roblox IDs from nicknames (set by Bloxlink)
  const players = [];
  for (const discordId of playerIds) {
    const member = await Discord.getGuildMember(interaction.guild_id, discordId);
    const robloxId = parseInt(member.nick); // Nickname = Roblox ID
    
    if (robloxId) {
      players.push({
        discord_id: discordId,
        roblox_id: robloxId,
      });
    }
  }

  // Store match in database
  const match = await db.createMatch({
    guild_id: interaction.guild_id,
    players,
    status: 'in_progress',
    created_at: new Date(),
    expected_roblox_ids: players.map(p => p.roblox_id),
  });

  return {
    match_id: match.id,
    players,
    message: 'Match created! Players can now join the private server.',
  };
}
```

---

### 2. Players Join Private Server

**Host Actions:**
1. Creates private Counter-Blox server
2. Shares link in Discord match channel
3. Players join using their Roblox accounts
4. Game starts when ready

**No bot interaction needed!**

---

### 3. Game Completion (Automatic)

**Counter-Blox API sends `game_added` event:**
```json
{
  "gameid": "cb-game-789",
  "timestamp": "2026-06-29T15:25:00Z",
  "winner": "CT",
  "players": [
    {
      "userid": 123456,
      "username": "Player1",
      "kills": 15,
      "deaths": 10,
      "headshots": 8,
      "score": 2500,
      "team": "CT"
    }
  ]
}
```

---

### 4. Automatic Matching Algorithm

```javascript
async function handleGameAdded(gameData, env, db) {
  const gameRobloxIds = gameData.players.map(p => p.userid);
  
  // Find recent matches (last 30 minutes)
  const recentMatches = await db.getRecentMatches(30);
  
  for (const match of recentMatches) {
    const expectedIds = match.expected_roblox_ids;
    const overlap = gameRobloxIds.filter(id => expectedIds.includes(id)).length;
    const overlapPercent = (overlap / expectedIds.length) * 100;
    
    // Match if ≥80% overlap
    if (overlapPercent >= 80) {
      await storeGameStats(match.id, gameData, db);
      await db.updateMatch(match.id, { stats_ready: true });
      return;
    }
  }
  
  // No match found
  await db.createUnmatchedGame({ roblox_game_id: gameData.gameid, game_data: gameData });
}
```

**Matching Criteria:**
- ✅ 80%+ player overlap
- ✅ 30-minute time window
- ✅ 10 players (5v5)

---

### 5. Stats Storage

```javascript
async function storeGameStats(matchId, gameData, db) {
  for (const player of gameData.players) {
    const discordId = await db.getDiscordIdByRobloxId(player.userid);
    
    await db.insertMatchPlayerStats({
      match_id: matchId,
      discord_id: discordId,
      roblox_id: player.userid,
      kills: player.kills,
      deaths: player.deaths,
      headshots: player.headshots,
      score: player.score,
      team: player.team,
      kd_ratio: player.kills / Math.max(player.deaths, 1),
      hs_percent: (player.headshots / Math.max(player.kills, 1)) * 100,
    });
  }
}
```

---

### 6. Match Completion (`/endmatch`)

**Command:** `/endmatch winner:ATK`

**Bot automatically:**
1. Checks if stats are ready
2. Retrieves stored stats
3. Calculates performance ELO
4. Displays enhanced results
5. Updates player ratings

**No server ID needed!**

---

## Enhanced Results Embed

**With Stats:**
```
🏆 Match Results - ATK Wins!

📊 Top Performers:
🥇 MVP: Player1 (15K/10D, 53% HS) +45 ELO
🥈 Player2 (12K/8D, 60% HS) +38 ELO
🥉 Player3 (10K/9D, 45% HS) +32 ELO

📈 ELO Changes:
ATK Team: +35 avg
DEF Team: -35 avg

✅ Stats verified from Counter-Blox match
```

**Without Stats (Fallback):**
```
🏆 Match Results - ATK Wins!

📈 ELO Changes:
ATK Team: +25 (base)
DEF Team: -25 (base)

⚠️ Stats not found - using base ELO
```

---

## Fallback Strategy

If auto-match fails:
- Match completes with base ELO
- Warning shown to host
- Stats can be manually added later

---

## Benefits

✅ **Zero manual input** - Host just picks winner
✅ **Automatic stats** - No server ID needed
✅ **Real-time matching** - Within seconds of game end
✅ **Fallback support** - Works even if stats unavailable
✅ **Performance ELO** - K/D, HS%, MVP bonuses applied

---

*Last Updated: 2026-06-29*
*Status: Automatic matching - no server ID required*
