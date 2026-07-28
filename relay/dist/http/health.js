import { Router } from "express";
export const healthRouter = Router();
healthRouter.get("/health/live", (_req, res) => {
    res.json({ status: "live" });
});
healthRouter.get("/health/ready", (req, res) => {
    const server = req.app.get("relayServer");
    if (server?.isReady()) {
        res.json({ status: "ready" });
    }
    else {
        res.status(503).json({ status: "not_ready", reason: "shutting_down" });
    }
});
//# sourceMappingURL=health.js.map