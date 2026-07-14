const { setCors } = require("../../utils/platform");

const products = [
  { id: "hh-voice-lite", title: "HH Voice Studio Lite", price: 0, currency: "VND", type: "download" },
  { id: "kich-ban-ai-source", title: "Kich ban AI Source", price: 0, currency: "VND", type: "source" },
  { id: "portfolio-membership", title: "Creator Membership", price: 99000, currency: "VND", type: "membership" }
];

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  return res.status(200).json({ products });
};
