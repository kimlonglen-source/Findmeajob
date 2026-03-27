var _kv = require("./_kv");
var hgetall = _kv.hgetall;

var PLAN_DAYS = { free: 30, basic: 60, pro: 90 };

module.exports = async function handler(req, res) {
  try {
    var raw = await hgetall("jobs");
    var now = new Date();
    var jobs = Object.values(raw)
      .map(function(j) { return typeof j === "string" ? JSON.parse(j) : j; })
      .filter(function(j) {
        if (j.status !== "approved") return false;
        // Check expiry
        var start = j.approvedAt || j.submitted;
        var days = j.planDays || PLAN_DAYS[j.plan] || 30;
        var expiry = new Date(new Date(start).getTime() + days * 24 * 60 * 60 * 1000);
        return now < expiry;
      })
      .sort(function(a, b) {
        // Featured first (Pro auto-featured)
        if (b.featured && !a.featured) return 1;
        if (a.featured && !b.featured) return -1;
        // Then priority (Growth+)
        if (b.priority && !a.priority) return 1;
        if (a.priority && !b.priority) return -1;
        // Then newest
        return new Date(b.approvedAt || b.submitted) - new Date(a.approvedAt || a.submitted);
      });
    return res.status(200).json({ jobs: jobs });
  } catch (err) {
    console.error("approved-jobs error:", err);
    return res.status(200).json({ jobs: [] });
  }
};
