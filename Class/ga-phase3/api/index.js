const handleRequest = require("../server");

module.exports = async function (req, res) {
  if (!req.url) req.url = req.originalUrl || "/";
  return handleRequest(req, res);
};
