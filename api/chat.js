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

  var body = req.body;
  var action = body.action;

  // --- Deepgram Text-to-Speech ---
  if (action === "tts") {
    var dgKey = process.env.DEEPGRAM_API_KEY;
    if (!dgKey) return res.status(500).json({ error: "Deepgram not configured" });
    var text = body.text;
    if (!text || text.length > 5000) return res.status(400).json({ error: "Invalid text" });
    var voice = body.voice || "aura-asteria-en";
    try {
      var ttsRes = await fetch("https://api.deepgram.com/v1/speak?model=" + voice, {
        method: "POST",
        headers: { "Authorization": "Token " + dgKey, "Content-Type": "application/json" },
        body: JSON.stringify({ text: text })
      });
      if (!ttsRes.ok) return res.status(500).json({ error: "TTS failed" });
      var audioBuffer = await ttsRes.arrayBuffer();
      var b64 = Buffer.from(audioBuffer).toString("base64");
      return res.status(200).json({ audio: b64, contentType: "audio/mp3" });
    } catch (e) {
      return res.status(500).json({ error: "TTS error" });
    }
  }

  // --- Deepgram Speech-to-Text ---
  if (action === "stt") {
    var dgKey2 = process.env.DEEPGRAM_API_KEY;
    if (!dgKey2) return res.status(500).json({ error: "Deepgram not configured" });
    var audio = body.audio;
    if (!audio) return res.status(400).json({ error: "No audio data" });
    try {
      var audioBytes = Buffer.from(audio, "base64");
      var sttRes = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&language=en-NZ&punctuate=true&diarize=false&filler_words=true&smart_format=true", {
        method: "POST",
        headers: { "Authorization": "Token " + dgKey2, "Content-Type": "audio/webm" },
        body: audioBytes
      });
      if (!sttRes.ok) return res.status(500).json({ error: "STT failed" });
      var sttData = await sttRes.json();
      var result = { transcript: "", confidence: 0, words: [], fillers: { total: 0, ums: 0, uhs: 0, ahs: 0, ers: 0, hmms: 0, likes: 0, youknows: 0 }, duration: 0, wordsPerMinute: 0 };
      if (sttData.results && sttData.results.channels && sttData.results.channels[0]) {
        var alt = sttData.results.channels[0].alternatives[0];
        result.transcript = alt.transcript || "";
        result.confidence = alt.confidence || 0;
        result.words = (alt.words || []).map(function(w) { return { word: w.word, start: w.start, end: w.end, confidence: w.confidence }; });
        result.duration = sttData.results.channels[0].alternatives[0].words && sttData.results.channels[0].alternatives[0].words.length > 0 ? sttData.results.channels[0].alternatives[0].words[sttData.results.channels[0].alternatives[0].words.length - 1].end : 0;
        // Count filler words
        (alt.words || []).forEach(function(w) {
          var lw = (w.word || "").toLowerCase().replace(/[.,!?]/g, "");
          if (/^(um+|umm+)$/.test(lw)) { result.fillers.ums++; result.fillers.total++; }
          else if (/^(uh+|uhh+)$/.test(lw)) { result.fillers.uhs++; result.fillers.total++; }
          else if (/^(ah+|ahh+)$/.test(lw)) { result.fillers.ahs++; result.fillers.total++; }
          else if (/^(er+|err+)$/.test(lw)) { result.fillers.ers++; result.fillers.total++; }
          else if (/^(hmm+|hm+)$/.test(lw)) { result.fillers.hmms++; result.fillers.total++; }
          else if (lw === "like" && w.confidence < 0.8) { result.fillers.likes++; result.fillers.total++; }
          else if (lw === "you" && alt.words[alt.words.indexOf(w) + 1] && alt.words[alt.words.indexOf(w) + 1].word.toLowerCase() === "know") { result.fillers.youknows++; result.fillers.total++; }
        });
        // Words per minute
        if (result.duration > 0) {
          var wordCount = (alt.words || []).filter(function(w) { return !/^(um+|umm+|uh+|uhh+|ah+|ahh+|er+|err+|hmm+|hm+)$/.test((w.word || "").toLowerCase().replace(/[.,!?]/g, "")); }).length;
          result.wordsPerMinute = Math.round(wordCount / (result.duration / 60));
        }
      }
      return res.status(200).json(result);
    } catch (e) {
      return res.status(500).json({ error: "STT error" });
    }
  }

  // --- Claude AI (original) ---
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  try {
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
