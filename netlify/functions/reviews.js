const defaultReviews = [];
const deletedReviews = [
  ["خالد", "مشاء الله عليكم"],
  ["احمد الشرقاوي", "افضل تعامل بصراحه وسرعه وافضل سعر شوفته ما شاء الله عليكم"]
];

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

function cleanReview(input) {
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

function isDeletedReview(review) {
  return deletedReviews.some(([name, message]) =>
    String(review.name || "").trim() === name &&
    String(review.message || "").trim() === message
  );
}

async function getStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore("roknaldiyafa-reviews");
}

async function readReviews() {
  try {
    const store = await getStore();
    const reviews = await store.get("reviews", { type: "json" });
    return (Array.isArray(reviews) ? reviews : defaultReviews)
      .filter((review) => !isDeletedReview(review));
  } catch {
    return defaultReviews;
  }
}

async function writeReviews(reviews) {
  const store = await getStore();
  await store.setJSON("reviews", reviews.slice(0, 50));
}

exports.handler = async (event) => {
  if (event.httpMethod === "GET") {
    return json(200, await readReviews());
  }

  if (event.httpMethod === "POST") {
    try {
      const review = cleanReview(JSON.parse(event.body || "{}"));
      if (!review) return json(400, { error: "name and message are required" });

      const reviews = [review, ...(await readReviews())].slice(0, 50);
      await writeReviews(reviews);
      return json(200, reviews);
    } catch {
      return json(400, { error: "invalid request" });
    }
  }

  return json(405, { error: "method not allowed" });
};
