// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
var MemStorage = class {
  bookings;
  currentId;
  constructor() {
    this.bookings = /* @__PURE__ */ new Map();
    this.currentId = 1;
  }
  async createBooking(insertBooking) {
    const id = this.currentId++;
    const booking = {
      ...insertBooking,
      id,
      status: "pending"
    };
    this.bookings.set(id, booking);
    return booking;
  }
  async getBookings() {
    return Array.from(this.bookings.values());
  }
  async getBookingsByDate(date) {
    return Array.from(this.bookings.values()).filter(
      (booking) => booking.date.toDateString() === date.toDateString()
    );
  }
};
var storage = new MemStorage();

// shared/schema.ts
import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  service: text("service").notNull(),
  date: timestamp("date").notNull(),
  status: text("status").default("pending")
});
var insertBookingSchema = createInsertSchema(bookings).pick({
  name: true,
  email: true,
  service: true,
  date: true
});

// server/routes.ts
function registerRoutes(app2) {
  app2.post("/api/bookings", async (req, res) => {
    try {
      const booking = insertBookingSchema.parse(req.body);
      const result = await storage.createBooking(booking);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: "Invalid booking data" });
    }
  });
  app2.get("/api/bookings", async (req, res) => {
    const bookings2 = await storage.getBookings();
    res.json(bookings2);
  });
  app2.get("/api/bookings/date/:date", async (req, res) => {
    const date = new Date(req.params.date);
    const bookings2 = await storage.getBookingsByDate(date);
    res.json(bookings2);
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2, { dirname as dirname2 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var vite_config_default = defineConfig({
  plugins: [react(), runtimeErrorOverlay(), themePlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared")
    }
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = dirname2(__filename2);
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        __dirname2,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(__dirname2, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const PORT = 5e3;
  let serverInstance;
  function startServer(port) {
    serverInstance = app.listen(port, "0.0.0.0", () => {
      log(`serving on port ${port}`);
    });
    serverInstance.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.log(`Port ${port} is in use, attempting to find an available port.`);
        findAvailablePort(port + 1);
      } else {
        console.error("Server error:", err);
      }
    });
  }
  function findAvailablePort(port) {
    const maxAttempts = 10;
    let attempt = 0;
    const interval = setInterval(() => {
      if (attempt >= maxAttempts) {
        clearInterval(interval);
        console.error(`Could not find an available port after ${maxAttempts} attempts`);
        process.exit(1);
      }
      const testServer = app.listen(port, "0.0.0.0", () => {
        log(`serving on port ${port}`);
        clearInterval(interval);
        serverInstance = testServer;
      }).on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.log(`Port ${port} is in use, trying ${port + 1}`);
        } else {
          console.error("Server error:", err);
          clearInterval(interval);
          process.exit(1);
        }
        attempt++;
      });
    }, 100);
  }
  startServer(PORT);
})();
