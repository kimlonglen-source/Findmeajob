var rateLimitMap = {};

function checkRateLimit(ip) {
  var now = Date.now();
  if (!rateLimitMap[ip] || rateLimitMap[ip].resetAt < now) {
    rateLimitMap[ip] = { count: 1, resetAt: now + 60000 };
    return true;
  }
  rateLimitMap[ip].count++;
  if (rateLimitMap[ip].count > 30) return false;
  return true;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  var ip = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.socket.remoteAddress || "unknown";
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: "Too many requests. Please wait a minute and try again." });
  }

  try {
    var body = req.body;
    var messages = body.messages;
    var system = body.system;

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages must be an array" });
    }
    if (messages.length > 10) {
      return res.status(400).json({ error: "Too many messages. Maximum is 10." });
    }
    if (system !== undefined && typeof system !== "string") {
      return res.status(400).json({ error: "system must be a string" });
    }

    var response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-beta": "pdfs-2024-09-25" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2500, system: system || "", messages: messages })
    });
    var data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Something went wrong" });
  }
};
