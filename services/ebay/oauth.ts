let cachedToken: string | null = null;
let cachedExpiry = 0;

export async function getEbayAccessToken() {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET in .env.local");
  }

  const now = Date.now();

  if (cachedToken && cachedExpiry > now + 60_000) {
    return cachedToken;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error_description || data?.error || "Could not get eBay access token");
  }

  cachedToken = data.access_token;
  cachedExpiry = now + Number(data.expires_in || 7200) * 1000;

  return cachedToken;
}