import { z } from "zod";
import type { ToolName } from "../schemas.ts";
export declare const ListAccountsInputSchema: z.ZodObject<{
    agent_id: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    agent_id?: string | undefined;
}, {
    agent_id?: string | undefined;
}>;
export declare const GetQueueStatusInputSchema: z.ZodObject<{
    account_id: z.ZodString;
    platform: z.ZodOptional<z.ZodEnum<["tiktok", "instagram", "youtube"]>>;
    agent_id: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    account_id: string;
    platform?: "tiktok" | "instagram" | "youtube" | undefined;
    agent_id?: string | undefined;
}, {
    account_id: string;
    platform?: "tiktok" | "instagram" | "youtube" | undefined;
    agent_id?: string | undefined;
}>;
export declare const PostNowInputSchema: z.ZodObject<{
    account_id: z.ZodString;
    platform: z.ZodEnum<["tiktok", "instagram", "youtube"]>;
    agent_id: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    account_id: string;
    platform: "tiktok" | "instagram" | "youtube";
    agent_id?: string | undefined;
}, {
    account_id: string;
    platform: "tiktok" | "instagram" | "youtube";
    agent_id?: string | undefined;
}>;
export declare const SchedulerControlInputSchema: z.ZodObject<{
    account_id: z.ZodString;
    platform: z.ZodEnum<["tiktok", "instagram", "youtube"]>;
    action: z.ZodEnum<["start", "stop"]>;
    agent_id: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    account_id: string;
    platform: "tiktok" | "instagram" | "youtube";
    action: "start" | "stop";
    agent_id?: string | undefined;
}, {
    account_id: string;
    platform: "tiktok" | "instagram" | "youtube";
    action: "start" | "stop";
    agent_id?: string | undefined;
}>;
export declare const SetScheduleInputSchema: z.ZodObject<{
    account_id: z.ZodString;
    platform: z.ZodEnum<["tiktok", "instagram", "youtube"]>;
    schedule: z.ZodUnion<[z.ZodObject<{
        type: z.ZodLiteral<"cron">;
        expression: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "cron";
        expression: string;
    }, {
        type: "cron";
        expression: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"daily-times">;
        times: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        type: "daily-times";
        times: string[];
    }, {
        type: "daily-times";
        times: string[];
    }>]>;
    agent_id: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    account_id: string;
    platform: "tiktok" | "instagram" | "youtube";
    schedule: {
        type: "cron";
        expression: string;
    } | {
        type: "daily-times";
        times: string[];
    };
    agent_id?: string | undefined;
}, {
    account_id: string;
    platform: "tiktok" | "instagram" | "youtube";
    schedule: {
        type: "cron";
        expression: string;
    } | {
        type: "daily-times";
        times: string[];
    };
    agent_id?: string | undefined;
}>;
export declare const SetInstantPostInputSchema: z.ZodObject<{
    account_id: z.ZodString;
    platform: z.ZodEnum<["tiktok", "instagram", "youtube"]>;
    enabled: z.ZodBoolean;
    agent_id: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    enabled: boolean;
    account_id: string;
    platform: "tiktok" | "instagram" | "youtube";
    agent_id?: string | undefined;
}, {
    enabled: boolean;
    account_id: string;
    platform: "tiktok" | "instagram" | "youtube";
    agent_id?: string | undefined;
}>;
export declare const ListAgentsInputSchema: z.ZodObject<{
    include_degraded: z.ZodDefault<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    include_degraded: boolean;
}, {
    include_degraded?: boolean | undefined;
}>;
export interface ToolDefinition {
    name: ToolName;
    description: string;
    inputSchema: z.ZodTypeAny;
    requiredScope: string;
    isLocal: boolean;
}
export declare const TOOLS: ToolDefinition[];
//# sourceMappingURL=mcp-tools.d.ts.map