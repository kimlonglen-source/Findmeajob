var _kv = require("./_kv");
var getKV = _kv.getKV;
var hget = _kv.hget;
var hset = _kv.hset;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!getKV()) return res.status(200).json({ ok: true });
  try {
    var jobId = req.body.jobId;
    var type = req.body.type;
    if (!jobId || !type) return res.status(200).json({ ok: true });
    if (type !== "view" && type !== "apply") return res.status(200).json({ ok: true });
    var raw = await hget("jobs", jobId);
    if (!raw) return res.status(200).json({ ok: true });
    var job = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (type === "view") job.views = (job.views || 0) + 1;
    if (type === "apply") job.applies = (job.applies || 0) + 1;
    await hset("jobs", jobId, job);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(200).json({ ok: true });
  }
};
