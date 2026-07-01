# `/link` Command - Discord to Roblox Account Linking

## Overview

The `/link` command allows players to connect their Discord account to their Roblox account, enabling automatic stat tracking and game verification.

---

## User Experience Flow

### Step 1: Player Initiates Linking
```
Player: /link fujinkochi
```

### Step 2: Bot Generates Verification Code
```
Bot Response:
┌─────────────────────────────────────────┐
│ 🔗 Link Your Roblox Account             │
├─────────────────────────────────────────┤
│ Username: fujinkochi                    │
│ Roblox ID: 123456789                    │
│                                         │
│ Verification Code: CAPL-8X9K2          │
│                                         │
│ Instructions:                           │
│ 1. Go to roblox.com/users/profile      │
│ 2. Click "Edit Profile"                 │
│ 3. Add this code to your description:   │
│    CAPL-8X9K2                           │
│ 4. Click "Save"                         │
│ 5. Click "Verify" button below          │
│                                         │
│ Code expires in 10 minutes              │
└─────────────────────────────────────────┘

[Verify] [Cancel]
```

### Step 3: Player Adds Code to Roblox Profile
Player goes to their Roblox profile and adds the verification code to their description:

```
Roblox Profile Description:
"Counter-Blox player | CAPL-8X9K2 | Competitive 5v5"
```

### Step 4: Player Clicks Verify Button
Bot fetches the Roblox profile and checks if the code is present.

### Step 5: Verification Success
```
Bot Response:
✅ Account Linked Successfully!

Discord: @fujinkochi#1234
Roblox: fujinkochi (123456789)

Your stats will now be automatically tracked from Counter-Blox matches!
```

### Step 6: Player Can Remove Code
After successful verification, player can remove the code from their Roblox profile description.

---

## Technical Implementation

### Command Definition
```javascript
// worker/src/commands/link.js
export const linkCommand = {
  name: 'link',
  description: 'Link your Discord account to your Roblox account',
  options: [
    {
      name: 'username',
      description: 'Your Roblox username',
      type: 3, // STRING
      required: true,
    },
  ],
};
```

### Step-by-Step Backend Flow

#### 1. Fetch Roblox User ID
```javascript
async function getRobloxUserId(username) {
  const response = await fetch(
    `https://users.roblox.com/v1/usernames/users`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usernames: [username],
        excludeBannedUsers: true,
      }),
    }
  );
  
  const data = await response.json();
  if (data.data && data.data.length > 0) {
    return {
      id: data.data[0].id,
      name: data.data[0].name,
      displayName: data.data[0].displayName,
    };
  }
  return null;
}
```

#### 2. Generate Verification Code
```javascript
function generateVerificationCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CAPL-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
```

#### 3. Store Pending Verification
```javascript
// Database table: pending_verifications
await db.createPendingVerification({
  discord_id: interaction.user.id,
  roblox_id: robloxUser.id,
  roblox_username: robloxUser.name,
  verification_code: code,
  expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
});
```

#### 4. Send Verification Message
```javascript
const embed = {
  color: 0x5865F2,
  title: '🔗 Link Your Roblox Account',
  fields: [
    { name: 'Username', value: robloxUser.name, inline: true },
    { name: 'Roblox ID', value: robloxUser.id.toString(), inline: true },
    { name: 'Verification Code', value: `\`${code}\``, inline: false },
    {
      name: 'Instructions',
      value: [
        '1. Go to [roblox.com/users/profile](https://www.roblox.com/users/profile)',
        '2. Click "Edit Profile"',
        `3. Add this code to your description: \`${code}\``,
        '4. Click "Save"',
        '5. Click "Verify" button below',
      ].join('\n'),
    },
  ],
  footer: { text: 'Code expires in 10 minutes' },
};

const components = [
  {
    type: 1,
    components: [
      {
        type: 2,
        style: 3, // SUCCESS (green)
        label: 'Verify',
        custom_id: `verify_${interaction.user.id}`,
      },
      {
        type: 2,
        style: 4, // DANGER (red)
        label: 'Cancel',
        custom_id: `cancel_verify_${interaction.user.id}`,
      },
    ],
  },
];

