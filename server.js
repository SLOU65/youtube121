import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./api/routers.js";
import { createContext } from "./api/_core/context.js";
import path from "path";
import { fileURLToPath } from "url";

// Helper for __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Server Setup ---
async function startServer() {
  const app = express();
  const server = createServer(app);

  // Configure body parser
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Serve static files (Production mode)
  const distPath = path.join(__dirname, "dist", "public");
  
  // Check if the build directory exists
  if (!fs.existsSync(distPath)) {
    console.error(`Could not find the build directory: ${distPath}. Run 'pnpm build' first.`);
    // We don't exit here, as the build might be done by Render before start
  }

  app.use(express.static(distPath));

  // Fall through to index.html for client-side routing
  app.use("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  // Get port from environment or default to 3000
  const port = parseInt(process.env.PORT || "3000");

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

// We need to import fs synchronously, which is not possible in ES modules top-level.
// We will use a simple require here for stability.
import fs from "fs";

startServer().catch(console.error);
