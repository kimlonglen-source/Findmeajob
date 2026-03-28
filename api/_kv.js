function getKV() {
  const restUrl = process.env.KV_REST_API_URL;
  const restToken = process.env.KV_REST_API_TOKEN;
  if (restUrl && restToken) return { url: restUrl, token: restToken };
  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
  if (redisUrl) {
    const match = redisUrl.match(/rediss?:\/\/default:([^@]+)@(.+)/);
    if (match) {
      return { url: `https://${match[2].split(':')[0]}`, token: match[1] };
    }
  }
  return null;
}

// Send command as JSON array via pipeline - the correct Upstash REST format
async function command(args) {
  const kv = getKV();
  if (!kv) throw new Error('No KV config');
  const r = await fetch(`${kv.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${kv.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([args])
  });
  const d = await r.json();
  if (!Array.isArray(d)) throw new Error('Unexpected response: ' + JSON.stringify(d));
  if (d[0] && d[0].error) throw new Error(d[0].error);
  return d[0] ? d[0].result : null;
}

async function hget(hash, key) {
  return await command(['HGET', hash, key]);
}

async function hgetall(hash) {
  const result = await command(['HGETALL', hash]);
  if (!result || !result.length) return {};
  const obj = {};
  for (let i = 0; i < result.length; i += 2) obj[result[i]] = result[i + 1];
  return obj;
}

async function hset(hash, key, value) {
  const strValue = typeof value === 'string' ? value : JSON.stringify(value);
  await command(['HSET', hash, key, strValue]);
}

async function hdel(hash, key) {
  await command(['HDEL', hash, key]);
}

// Password hashing using Node.js built-in crypto
const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  // Handle plaintext passwords (migration from old system)
  if (!stored.includes(':') || stored.length < 50) {
    return password === stored;
  }
  const parts = stored.split(':');
  if (parts.length !== 2) return password === stored;
  var salt = parts[0];
  var hash = parts[1];
  var check = crypto.scryptSync(password, salt, 64).toString('hex');
  return check === hash;
}

function isHashed(stored) {
  return stored && stored.includes(':') && stored.length > 50;
}

function validatePassword(password) {
  if (!password || password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include at least one special character (!@#$%^&*).";
  return null;
}

module.exports = { getKV, hget, hgetall, hset, hdel, hashPassword, verifyPassword, isHashed, validatePassword };
