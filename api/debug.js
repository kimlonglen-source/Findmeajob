const { getKV } = require('./_kv');

module.exports = async function handler(req, res) {
  const kv = getKV();
  let ping = null;
  if (kv) {
    try {
      const r = await fetch(`${kv.url}/ping`, { headers: { Authorization: `Bearer ${kv.token}` } });
      const d = await r.json();
      ping = d.result || JSON.stringify(d);
    } catch (e) {
      ping = 'error: ' + e.message;
    }
  }
  return res.status(200).json({
    KV_REST_API_URL: process.env.KV_REST_API_URL ? 'SET' : 'MISSING',
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN ? 'SET' : 'MISSING',
    REDIS_URL: process.env.REDIS_URL ? 'SET' : 'MISSING',
    kvResolved: kv ? kv.url : 'NO',
    ping
  });
};
