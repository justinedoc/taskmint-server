import type { TokenPayload } from "@/services/token.service.js";

export type AppBindings = {
  Variables: {
    student: TokenPayload;
  };
};
