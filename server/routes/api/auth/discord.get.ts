import { defineEventHandler, sendRedirect, setResponseStatus } from "h3";

const REDIRECT_URI = process.env.VITE_REDIRECT_URI || "http://localhost:3000/api/auth/callback";

export default defineEventHandler(async (event) => {
  const clientId = process.env.VITE_DISCORD_CLIENT_ID;
  if (!clientId) {
    setResponseStatus(event, 500);
    return { error: "Discord client ID not configured" };
  }

  const url = new URL("https://discord.com/api/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", "identify guilds");

  return sendRedirect(event, url.toString());
});
