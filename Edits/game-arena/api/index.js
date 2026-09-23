const handleRequest = require("../server");

module.exports = async function (req, res) {
  return handleRequest(req, res);
};
