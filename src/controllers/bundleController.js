import Bundle from "../models/Bundle.js";

export const getBundles = async (req, res) => {
  try {
    const { network } = req.query;

    const query = network
      ? { network: network.toUpperCase() }
      : {};

    const bundles = await Bundle.find(query);

    res.json(bundles);

  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch bundles",
      message: err.message
    });
  }
};