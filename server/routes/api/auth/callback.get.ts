import { defineEventHandler, getQuery, setResponseStatus, sendRedirect, setCookie } from "h3";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = query.code as string;
  const error = query.error as string;

  if (error || !code) {
    setResponseStatus(event, 400);
    return { error: error || "No authorization code" };
  }

  const clientId = process.env.VITE_DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.VITE_REDIRECT_URI || "http://localhost:3000/api/auth/callback";

  if (!clientId || !clientSecret) {
    setResponseStatus(event, 500);
    return { error: "Discord OAuth not configured" };
  }

  try {
    const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      setResponseStatus(event, 400);
      return { error: `Token exchange failed: ${errText}` };
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const userRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      setResponseStatus(event, 500);
      return { error: "Failed to fetch user" };
    }

    const user = await userRes.json();
    const session = {
      user_id: user.id,
      username: user.global_name || user.username,
      avatar_url: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : "",
    };

    const cookieVal = Buffer.from(JSON.stringify(session)).toString("base64url");
    const cookieSecret = process.env.COOKIE_SECRET || "dev-secret";
    const sig = await signCookie(cookieVal, cookieSecret);

    // Debug logging
    console.log("Setting cookie for user:", session.username);
    console.log("Cookie value length:", cookieVal.length);
    console.log("Is production:", process.env.NODE_ENV === "production");

    setCookie(event, "capl_session", `${cookieVal}.${sig}`, {
      path: "/",
      httpOnly: false, // Changed to false for debugging - allows JS to read it
      sameSite: "lax",
      maxAge: 86400,
      secure: false, // Changed to false for debugging
    });

    return sendRedirect(event, "/queue", 302);
  } catch (err: any) {
    setResponseStatus(event, 500);
    return { error: err?.message || "OAuth failed" };
  }
});

async function signCookie(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}
