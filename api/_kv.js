function getKV() {
  const restUrl = process.env.KV_REST_API_URL;
  const restToken = process.env.KV_REST_API_TOKEN;
  if (restUrl && restToken) return { url: restUrl, token: restToken };

  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
  if (redisUrl) {
    const match = redisUrl.match(/redis:\/\/default:([^@]+)@(.+)/);
    if (match) {
      const token = match[1];
      const host = match[2].split(':')[0];
      return { url: `https://${host}`, token };
    }
  }
  return null;
}

async function hget(hash, key) {
  const kv = getKV();
  if (!kv) return null;
  const r = await fetch(`${kv.url}/hget/${hash}/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${kv.token}` }
  });
  const d = await r.json();
  return d.result || null;
}

async function hgetall(hash) {
  const kv = getKV();
  if (!kv) return {};
  const r = await fetch(`${kv.url}/hgetall/${hash}`, {
    headers: { Authorization: `Bearer ${kv.token}` }
  });
  const d = await r.json();
  if (!d.result || !d.result.length) return {};
  const obj = {};
  for (let i = 0; i < d.result.length; i += 2) obj[d.result[i]] = d.result[i + 1];
  return obj;
}

async function hset(hash, key, value) {
  const kv = getKV();
  if (!kv) throw new Error('No KV config');
  const r = await fetch(`${kv.url}/hset/${encodeURIComponent(hash)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${kv.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([key, typeof value === 'string' ? value : JSON.stringify(value)])
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error);
}

async function hdel(hash, key) {
  const kv = getKV();
  if (!kv) throw new Error('No KV config');
  await fetch(`${kv.url}/hdel/${encodeURIComponent(hash)}/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${kv.token}` }
  });
}

module.exports = { getKV, hget, hgetall, hset, hdel };
