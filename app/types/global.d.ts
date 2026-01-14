import { Server as IOServer } from "socket.io";
import { Server as HTTPServer } from "http";

declare module "http" {
  interface Server {
    io?: IOServer;
  }
}

declare module "net" {
  interface Socket {
    server: HTTPServer & { io?: IOServer };
  }
}
