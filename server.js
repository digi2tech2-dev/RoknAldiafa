const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const reviewsFile = path.join(root, "reviews.json");
const port = process.env.PORT || 3000;

const defaultReviews = [];
const deletedReviews = [
  ["خالد", "مشاء الله عليكم"],
  ["احمد الشرقاوي", "افضل تعامل بصراحه وسرعه وافضل سعر شوفته ما شاء الله عليكم"]
];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".mp4": "video/mp4"
};

function readReviews() {
  try {
    const parsed = JSON.parse(fs.readFileSync(reviewsFile, "utf8"));
    const reviews = Array.isArray(parsed) ? parsed : defaultReviews;
    return reviews.filter((review) => !isDeletedReview(review));
  } catch {
    return defaultReviews;
  }
}

function isDeletedReview(review) {
  return deletedReviews.some(([name, message]) =>
    String(review.name || "").trim() === name &&
    String(review.message || "").trim() === message
  );
}

function writeReviews(reviews) {
  fs.writeFileSync(reviewsFile, JSON.stringify(reviews.slice(0, 50), null, 2), "utf8");
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10000) {
        req.destroy();
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function safeReview(input) {
  const name = String(input.name || "").trim().slice(0, 60);
  const message = String(input.message || "").trim().slice(0, 500);
  if (!name || !message) return null;
  if (isDeletedReview({ name, message })) return null;
  return {
    name,
    message,
    createdAt: new Date().toISOString()
  };
}

function serveStatic(req, res) {
  const decodedUrl = decodeURIComponent(req.url.split("?")[0]);
  const cleanPath = decodedUrl === "/" ? "/index.html" : decodedUrl;
  let filePath = path.normalize(path.join(root, cleanPath));

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000"
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/reviews")) {
    if (req.method === "GET") {
      sendJson(res, 200, readReviews());
      return;
    }

    if (req.method === "POST") {
      try {
        const review = safeReview(JSON.parse(await collectBody(req)));
        if (!review) {
          sendJson(res, 400, { error: "name and message are required" });
          return;
        }
        const reviews = [review, ...readReviews()].slice(0, 50);
        writeReviews(reviews);
        sendJson(res, 200, reviews);
      } catch {
        sendJson(res, 400, { error: "invalid request" });
      }
      return;
    }

    sendJson(res, 405, { error: "method not allowed" });
    return;
  }

  serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
