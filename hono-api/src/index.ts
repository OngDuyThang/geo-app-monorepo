import type { IncomingRequestCfProperties } from "@cloudflare/workers-types";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { cors } from "hono/cors";

const app = new OpenAPIHono();
app.use("/*", cors());

// --- 1. HELPERS ---

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function reverseGeocode(lat: number, lon: number) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "MyEdgeBlogDemo/1.0" },
    });
    const data = (await res.json()) as any;
    return { display_name: data.display_name, address: data.address };
  } catch (e) {
    return { display_name: "Unknown Location", address: {} };
  }
}

// --- 2. SCHEMAS ---

const StoreItemSchema = z.object({
  name: z.string(),
  distance_km: z.number(),
  address: z.string(),
  coordinates: z.object({ lat: z.number(), lon: z.number() }),
});

const StoreResponseSchema = z.object({
  brand: z.string(),
  found: z.boolean(),
  count: z.number(),
  stores: z.array(StoreItemSchema),
  message: z.string(),
});

const GeoResponseSchema = z.object({
  coordinates: z.object({ lat: z.number(), lon: z.number() }),
  formatted_address: z.string(),
});

// --- 3. ROUTES ---

const indexRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      content: { "application/json": { schema: GeoResponseSchema } },
      description: "My Location",
    },
  },
});

const circleKRoute = createRoute({
  method: "get",
  path: "/stores/circle-k",
  responses: {
    200: {
      content: { "application/json": { schema: StoreResponseSchema } },
      description: "List of Circle Ks",
    },
  },
});

const familyMartRoute = createRoute({
  method: "get",
  path: "/stores/family-mart",
  responses: {
    200: {
      content: { "application/json": { schema: StoreResponseSchema } },
      description: "List of FamilyMarts",
    },
  },
});

const otherStoreRoute = createRoute({
  method: "get",
  path: "/stores/others",
  responses: {
    200: {
      content: { "application/json": { schema: StoreResponseSchema } },
      description: "List of Other Stores",
    },
  },
});

// --- 4. IMPLEMENTATION ---

function getUserCoords(c: any) {
  // Mock default to Ho Chi Minh City if header is missing
  const cf = (c.req.raw as unknown as { cf: IncomingRequestCfProperties }).cf;
  const lat = parseFloat(cf?.latitude || "10.7769");
  const lon = parseFloat(cf?.longitude || "106.7009");
  return { lat, lon };
}

// Fetch ALL convenience stores first (No name filter in query)
async function fetchAllConvenienceStores(lat: number, lon: number) {
  const query = `
    [out:json][timeout:15];
    (
      node["shop"="convenience"](around:5000,${lat},${lon});
      way["shop"="convenience"](around:5000,${lat},${lon});
    );
    out center;
  `;
  try {
    const res = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(
        query
      )}`
    );
    const data = (await res.json()) as any;
    return data.elements || [];
  } catch (e) {
    console.error("OSM Fetch Error", e);
    return [];
  }
}

async function handleStoreSearch(
  c: any,
  brandRegex: RegExp,
  displayName: string
) {
  const { lat, lon } = getUserCoords(c);

  // 1. Fetch generic stores
  const allStores = await fetchAllConvenienceStores(lat, lon);

  // 2. Filter stores using Regex
  const filtered = allStores.filter((el: any) => {
    const name = el.tags?.name;
    const hasAddress = Object.keys(el.tags).some((k) => k.startsWith("addr:"));
    // Check if name matches our brand regex and has an address
    return name && brandRegex.test(name) && hasAddress;
  });

  if (filtered.length === 0) {
    return c.json(
      {
        brand: displayName,
        found: false,
        count: 0,
        stores: [],
        message: "None found in 5km",
      },
      200
    );
  }

  // 3. Map & Calculate Distance
  const results = filtered.map((el: any) => {
    const sLat = el.center ? el.center.lat : el.lat;
    const sLon = el.center ? el.center.lon : el.lon;
    const dist = getDistance(lat, lon, sLat, sLon);

    const tags = el.tags || {};
    const addr =
      [
        `${tags["addr:housenumber"] || ""} ${tags["addr:street"] || ""}`,
        tags["addr:subdistrict"] || "",
        tags["addr:city"] || "",
        tags["addr:province"] || "",
      ]
        .filter((str) => str.trim() !== "")
        .join(", ")
        .trim() ||
      tags["addr:full"] ||
      "Street unknown";

    return {
      name: tags.name || displayName,
      distance_km: Number(dist.toFixed(2)),
      address: addr,
      coordinates: { lat: sLat, lon: sLon },
    };
  });

  // 4. Sort
  results.sort((a: any, b: any) => a.distance_km - b.distance_km);

  return c.json(
    {
      brand: displayName,
      found: true,
      count: results.length,
      stores: results,
      message: `Found ${results.length} stores within 5km`,
    },
    200
  );
}

// --- 5. Apply Routes ---

const routes = app
  .openapi(indexRoute, async (c) => {
    const { lat, lon } = getUserCoords(c);
    const info = await reverseGeocode(lat, lon);
    return c.json(
      {
        coordinates: { lat, lon },
        formatted_address: info.display_name,
      },
      200
    );
  })
  .openapi(circleKRoute, (c) =>
    // Regex: Matches "Circle K", "CircleK", case-insensitive
    handleStoreSearch(c, /Circle\s?K/i, "Circle K")
  )
  .openapi(familyMartRoute, (c) =>
    // Regex: Matches "FamilyMart", "Family Mart", case-insensitive
    handleStoreSearch(c, /Family\s?Mart/i, "FamilyMart")
  )
  .openapi(otherStoreRoute, (c) =>
    handleStoreSearch(
      c,
      /^(?!.*(?:Circle\s?K|Family\s?Mart)).*$/i,
      "Other Stores"
    )
  );

export default app;
export type AppType = typeof routes;