return { embeds: [embed], components };
```

#### 5. Handle Verify Button Click
```javascript
// worker/src/index.js - Button interaction handler
if (customId.startsWith('verify_')) {
  const discordId = customId.split('_')[1];
  
  // Get pending verification
  const pending = await db.getPendingVerification(discordId);
  if (!pending) {
    return reply('Verification expired or not found.', true);
  }
  
  // Check if expired
  if (new Date() > new Date(pending.expires_at)) {
    await db.deletePendingVerification(discordId);
    return reply('Verification code expired. Please run /link again.', true);
  }
  
  // Fetch Roblox profile description
  const profile = await getRobloxProfile(pending.roblox_id);
  if (!profile || !profile.description) {
    return reply('Could not fetch your Roblox profile. Please try again.', true);
  }
  
  // Check if code is in description
  if (!profile.description.includes(pending.verification_code)) {
    return reply(
      `Verification code not found in your profile description. Please add \`${pending.verification_code}\` and try again.`,
      true
    );
  }
  
  // Verification successful - store in database
  await db.createRobloxAccount({
    discord_id: discordId,
    roblox_id: pending.roblox_id,
    roblox_username: pending.roblox_username,
  });
  
  // Delete pending verification
  await db.deletePendingVerification(discordId);
  
  // Update message
  const successEmbed = {
    color: 0x57F287, // Green
    title: '✅ Account Linked Successfully!',
    fields: [
      { name: 'Discord', value: `<@${discordId}>`, inline: true },
      { name: 'Roblox', value: `${pending.roblox_username} (${pending.roblox_id})`, inline: true },
    ],
    description: 'Your stats will now be automatically tracked from Counter-Blox matches!',
  };
  
  return { embeds: [successEmbed], components: [] };
}
```

#### 6. Fetch Roblox Profile
```javascript
async function getRobloxProfile(userId) {
  const response = await fetch(
    `https://users.roblox.com/v1/users/${userId}`
  );
  
  if (!response.ok) return null;
  
  const data = await response.json();
  return {
    id: data.id,
    name: data.name,
    displayName: data.displayName,
    description: data.description,
    created: data.created,
    isBanned: data.isBanned,
  };
}
```

---

## Database Schema

### Table: `roblox_accounts`
```sql
CREATE TABLE roblox_accounts (
  discord_id TEXT PRIMARY KEY,
  roblox_id BIGINT NOT NULL UNIQUE,
  roblox_username TEXT NOT NULL,
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_discord_player FOREIGN KEY (discord_id) 
    REFERENCES players(discord_id) ON DELETE CASCADE
);

