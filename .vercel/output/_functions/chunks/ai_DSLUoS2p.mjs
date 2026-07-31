import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
//#region src/pages/api/ai.ts
var ai_exports = /* @__PURE__ */ __exportAll({
	POST: () => POST,
	prerender: () => false
});
var POST = async ({ request }) => {
	return new Response(JSON.stringify({ error: "AI Tutor is not configured. Set GEMINI_API_KEY in Vercel." }), {
		status: 503,
		headers: { "Content-Type": "application/json" }
	});
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/ai@_@ts
var page = () => ai_exports;
//#endregion
export { page };
