var _kv = require("./_kv");
var getKV = _kv.getKV;

module.exports = async function handler(req, res) {
  var PASS = process.env.ADMIN_PASSWORD;
  if (!PASS) return res.status(500).json({ error: "ADMIN_PASSWORD environment variable is not set" });

  var password = (req.method === "POST" && req.body) ? req.body.password : req.query.password;
  if (!password || password !== PASS) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  var kv = getKV();
  var ping = null;
  if (kv) {
    try {
      var r = await fetch(kv.url + "/ping", { headers: { Authorization: "Bearer " + kv.token } });
      var d = await r.json();
      ping = d.result || JSON.stringify(d);
    } catch (e) {
      ping = "error: " + e.message;
    }
  }
  return res.status(200).json({
    KV_REST_API_URL: process.env.KV_REST_API_URL ? "SET" : "MISSING",
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN ? "SET" : "MISSING",
    REDIS_URL: process.env.REDIS_URL ? "SET" : "MISSING",
    kvResolved: kv ? kv.url : "NO",
    ping: ping
  });
};
