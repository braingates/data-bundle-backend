import express from "express";
import { getBundles } from "../controllers/bundleController.js";

const router = express.Router();

// GET /api/bundles?network=MTN
router.get("/", getBundles);

export default router;