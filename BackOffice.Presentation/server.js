const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 8080;
const DIST_DIR = __dirname;

// Middleware to serve pre-compressed files
app.get("*.js", (req, res, next) => {
  const acceptEncoding = req.headers["accept-encoding"] || "";
  const filePath = path.join(DIST_DIR, req.path);
  
  if (acceptEncoding.includes("br")) {
    const brPath = filePath + ".br";
    if (fs.existsSync(brPath)) {
      res.set("Content-Type", "application/javascript");
      res.set("Content-Encoding", "br");
      res.set("Vary", "Accept-Encoding");
      res.set("Cache-Control", "public, max-age=31536000, immutable");
      return res.sendFile(brPath);
    }
  }
  if (acceptEncoding.includes("gzip")) {
    const gzPath = filePath + ".gz";
    if (fs.existsSync(gzPath)) {
      res.set("Content-Type", "application/javascript");
      res.set("Content-Encoding", "gzip");
      res.set("Vary", "Accept-Encoding");
      res.set("Cache-Control", "public, max-age=31536000, immutable");
      return res.sendFile(gzPath);
    }
  }
  next();
});

app.get("*.css", (req, res, next) => {
  const acceptEncoding = req.headers["accept-encoding"] || "";
  const filePath = path.join(DIST_DIR, req.path);
  
  if (acceptEncoding.includes("br")) {
    const brPath = filePath + ".br";
    if (fs.existsSync(brPath)) {
      res.set("Content-Type", "text/css");
      res.set("Content-Encoding", "br");
      res.set("Vary", "Accept-Encoding");
      res.set("Cache-Control", "public, max-age=31536000, immutable");
      return res.sendFile(brPath);
    }
  }
  if (acceptEncoding.includes("gzip")) {
    const gzPath = filePath + ".gz";
    if (fs.existsSync(gzPath)) {
      res.set("Content-Type", "text/css");
      res.set("Content-Encoding", "gzip");
      res.set("Vary", "Accept-Encoding");
      res.set("Cache-Control", "public, max-age=31536000, immutable");
      return res.sendFile(gzPath);
    }
  }
  next();
});

// Cache-Control: hashed assets get 1 year
app.use("/assets", express.static(path.join(DIST_DIR, "assets"), {
  maxAge: "365d",
  immutable: true,
  etag: true,
}));

// Other static files (images, fonts, etc.) - 1 week cache
app.use(express.static(DIST_DIR, {
  maxAge: "7d",
  etag: true,
  index: false,
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
