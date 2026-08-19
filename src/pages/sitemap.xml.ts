import type { APIRoute } from 'astro';
import { RoadmapSchema, type Roadmap } from '../lib/security';

export const GET: APIRoute = async ({ site }) => {
  const baseUrl = site ?? 'https://cosmic-nu-ebon.vercel.app';
  
  // Load all roadmaps dynamically
  const modules = import.meta.glob('../content/roadmaps/*.json', { eager: true });
  
  const roadmaps: Roadmap[] = Object.values(modules)
    .map((m: any) => {
      const parsed = RoadmapSchema.safeParse(m.default ?? m);
      return parsed.success ? parsed.data : null;
    })
    .filter((r): r is Roadmap => r !== null);

  const urls = [
    { loc: baseUrl.toString(), lastmod: new Date().toISOString().split('T')[0] },
    ...roadmaps.map(roadmap => ({
      loc: new URL(`/roadmap/${roadmap.id}`, baseUrl).toString(),
      lastmod: new Date().toISOString().split('T')[0] // simplified for now, could use git log
    }))
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>weekly</changefreq>
  </url>`).join('\n')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};
