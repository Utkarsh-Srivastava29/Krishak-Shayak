const { Type } = require("@google/genai");
const { CATEGORY_KEYWORDS } = require("../rag/knowledgeSource");

/**
 * Tools the farm agent can call. Each tool has:
 *   declaration   - Gemini function declaration (what the model sees)
 *   status        - short progress text streamed to the farmer
 *   handler       - (args, ctx) => JSON result returned to the model
 *   confirm       - write actions: never run by the agent itself; the farmer
 *                   must tap Confirm in the app
 *   executor      - "client" (runs in the browser, e.g. cart) or "server"
 *
 * ctx = { userId, profile, retrieval: { useVector, useRerank }, deps }
 * `deps` lets the evaluation swap live APIs for fixtures.
 */

const PRODUCT_CATEGORIES = ["vegetables", "fruits", "grains", "dairy", "tools", "seeds", "fertilizers", "equipment"];

const defaultLocation = (args, ctx) => args.location || ctx.profile?.district || ctx.profile?.village || null;

const toolSpecs = {
  get_weather_forecast: {
    status: { en: "Checking the weather forecast…", hi: "मौसम का पूर्वानुमान देख रहा हूँ…" },
    declaration: {
      name: "get_weather_forecast",
      description:
        "Current weather and a 5-day daily forecast (temperature, rain in mm, chance of rain, wind) for a village, town or district in India. Use before advising on spraying, irrigation, sowing, harvesting or selling.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          location: { type: Type.STRING, description: "Town or district, e.g. 'Etawah' or 'Kanpur, Uttar Pradesh'. Leave empty to use the farmer's saved district." },
        },
      },
    },
    handler: async (args, ctx) => {
      const location = defaultLocation(args, ctx);
      if (!location) return { error: "Location unknown. Ask the farmer for their district." };
      const { getForecast } = ctx.deps?.weather || require("../services/weatherService");
      const forecast = await getForecast(location);
      return forecast || { error: `Could not find the place "${location}".` };
    },
  },

  get_mandi_prices: {
    status: { en: "Checking mandi prices…", hi: "मंडी भाव देख रहा हूँ…" },
    declaration: {
      name: "get_mandi_prices",
      description:
        "Today's mandi (APMC market) prices for one crop from the government Agmarknet feed: average, lowest and highest modal price across markets and the best-paying markets, in ₹ per quintal. Use for any question about crop prices or when to sell.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          commodity: { type: Type.STRING, description: "Crop name in English or Hindi, e.g. 'wheat', 'gehun', 'sarson'." },
          state: { type: Type.STRING, description: "Indian state, e.g. 'Uttar Pradesh'. Leave empty to use the farmer's saved state." },
          district: { type: Type.STRING, description: "Optional district to narrow the markets." },
        },
        required: ["commodity"],
      },
    },
    handler: async (args, ctx) => {
      const state = args.state || ctx.profile?.state;
      if (!state) return { error: "State unknown. Ask the farmer which state they sell in." };
      const { getCropPrices } = ctx.deps?.prices || require("../services/marketPriceService");
      const prices = await getCropPrices({
        commodity: args.commodity,
        state,
        district: args.district || (args.state ? undefined : ctx.profile?.district),
      });
      if (!prices) return { error: `No mandi reported ${args.commodity} prices in ${state} today.` };

      if (!ctx.deps) {
        // Build our own price history: the government feed only has today.
        require("../alerts/priceHistory").recordSnapshot(prices).catch(() => {});
      }
      const trend = ctx.deps?.priceTrend || require("../alerts/priceHistory").getPriceTrend;
      const change = await trend(prices.commodity, prices.state).catch(() => null);
      return change ? { ...prices, weeklyChange: change } : prices;
    },
  },

  search_knowledge: {
    status: { en: "Searching government schemes…", hi: "सरकारी योजनाएँ खोज रहा हूँ…" },
    declaration: {
      name: "search_knowledge",
      description:
        "Search the verified catalogue of central and state government schemes for farmers (subsidies, insurance, loans, income support, irrigation, solar pumps, dairy, fisheries…). Always use this before naming any scheme, eligibility rule or benefit.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: "What the farmer needs, in English, e.g. 'crop insurance for wheat', 'subsidy for drip irrigation'." },
          state: { type: Type.STRING, description: "Farmer's state, to include state schemes. Leave empty to use the saved state." },
          category: { type: Type.STRING, enum: Object.keys(CATEGORY_KEYWORDS), description: "Optional topic filter." },
        },
        required: ["query"],
      },
    },
    handler: async (args, ctx) => {
      const { hybridSearch } = ctx.deps?.retriever || require("../rag/retriever");
      const { results, mode } = await hybridSearch(args.query, {
        state: args.state || ctx.profile?.state,
        category: args.category,
        useVector: ctx.retrieval?.useVector !== false,
        useRerank: ctx.retrieval?.useRerank !== false,
      });
      ctx.citations?.push(...results.map((r) => ({ title: r.title, url: r.url })));
      return {
        retrieval: mode,
        results: results.map((r) => ({ title: r.title, officialLink: r.url, details: r.text })),
        note: results.length ? undefined : "No matching scheme in the catalogue.",
      };
    },
  },

  get_soil_moisture: {
    status: { en: "Checking soil moisture…", hi: "मिट्टी की नमी देख रहा हूँ…" },
    declaration: {
      name: "get_soil_moisture",
      description: "Modelled root-zone soil moisture and soil temperature for a place (from Open-Meteo). Use for irrigation questions.",
      parameters: {
        type: Type.OBJECT,
        properties: { location: { type: Type.STRING, description: "Town or district. Leave empty for the saved district." } },
      },
    },
    handler: async (args, ctx) => {
      const location = defaultLocation(args, ctx);
      if (!location) return { error: "Location unknown. Ask the farmer for their district." };
      const weather = ctx.deps?.weather || require("../services/weatherService");
      const place = await weather.geocode(location);
      if (!place) return { error: `Could not find the place "${location}".` };
      const { getSoilMoisture } = ctx.deps?.soil || require("../services/soilMoistureService");
      return { place: place.name, ...(await getSoilMoisture(place.lat, place.lon)) };
    },
  },

  recommend_crops: {
    status: { en: "Working out which crops suit your field…", hi: "आपके खेत के लिए उपयुक्त फसलें देख रहा हूँ…" },
    declaration: {
      name: "recommend_crops",
      description:
        "Rank crops the farmer can sow now or next month at a place, using the crop calendar, the live 5-day weather forecast, soil moisture, the farmer's irrigation and soil (from memory) and today's mandi prices. Use for 'what should I sow / which crop is best now' questions.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          location: { type: Type.STRING, description: "Town or district. Leave empty for the saved district." },
          limit: { type: Type.INTEGER, description: "How many crops to return (1-6). Default 4." },
        },
      },
    },
    handler: async (args, ctx) => {
      const location = defaultLocation(args, ctx);
      if (!location) return { error: "Location unknown. Ask the farmer for their district." };
      const { getCropRecommendations } = require("../services/cropRecommendationService");
      const limit = Math.min(Math.max(parseInt(args.limit, 10) || 4, 1), 6);
      const result = await getCropRecommendations({ location, profile: ctx.profile || {}, limit, deps: ctx.deps || {} });
      if (!result) return { error: `Could not find the place "${location}".` };
      return {
        ...result,
        recommendations: result.recommendations.map((r) => ({ ...r, reasons: r.reasons.map((x) => x.code) })),
      };
    },
  },

  search_marketplace: {
    status: { en: "Searching the marketplace…", hi: "बाज़ार में खोज रहा हूँ…" },
    declaration: {
      name: "search_marketplace",
      description: "Find seeds, fertiliser, tools and equipment sold on the Krishak Sahayak marketplace, with price and stock.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: "Product search words, e.g. 'mustard seed', 'urea', 'sprayer'." },
          category: { type: Type.STRING, enum: PRODUCT_CATEGORIES },
          maxPrice: { type: Type.NUMBER, description: "Optional maximum price in ₹." },
        },
        required: ["query"],
      },
    },
    handler: async (args, ctx) => {
      if (ctx.deps?.products) return ctx.deps.products(args);
      const Product = require("../models/Product");
      const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const words = args.query.split(/\s+/).filter(Boolean).map(escape);
      const query = { isActive: true, stock: { $gt: 0 } };
      if (words.length) {
        query.$or = words.flatMap((w) => [
          { name: { $regex: w, $options: "i" } },
          { description: { $regex: w, $options: "i" } },
        ]);
      }
      if (args.category) query.category = args.category;
      if (args.maxPrice) query.price = { $lte: args.maxPrice };
      const products = await Product.find(query).limit(5).select("name price unitType stock category sellerName").lean();
      return {
        products: products.map((p) => ({
          productId: String(p._id),
          name: p.name,
          price: p.price,
          unit: p.unitType,
          inStock: p.stock,
          seller: p.sellerName,
        })),
      };
    },
  },

  add_to_cart: {
    status: { en: "Preparing your cart…", hi: "कार्ट तैयार कर रहा हूँ…" },
    confirm: true,
    executor: "client",
    requiresLogin: true,
    summarize: (args) => `Add ${args.quantity || 1} × ${args.productName || "item"} to cart`,
    declaration: {
      name: "add_to_cart",
      description:
        "Propose adding a marketplace product to the farmer's cart. The farmer must confirm in the app before anything is added. Only use a productId returned by search_marketplace.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          productId: { type: Type.STRING },
          productName: { type: Type.STRING },
          quantity: { type: Type.INTEGER },
        },
        required: ["productId", "productName"],
      },
    },
  },

  log_farm_activity: {
    status: { en: "Preparing a farm note…", hi: "खेत का नोट तैयार कर रहा हूँ…" },
    confirm: true,
    executor: "server",
    requiresLogin: true,
    summarize: (args) => `Save to farm diary: ${args.activity}${args.date ? ` (${args.date})` : ""}`,
    declaration: {
      name: "log_farm_activity",
      description:
        "Propose saving a farm activity or plan to the farmer's farm diary (e.g. 'sprayed neem oil on wheat', 'plan to irrigate mustard on Friday'). The farmer must confirm. Saved activities are used for later advice and alerts.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          activity: { type: Type.STRING, description: "Short sentence in English." },
          crop: { type: Type.STRING },
          date: { type: Type.STRING, description: "YYYY-MM-DD" },
          isPlanned: { type: Type.BOOLEAN, description: "true for a future plan." },
        },
        required: ["activity"],
      },
    },
    execute: async (args, { userId }) => {
      const { addMemory } = require("../memory/memoryService");
      await addMemory(
        userId,
        {
          kind: "episodic",
          text: args.activity,
          eventDate: args.date && !Number.isNaN(Date.parse(args.date)) ? new Date(args.date) : new Date(),
          isPlanned: Boolean(args.isPlanned),
        },
        "action"
      );
      return { saved: true };
    },
  },
};

/** Declarations for the tools enabled in this run. */
const getDeclarations = (names = Object.keys(toolSpecs)) =>
  names.filter((n) => toolSpecs[n]).map((n) => toolSpecs[n].declaration);

module.exports = { toolSpecs, getDeclarations, PRODUCT_CATEGORIES };