CREATE INDEX idx_roblox_accounts_roblox_id ON roblox_accounts(roblox_id);
```

### Table: `pending_verifications`
```sql
CREATE TABLE pending_verifications (
  discord_id TEXT PRIMARY KEY,
  roblox_id BIGINT NOT NULL,
  roblox_username TEXT NOT NULL,
  verification_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Auto-cleanup expired verifications
CREATE INDEX idx_pending_verifications_expires ON pending_verifications(expires_at);
```

---

## How It Works with Match Stats

### When Match Completes

1. **Counter Blox API sends `game_added` event:**
```json
{
  "type": "game_added",
  "gameid": "abc123",
  "data": {
    "players": [
      {
        "userid": 123456789, // Roblox ID
        "kills": 15,
        "deaths": 8,
        "headshots": 9
      }
    ]
  }
}
```

2. **Bot looks up Discord ID:**
```javascript
// Query roblox_accounts table
const discordId = await db.getDiscordIdByRobloxId(123456789);
// Returns: "987654321" (Discord ID)
```

3. **Bot stores stats:**
```javascript
await db.createMatchPlayerStats({
  match_id: matchId,
  discord_id: discordId,
  kills: 15,
  deaths: 8,
  headshots: 9,
  // ... other stats
});
```

4. **Bot calculates performance-based ELO:**
```javascript
const kdBonus = calculateKDBonus(15, 8); // +0.2
const hsBonus = calculateHSBonus(9, 15); // +0.10
const finalElo = baseElo * (1.0 + kdBonus + hsBonus);
```

---

## Additional Commands

### `/unlink` - Unlink Roblox Account
```javascript
export const unlinkCommand = {
  name: 'unlink',
  description: 'Unlink your Roblox account from Discord',
};

// Handler
async function handleUnlink(interaction, db) {
  const account = await db.getRobloxAccount(interaction.user.id);
  
  if (!account) {
    return reply('You do not have a linked Roblox account.', true);
  }
  
  await db.deleteRobloxAccount(interaction.user.id);
  
  return reply(
    `✅ Unlinked Roblox account: ${account.roblox_username} (${account.roblox_id})`,
    false
  );
}
```

### `/linkstatus` - Check Link Status
```javascript
export const linkStatusCommand = {
  name: 'linkstatus',
  description: 'Check your Roblox account link status',
  options: [
    {
      name: 'user',
      description: 'Check another user\'s link status',
      type: 6, // USER
      required: false,
    },
  ],
};

// Handler
async function handleLinkStatus(interaction, db) {
  const targetUser = interaction.data.options?.[0]?.value || interaction.user.id;
  const account = await db.getRobloxAccount(targetUser);
  
  if (!account) {
    return reply(
      targetUser === interaction.user.id
        ? 'You do not have a linked Roblox account. Use `/link` to link one.'
        : 'This user does not have a linked Roblox account.',
      true
    );
  }
  
  const embed = {
    color: 0x5865F2,
    title: '🔗 Roblox Account Link Status',
    fields: [
      { name: 'Discord', value: `<@${account.discord_id}>`, inline: true },
      { name: 'Roblox', value: `${account.roblox_username} (${account.roblox_id})`, inline: true },
      { name: 'Linked Since', value: `<t:${Math.floor(new Date(account.verified_at).getTime() / 1000)}:R>`, inline: false },
    ],
  };
  
  return { embeds: [embed] };
}
```

---

## Error Handling

### Common Errors

**1. Roblox Username Not Found**
```
❌ Roblox user "invaliduser" not found. Please check the spelling and try again.
```

**2. Account Already Linked**
```
❌ Your Discord account is already linked to: fujinkochi (123456789)
Use /unlink to unlink first, then /link again.
```

**3. Roblox Account Already Linked to Another Discord**
```
❌ This Roblox account is already linked to another Discord user.
If this is your account, contact an admin for help.
```

**4. Verification Code Not Found**
```
❌ Verification code not found in your profile description.
Please add `CAPL-8X9K2` to your Roblox profile description and try again.
```

**5. Verification Expired**
```
❌ Verification code expired. Please run /link again to generate a new code.
```

**6. Roblox API Error**
```
❌ Could not connect to Roblox API. Please try again later.
```

---

## Security Considerations

### 1. Code Expiration
- Verification codes expire after 10 minutes
- Prevents code reuse attacks
- Auto-cleanup of expired verifications

### 2. One-to-One Mapping
- One Discord account → One Roblox account
- One Roblox account → One Discord account
- Prevents account sharing

### 3. Profile Verification
- Requires write access to Roblox profile
- Proves ownership of the account
- Cannot be spoofed

### 4. Rate Limiting
```javascript
// Limit /link attempts per user
const LINK_COOLDOWN = 60000; // 1 minute
const lastAttempt = await db.getLastLinkAttempt(userId);
if (lastAttempt && Date.now() - lastAttempt < LINK_COOLDOWN) {
  return reply('Please wait before trying to link again.', true);
}
```

### 5. Admin Override
```javascript
// Admin command to manually link accounts
export const adminLinkCommand = {
  name: 'adminlink',
  description: 'Manually link a Discord user to a Roblox account (Admin only)',
  options: [
    { name: 'user', type: 6, required: true },
    { name: 'roblox_id', type: 4, required: true },
  ],
};
```

---

## User Experience Tips

### 1. Clear Instructions
- Step-by-step guide in embed
- Visual indicators (emojis)
- Clickable links to Roblox profile

### 2. Helpful Error Messages
- Explain what went wrong
- Provide next steps
- Include support contact

### 3. Confirmation Messages
- Show linked accounts clearly
- Timestamp of verification
- Explain what happens next

### 4. Easy Unlinking
- Simple `/unlink` command
- Confirmation before unlinking
- Can re-link anytime

---

## Testing Checklist

- [ ] Valid username links successfully
- [ ] Invalid username shows error
- [ ] Verification code appears in profile
- [ ] Verify button works
- [ ] Cancel button works
- [ ] Code expiration works
- [ ] Already linked error shows
- [ ] Duplicate Roblox account error shows
- [ ] Unlink command works
- [ ] Link status command works
- [ ] Stats auto-populate after linking
- [ ] Admin override works

---

## FAQ

**Q: Do I need to keep the code in my Roblox profile?**
A: No, you can remove it after successful verification.

**Q: Can I link multiple Discord accounts to one Roblox account?**
A: No, one Roblox account can only be linked to one Discord account.

**Q: What if I change my Roblox username?**
A: The link uses your Roblox ID, so username changes don't affect it. However, you may want to run `/unlink` and `/link` again to update the stored username.

**Q: Can I unlink and re-link to a different Roblox account?**
A: Yes, use `/unlink` first, then `/link` with the new username.

**Q: What happens to my stats if I unlink?**
A: Your historical stats remain in the database, but new matches won't be tracked until you link again.

**Q: Is my Roblox account information secure?**
A: Yes, we only store your Roblox ID and username. We never store passwords or access tokens.

---

*Last Updated: 2026-06-29*
*Status: Design Complete - Ready for Implementation*
