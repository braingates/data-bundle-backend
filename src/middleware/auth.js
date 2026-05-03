export const verifyApiKey = (req, res, next) => {
  const key = req.headers["x-api-key"];

  if (!key || key !== process.env.API_KEY) {
    return res.status(403).json({
      success: false,
      message: "Unauthorized API request"
    });
  }

  next();
};