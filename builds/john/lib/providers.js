// Model providers for background workers (never the web request path; free tier: no paid calls by default).
// One adapter for every OpenAI-compatible chat API, with presets. Pick with LLM_PROVIDER and LLM_MODEL; keys come from
// each preset's environment variable. Nothing is called unless a worker is run with a provider configured.
//   const P = require("./lib/providers"); const llm = P.create("ollama"); await llm.chat([{role:"user",content:"hi"}])
//
// Cline's free models only work inside the Cline extension and CLI (no API), so Cline is a driver for the loop, not a
// provider here: run `npm run lab -- explore ...` from Cline the same way you would from Claude Code.
const { createRegistry } = require("./registry");
const providers = createRegistry("model provider", { required: ["id", "about", "base", "make"] });

const openaiCompatible = (preset) => ({
  ...preset,
  make: ({ model, base, key, timeoutMs = 120000 } = {}) => {
    const url = (base || process.env[preset.baseEnv || ""] || preset.base).replace(/\/$/, "");
    const apiKey = key ?? (preset.keyEnv ? process.env[preset.keyEnv] : "");
    const m = model || process.env.LLM_MODEL || preset.model;
    if (preset.keyEnv && !apiKey) throw new Error(`Set ${preset.keyEnv} to use ${preset.id}`);
    const resolvedUrl = url.replace("{account}", process.env.CLOUDFLARE_ACCOUNT_ID || "{account}");
    if (resolvedUrl.includes("{account}")) throw new Error("Set CLOUDFLARE_ACCOUNT_ID to use cloudflare");
    return {
      id: preset.id, model: m,
      async chat(messages, { temperature = 0, max_tokens = 800, json = false } = {}) {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
          const r = await fetch(`${resolvedUrl}/chat/completions`, { method: "POST", signal: ctrl.signal,
            headers: { "content-type": "application/json", ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}), ...(preset.headers || {}) },
            body: JSON.stringify({ model: m, messages, temperature, max_tokens, ...(json ? { response_format: { type: "json_object" } } : {}) }) });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(`${preset.id} ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
          return d.choices?.[0]?.message?.content ?? "";
        } finally { clearTimeout(t); }
      },
    };
  },
});

// Local first: a Mac mini (Apple silicon) runs Gemma with Ollama or LM Studio for free.
providers.register(openaiCompatible({ id: "ollama", about: "Local Ollama (Mac mini or any machine): free; default Gemma 3 12B (multimodal)", base: "http://localhost:11434/v1", baseEnv: "OLLAMA_BASE", model: "gemma3:12b" }));
providers.register(openaiCompatible({ id: "lmstudio", about: "Local LM Studio server (MLX models on Apple silicon): free", base: "http://localhost:1234/v1", baseEnv: "LMSTUDIO_BASE", model: "google/gemma-3-12b" }));
// Free tiers and commodity APIs (each needs its own key; set a budget on the provider side).
providers.register(openaiCompatible({ id: "openrouter", about: "OpenRouter: ':free' models (about 50 requests a day free)", base: "https://openrouter.ai/api/v1", keyEnv: "OPENROUTER_API_KEY", model: "google/gemma-3-12b-it:free", headers: { "X-Title": "Superintelligence Homepage lab" } }));
providers.register(openaiCompatible({ id: "vercel-ai-gateway", about: "Vercel AI Gateway: free-tier models, no markup on paid tokens", base: "https://ai-gateway.vercel.sh/v1", keyEnv: "AI_GATEWAY_API_KEY", model: "google/gemma-3-12b" }));
providers.register(openaiCompatible({ id: "cloudflare", about: "Cloudflare Workers AI: 10,000 Neurons a day free", base: "https://api.cloudflare.com/client/v4/accounts/{account}/ai/v1", keyEnv: "CLOUDFLARE_API_TOKEN", model: "@cf/google/gemma-3-12b-it" }));
providers.register(openaiCompatible({ id: "groq", about: "Groq: generous free tier on small open models", base: "https://api.groq.com/openai/v1", keyEnv: "GROQ_API_KEY", model: "llama-3.1-8b-instant" }));

// Pull the first JSON object out of a model reply (models often wrap it in prose or code fences).
function parseJson(text) {
  const s = String(text); const start = s.indexOf("{"); if (start < 0) throw new Error("No JSON in the reply");
  for (let end = s.lastIndexOf("}"); end > start; end = s.lastIndexOf("}", end - 1)) { try { return JSON.parse(s.slice(start, end + 1)); } catch {} }
  throw new Error("Couldn't parse JSON from the reply");
}

const create = (id = process.env.LLM_PROVIDER, opts = {}) => { if (!id) throw new Error("Set LLM_PROVIDER (ollama, lmstudio, openrouter, vercel-ai-gateway, cloudflare, groq)"); return providers.create(id, opts); };
module.exports = { providers, create, parseJson, openaiCompatible };
