/**
 * Broadcast Hook Middleware
 * SSE client management & Supabase Realtime broadcast
 */

import express from "express";
import { supabase } from "../config/supabase";
import { extractImagesFromPayload } from "../services/imageService";
import type { SseClient } from "../types/server";

let sseClients: SseClient[] = [];

// Initialize Supabase Realtime channel for broadcasting
const supabaseRealtimeChannel = supabase.channel("app-updates");
supabaseRealtimeChannel.subscribe((status) => {
  console.log(`[Supabase Realtime] Server subscription status: ${status}`);
});

export function broadcastStateUpdate() {
  // 1. Broadcast over Supabase Realtime
  supabaseRealtimeChannel.send({
    type: "broadcast",
    event: "state_changed",
    payload: { timestamp: Date.now() },
  }).then((res) => {
    console.log("[Supabase Realtime] Broadcast sent successfully:", res);
  }).catch((err) => {
    console.error("[Supabase Realtime] Broadcast error:", err);
  });

  // 2. Broadcast over SSE (as fallback)
  const message = `data: ${JSON.stringify({ type: "state_changed", timestamp: Date.now() })}\n\n`;
  sseClients.forEach(client => {
    try {
      client.res.write(message);
    } catch (e) {
      // Connection may have been closed
    }
  });
}

/**
 * Global hook to automatically broadcast database state changes on any successful POST/PUT/DELETE
 */
export function applyBroadcastHook(app: express.Application) {
  app.use((req, res, next) => {
    res.on("finish", () => {
      if (req.method !== "GET" && req.path.startsWith("/api/") && res.statusCode >= 200 && res.statusCode < 300) {
        if (!req.path.includes("/auth/login") && !req.path.includes("/auth/email-login") && !req.path.includes("/realtime-stream") && !req.path.includes("/supabase-config")) {
          setTimeout(() => {
            broadcastStateUpdate();
          }, 150);
        }
      }
    });
    next();
  });
}

/**
 * Disable caching for all API endpoints
 */
export function applyCacheControl(app: express.Application) {
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });
}

/**
 * Middleware to extract base64 images from any request payload
 */
export function applyImageExtractor(app: express.Application) {
  app.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.body && req.method !== "GET") {
      try {
        req.body = await extractImagesFromPayload(req.body, req.path, req.body);
      } catch (err) {
        console.error("Failed to extract images from request payload:", err);
      }
    }
    next();
  });
}

/**
 * SSE Realtime stream endpoint handler
 */
export function handleRealtimeStream(req: express.Request, res: express.Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const clientId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const newClient: SseClient = { id: clientId, res };
  sseClients.push(newClient);

  // Send connection acknowledgment
  res.write(`data: ${JSON.stringify({ type: "connected", clientId })}\n\n`);

  // Keep-alive heartbeat
  const keepAliveInterval = setInterval(() => {
    try {
      res.write(`: keep-alive\n\n`);
    } catch (e) {
      // Connection closed
    }
  }, 20000);

  req.on("close", () => {
    clearInterval(keepAliveInterval);
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
}
