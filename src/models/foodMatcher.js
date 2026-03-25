// foodMatcher.js

// ===============================
// CONFIG
// ===============================

const EXPIRY_RULES = {
  cooked: 4 * 60 * 60 * 1000,
  raw: 24 * 60 * 60 * 1000,
  packaged: 7 * 24 * 60 * 60 * 1000
};

// ===============================
// 1️⃣ EXPIRY PREDICTION
// ===============================

function getExpiryTimestamp(foodType, preparedAt = Date.now()) {
  const duration = EXPIRY_RULES[foodType?.toLowerCase()];

  if (!duration) {
    throw new Error("Invalid food type");
  }

  return preparedAt + duration;
}

// ===============================
// 2️⃣ PRIORITY SCORING
// ===============================
// Higher score = more urgent

function getPriorityScore(expiryTimestamp, quantity) {
  const now = Date.now();
  const timeLeft = expiryTimestamp - now;

  if (timeLeft <= 0) return Infinity;

  const expiryScore = 1 / timeLeft;
  const quantityScore = Math.log1p(Math.max(0, quantity));

  return expiryScore * 1e6 + quantityScore;
}

// ===============================
// 3️⃣ HAVERSINE DISTANCE
// ===============================

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = deg => deg * (Math.PI / 180);

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

// ===============================
// 4️⃣ MATCHING ENGINE
// ===============================

function getBestMatches(food, ngos) {
  if (!food || !ngos) {
    throw new Error("Food and NGO data required");
  }

  const expiry = getExpiryTimestamp(
    food.type,
    food.preparedAt
  );

  const priorityScore = getPriorityScore(
    expiry,
    food.quantity
  );

  const now = Date.now();
  const isExpired = expiry <= now;

  const matches = ngos.map(ngo => {
    const distance = getDistanceKm(
      food.location.lat,
      food.location.lng,
      ngo.location.lat,
      ngo.location.lng
    );

    return {
      ngoId: ngo.id,
      ngoName: ngo.name,
      distanceKm: Number(distance.toFixed(2)),
      priorityScore,
      foodExpiry: expiry,
      isExpired
    };
  });

  // Sort by distance, then priority
  matches.sort((a, b) => {
    if (a.distanceKm !== b.distanceKm)
      return a.distanceKm - b.distanceKm;

    return b.priorityScore - a.priorityScore;
  });

  return matches.slice(0, 3);
}

// ===============================
// 5️⃣ OPTIONAL AI CATEGORY (SAFE)
// ===============================

async function categorizeFoodWithAI(description) {
  try {
    const OpenAI = require("openai");

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const prompt = `
Classify this food into ONE category only:
raw, cooked, or packaged.

Food: "${description}"

Answer only the category.
`;

    const response = await client.chat.completions.create({
      model: "gpt-5-nano",
      messages: [{ role: "user", content: prompt }]
    });

    return response.choices[0].message.content
      .trim()
      .toLowerCase();

  } catch (err) {
    // Fallback if API fails
    return "unknown";
  }
}

// ===============================
// EXPORTS
// ===============================

module.exports = {
  getExpiryTimestamp,
  getPriorityScore,
  getDistanceKm,
  getBestMatches,
  categorizeFoodWithAI
};