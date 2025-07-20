import { Server as IOServer } from "socket.io";

declare module "http" {
  interface ServerResponse {
    socket?: {
      server: {
        io?: IOServer;
      };
    };
  }
}
