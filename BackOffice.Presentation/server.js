const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 8080;
const DIST_DIR = path.join(__dirname, ".");

// Serve pre-compressed files (brotli > gzip > raw)
function serveCompressed(req, res, next) {
  const filePath = path.join(DIST_DIR, req.path);
  const acceptEncoding = req.headers["accept-encoding"] || "";

  // Try brotli first
  if (acceptEncoding.includes("br") && fs.existsSync(filePath + ".br")) {
    req.url = req.url + ".br";
    res.set("Content-Encoding", "br");
    res.set("Vary", "Accept-Encoding");
    // Set correct content type based on original file
    if (req.path.endsWith(".js")) res.set("Content-Type", "application/javascript");
    else if (req.path.endsWith(".css")) res.set("Content-Type", "text/css");
    else if (req.path.endsWith(".html")) res.set("Content-Type", "text/html");
    else if (req.path.endsWith(".json")) res.set("Content-Type", "application/json");
    else if (req.path.endsWith(".svg")) res.set("Content-Type", "image/svg+xml");
  }
  // Try gzip
  else if (acceptEncoding.includes("gzip") && fs.existsSync(filePath + ".gz")) {
    req.url = req.url + ".gz";
    res.set("Content-Encoding", "gzip");
    res.set("Vary", "Accept-Encoding");
    if (req.path.endsWith(".js")) res.set("Content-Type", "application/javascript");
    else if (req.path.endsWith(".css")) res.set("Content-Type", "text/css");
    else if (req.path.endsWith(".html")) res.set("Content-Type", "text/html");
    else if (req.path.endsWith(".json")) res.set("Content-Type", "application/json");
    else if (req.path.endsWith(".svg")) res.set("Content-Type", "image/svg+xml");
  }
  next();
}

// Cache-Control: hashed assets get 1 year, HTML gets no-cache
app.use("/assets", serveCompressed, express.static(path.join(DIST_DIR, "assets"), {
  maxAge: "1y",
  immutable: true,
  etag: true,
}));

// Other static files (images, fonts, etc.) - 1 week cache
app.use(serveCompressed, express.static(DIST_DIR, {
  maxAge: "7d",
  etag: true,
  index: false, // Don't auto-serve index.html for directories
}));

// SPA fallback - serve index.html for all non-file routes
app.get("*", (req, res) => {
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Snap POS Back Office running on port ${PORT}`);
});
