import { Router, Request, Response } from "express";

export const healthRouter = Router();

healthRouter.get("/health/live", (_req: Request, res: Response) => {
  res.json({ status: "live" });
});

healthRouter.get("/health/ready", (req: Request, res: Response) => {
  const server = req.app.get("relayServer");
  if (server?.isReady()) {
    res.json({ status: "ready" });
  } else {
    res.status(503).json({ status: "not_ready", reason: "shutting_down" });
  }
});