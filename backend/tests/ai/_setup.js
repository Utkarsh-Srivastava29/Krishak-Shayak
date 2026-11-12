/**
 * Lets the AI unit tests run before `npm install` (e.g. in CI sandboxes):
 * if a heavy dependency is missing, a tiny stand-in is used. When the real
 * package is installed, it is always preferred. The tests only exercise pure
 * logic and injected fakes, never the real network or database.
 */
const Module = require("module");

const STUBS = {
  "@google/genai": () => ({
    Type: { OBJECT: "OBJECT", STRING: "STRING", ARRAY: "ARRAY", INTEGER: "INTEGER", NUMBER: "NUMBER", BOOLEAN: "BOOLEAN" },
    GoogleGenAI: class {},
    ApiError: class ApiError extends Error {},
  }),
  mongoose: () => {
    class Schema {
      constructor() {
        this.methods = {};
        this.statics = {};
      }
      index() {}
      pre() {}
    }
    Schema.Types = { ObjectId: String, Mixed: Object };
    return { connection: { readyState: 0 }, Schema, model: () => ({}) };
  },
  axios: () => ({ get: async () => { throw new Error("network disabled in tests"); }, post: async () => ({}) }),
  ioredis: () => class { on() {} },
  papaparse: () => ({ parse: () => ({ data: [] }) }),
  jsonwebtoken: () => ({ verify: () => { throw new Error("stub"); } }),
  bcryptjs: () => ({}),
};

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (STUBS[request]) {
    try {
      Module._resolveFilename(request, parent, isMain);
    } catch {
      return STUBS[request]();
    }
  }
  return originalLoad.apply(this, arguments);
};
