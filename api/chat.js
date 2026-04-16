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

  var ip = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.socket.remoteAddress || "unknown";
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: "Too many requests. Please wait a minute and try again." });
  }

  try {
    var body = req.body;
    var action = body.action;

    /* ── Deepgram Text-to-Speech ── */
    if (action === "tts") {
      var dgKey = process.env.DEEPGRAM_API_KEY;
      if (!dgKey) return res.status(500).json({ error: "TTS not configured" });
      var text = body.text;
      var voice = body.voice || "aura-asteria-en";
      if (!text) return res.status(400).json({ error: "text is required" });
      if (text.length > 3000) text = text.substring(0, 3000);

      var ttsRes = await fetch("https://api.deepgram.com/v1/speak?model=" + encodeURIComponent(voice) + "&encoding=mp3", {
        method: "POST",
        headers: { "Authorization": "Token " + dgKey, "Content-Type": "application/json" },
        body: JSON.stringify({ text: text })
      });
      if (!ttsRes.ok) {
        var errBody = await ttsRes.text().catch(function () { return ""; });
        return res.status(502).json({ error: "TTS failed: " + ttsRes.status, detail: errBody });
      }
      var audioBuf = Buffer.from(await ttsRes.arrayBuffer());
      return res.status(200).json({ audio: audioBuf.toString("base64"), content_type: "audio/mpeg" });
    }

    /* ── Deepgram Speech-to-Text ── */
    if (action === "stt") {
      var dgKey2 = process.env.DEEPGRAM_API_KEY;
      if (!dgKey2) return res.status(500).json({ error: "STT not configured" });
      var audio = body.audio;
      var mime = body.mimeType || "audio/webm";
      if (!audio) return res.status(400).json({ error: "audio is required" });

      var audioData = Buffer.from(audio, "base64");
      var sttRes = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&language=en-NZ&filler_words=true&smart_format=true&punctuate=true", {
        method: "POST",
        headers: { "Authorization": "Token " + dgKey2, "Content-Type": mime.split(";")[0] },
        body: audioData
      });
      if (!sttRes.ok) {
        var errBody2 = await sttRes.text().catch(function () { return ""; });
        return res.status(502).json({ error: "STT failed: " + sttRes.status, detail: errBody2 });
      }
      var sttData = await sttRes.json();
      var ch = sttData.results && sttData.results.channels && sttData.results.channels[0];
      var alt = ch && ch.alternatives && ch.alternatives[0];
      return res.status(200).json({
        transcript: alt ? alt.transcript : "",
        confidence: alt ? alt.confidence : 0,
        words: alt ? (alt.words || []) : [],
        duration: sttData.metadata ? sttData.metadata.duration : 0
      });
    }

    /* ── Claude chat (original) ── */
    var apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "API key not configured" });

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

module.exports.config = { api: { bodyParser: { sizeLimit: "10mb" } } };
