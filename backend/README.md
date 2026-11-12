# Krishak_Shayak_Backend

## Agentic AI advisor

The assistant is a Gemini agent with tool calling, hybrid RAG, long-term farmer memory, BullMQ background jobs and an evaluation harness. See [AI_AGENT.md](AI_AGENT.md) for architecture, setup and `npm run eval`.

## Data features

| Feature | Endpoint | Sources |
|---|---|---|
| Weather + soil moisture insights | `GET /api/weather`, `/hourly`, `/insights` | OpenWeatherMap, Open-Meteo, Gemini |
| Live mandi prices | `GET /api/market-prices` | data.gov.in (Agmarknet) |
| Crop recommendations | `GET /api/crops/recommendations?location=&lang=` | crop calendar (`data/cropCalendar.json`), OpenWeatherMap forecast, Open-Meteo soil moisture, data.gov.in prices, farmer memory |
| Agriculture news (Hindi/English) | `GET /api/news?lang=` | NewsData.io (server-side key); English headlines translated when Hindi is scarce |
| Government schemes (Hindi/English) | `GET /api/schemes?lang=` | Google Sheet; Hindi via cached Gemini translation |
| Secure payments | `POST /api/payments/create-order`, `/verify`, `/webhook` | Razorpay (server-side pricing, HMAC verification) |

