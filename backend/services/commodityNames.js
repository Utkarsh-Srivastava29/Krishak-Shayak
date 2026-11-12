/**
 * Farmers name crops in Hindi, Hinglish or English ("gehun", "गेहूं", "wheat"),
 * while the data.gov.in mandi feed uses Agmarknet names
 * ("Paddy(Dhan)(Common)"). This table resolves those aliases to a canonical
 * crop and the words used to match it in the mandi feed.
 */
const COMMODITIES = [
  { canonical: "wheat", aliases: ["wheat", "gehun", "gehu", "gehoon", "गेहूं", "गेहूँ"], match: ["wheat"] },
  // Before paddy so "basmati paddy" resolves here; basmati sells far above common paddy
  { canonical: "basmati", aliases: ["basmati", "बासमती"], match: ["basmati"] },
  { canonical: "paddy", aliases: ["paddy", "dhan", "dhaan", "धान"], match: ["paddy"], exclude: ["basmati"] },
  { canonical: "rice", aliases: ["rice", "chawal", "चावल"], match: ["rice"] },
  { canonical: "mustard", aliases: ["mustard", "sarson", "sarso", "सरसों", "rapeseed"], match: ["mustard"] },
  { canonical: "soyabean", aliases: ["soyabean", "soybean", "soya", "सोयाबीन"], match: ["soyabean", "soybean"] },
  { canonical: "cotton", aliases: ["cotton", "kapas", "कपास"], match: ["cotton", "kapas"] },
  { canonical: "maize", aliases: ["maize", "corn", "makka", "makki", "मक्का"], match: ["maize"] },
  { canonical: "gram", aliases: ["gram", "chana", "chickpea", "चना"], match: ["bengal gram"] },
  { canonical: "arhar", aliases: ["arhar", "tur", "toor", "pigeon pea", "अरहर"], match: ["arhar", "tur", "red gram"], exclude: ["fali"] },
  { canonical: "moong", aliases: ["moong", "mung", "green gram", "मूंग"], match: ["moong", "green gram"] },
  { canonical: "masur", aliases: ["masur", "masoor", "lentil", "मसूर"], match: ["masur", "lentil"] },
  { canonical: "urad", aliases: ["urad", "black gram", "उड़द"], match: ["urad", "urd", "black gram"] },
  { canonical: "bajra", aliases: ["bajra", "pearl millet", "बाजरा"], match: ["bajra", "pearl millet"] },
  { canonical: "jowar", aliases: ["jowar", "sorghum", "ज्वार"], match: ["jowar", "sorghum"] },
  { canonical: "groundnut", aliases: ["groundnut", "peanut", "moongphali", "मूंगफली"], match: ["groundnut"] },
  { canonical: "sugarcane", aliases: ["sugarcane", "ganna", "गन्ना"], match: ["sugarcane"] },
  { canonical: "potato", aliases: ["potato", "aloo", "alu", "आलू"], match: ["potato"], exclude: ["sweet potato"] },
  { canonical: "onion", aliases: ["onion", "pyaz", "pyaaz", "प्याज"], match: ["onion"], exclude: ["onion green"] },
  { canonical: "tomato", aliases: ["tomato", "tamatar", "टमाटर"], match: ["tomato"] },
  { canonical: "garlic", aliases: ["garlic", "lahsun", "लहसुन"], match: ["garlic"] },
  { canonical: "barley", aliases: ["barley", "jau", "जौ"], match: ["barley", "jau"] },
];

const normalize = (text = "") => text.toString().trim().toLowerCase();

/** Returns the commodity entry for a farmer's word, or null. */
const resolveCommodity = (name) => {
  const value = normalize(name);
  if (!value) return null;
  return (
    COMMODITIES.find((c) => c.aliases.includes(value)) ||
    COMMODITIES.find((c) => c.aliases.some((alias) => value.includes(alias))) ||
    null
  );
};

/** Canonical crop key, falling back to the cleaned input. */
const canonicalCrop = (name) => resolveCommodity(name)?.canonical || normalize(name);

// Processed products are priced very differently from the raw crop a farmer
// sells (e.g. "Black Gram Dal" vs "Black Gram(Urd Beans)(Whole)").
const PROCESSED = ["dal", "atta", "oil", "bran", "flour", "powder"];

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word match, so "tur" doesn't hit "Turnip" or "Turmeric". */
const hasWord = (field, term) => new RegExp(`(^|[^a-z])${escapeRegex(term)}([^a-z]|$)`).test(field);

/** Does a mandi record's commodity field refer to this crop? */
const recordMatchesCommodity = (recordCommodity, name) => {
  const entry = resolveCommodity(name);
  const field = normalize(recordCommodity);
  const asked = normalize(name);
  const terms = entry ? entry.match : [asked];
  if (!terms.some((term) => hasWord(field, term))) return false;
  if ((entry?.exclude || []).some((term) => hasWord(field, term))) return false;
  // Raw crop and processed product ("chana" vs "chana dal") are different
  // markets: the processed word must appear in both or in neither.
  return PROCESSED.every((word) => hasWord(field, word) === hasWord(asked, word));
};

module.exports = { COMMODITIES, resolveCommodity, canonicalCrop, recordMatchesCommodity };
