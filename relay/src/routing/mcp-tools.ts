import { z } from "zod";
import type { ToolName, Platform } from "../schemas.ts";

export const ListAccountsInputSchema = z.object({
  agent_id: z.string().optional(),
}).strict();

export const GetQueueStatusInputSchema = z.object({
  account_id: z.string().min(1).max(80),
  platform: z.enum(["tiktok", "instagram", "youtube"]).optional(),
  agent_id: z.string().optional(),
}).strict();

export const PostNowInputSchema = z.object({
  account_id: z.string().min(1).max(80),
  platform: z.enum(["tiktok", "instagram", "youtube"]),
  agent_id: z.string().optional(),
}).strict();

export const SchedulerControlInputSchema = z.object({
  account_id: z.string().min(1).max(80),
  platform: z.enum(["tiktok", "instagram", "youtube"]),
  action: z.enum(["start", "stop"]),
  agent_id: z.string().optional(),
}).strict();

export const SetScheduleInputSchema = z.object({
  account_id: z.string().min(1).max(80),
  platform: z.enum(["tiktok", "instagram", "youtube"]),
  schedule: z.union([
    z.object({ type: z.literal("cron"), expression: z.string().min(1).max(200) }),
    z.object({ type: z.literal("daily-times"), times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).min(1).max(24) }),
  ]),
  agent_id: z.string().optional(),
}).strict();

export const SetInstantPostInputSchema = z.object({
  account_id: z.string().min(1).max(80),
  platform: z.enum(["tiktok", "instagram", "youtube"]),
  enabled: z.boolean(),
  agent_id: z.string().optional(),
}).strict();

export const ListAgentsInputSchema = z.object({
  include_degraded: z.boolean().default(false),
}).strict();

export interface ToolDefinition {
  name: ToolName;
  description: string;
  inputSchema: z.ZodTypeAny;
  requiredScope: string;
  isLocal: boolean;
}

export const TOOLS: ToolDefinition[] = [
  {
    name: "list_agents",
    description: "List connected local AutoSocial agents available to the authenticated organization.",
    inputSchema: ListAgentsInputSchema,
    requiredScope: "mcp:read",
    isLocal: true,
  },
  {
    name: "list_accounts",
    description: "List accounts managed by a local agent.",
    inputSchema: ListAccountsInputSchema,
    requiredScope: "mcp:read",
    isLocal: false,
  },
  {
    name: "get_queue_status",
    description: "Return scheduler and queue status for one account and optionally one platform.",
    inputSchema: GetQueueStatusInputSchema,
    requiredScope: "mcp:read",
    isLocal: false,
  },
  {
    name: "post_now",
    description: "Ask the local agent to run the next queued post for an account and platform.",
    inputSchema: PostNowInputSchema,
    requiredScope: "mcp:write",
    isLocal: false,
  },
  {
    name: "scheduler_control",
    description: "Start or stop a platform scheduler.",
    inputSchema: SchedulerControlInputSchema,
    requiredScope: "mcp:write",
    isLocal: false,
  },
  {
    name: "set_schedule",
    description: "Set a cron schedule or daily time plan.",
    inputSchema: SetScheduleInputSchema,
    requiredScope: "mcp:write",
    isLocal: false,
  },
  {
    name: "set_instant_post",
    description: "Enable or disable the local queue watcher for a platform.",
    inputSchema: SetInstantPostInputSchema,
    requiredScope: "mcp:write",
    isLocal: false,
  },
];