import { Request, Response, NextFunction } from "express";
import type { AuthPrincipal } from "../schemas.ts";
export interface AuthRequest extends Request {
    auth?: AuthPrincipal;
}
export declare function createAuthMiddleware(authenticator: (key: string) => AuthPrincipal | null): (req: AuthRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare function requireScopeMiddleware(scope: string): (req: AuthRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare function createWsAuth(authenticator: (key: string) => AuthPrincipal | null): (req: any, ws: any, next: (err?: Error) => void) => void;
//# sourceMappingURL=middleware.d.ts.map