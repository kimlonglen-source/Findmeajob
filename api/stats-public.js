var _kv = require("./_kv");
var getKV = _kv.getKV;
var hgetall = _kv.hgetall;

var PLAN_DAYS = { free: 30, basic: 60, pro: 90 };
var cache = { data: null, expires: 0 };

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  // Cache for 5 minutes
  var now = Date.now();
  if (cache.data && now < cache.expires) {
    return res.status(200).json(cache.data);
  }

  try {
    var result = { liveJobs: 0, adzunaJobs: 0 };

    // Count live employer listings
    if (getKV()) {
      var allRaw = await hgetall("jobs");
      var nowDate = new Date();
      var live = Object.values(allRaw)
        .map(function(j) { return typeof j === "string" ? JSON.parse(j) : j; })
        .filter(function(j) {
          if (j.status !== "approved") return false;
          var start = j.approvedAt || j.submitted;
          var days = j.planDays || PLAN_DAYS[j.plan] || 30;
          var expiry = new Date(new Date(start).getTime() + days * 24 * 60 * 60 * 1000);
          return nowDate < expiry;
        });
      result.liveJobs = live.length;
    }

    // Get Adzuna NZ total count
    var appId = process.env.ADZUNA_APP_ID;
    var appKey = process.env.ADZUNA_APP_KEY;
    if (appId && appKey) {
      try {
        var r = await fetch("https://api.adzuna.com/v1/api/jobs/nz/search/1?app_id=" + appId + "&app_key=" + appKey + "&results_per_page=1&what=jobs&location0=New+Zealand", {
          headers: { "Accept": "application/json" }
        });
        if (r.ok) {
          var data = await r.json();
          result.adzunaJobs = data.count || 0;
        }
      } catch (e) {}
    }

    result.totalJobs = result.liveJobs + result.adzunaJobs;

    cache.data = result;
    cache.expires = now + 300000; // 5 min

    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({ liveJobs: 0, adzunaJobs: 0, totalJobs: 0 });
  }
};
