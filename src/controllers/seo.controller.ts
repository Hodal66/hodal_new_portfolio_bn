import { Request, Response } from 'express';
import httpStatus from 'http-status';
import Project, { IProject } from '../models/project.model';
import { config } from '../config';

/**
 * Generate a dynamic XML sitemap based on the current projects in the database.
 */
export const getSitemap = async (_req: Request, res: Response) => {
  try {
    const projects = await Project.find({}, 'slug updatedAt').sort({ updatedAt: -1 });
    
    const baseUrl = config.frontendUrl || 'https://hodaltech.space';
    const lastMod = new Date().toISOString().split('T')[0];

    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Core Pages -->
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/login</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>`;

    // Case Studies / Projects
    projects.forEach((project: IProject) => {
      const projectDate = project.updatedAt ? new Date(project.updatedAt).toISOString().split('T')[0] : lastMod;
      sitemap += `
  <url>
    <loc>${baseUrl}/project/${project.slug}</loc>
    <lastmod>${projectDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
    });

    sitemap += '\n</urlset>';

    res.header('Content-Type', 'application/xml');
    res.status(httpStatus.OK).send(sitemap);
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error generating sitemap');
  }
};

/**
 * Serve robots.txt to guide search engine crawlers.
 */
export const getRobots = (_req: Request, res: Response) => {
  const baseUrl = config.frontendUrl || 'https://hodaltech.space';
  
  const robots = `# https://www.robotstxt.org/robotstxt.html
User-agent: *
Allow: /
Allow: /projects/
Allow: /project/

# Block Private Dashboards & Auth
Disallow: /dashboard/
Disallow: /admin/
Disallow: /login
Disallow: /register
Disallow: /verify-otp
Disallow: /forgot-password
Disallow: /reset-password

# Sitemap Location
Sitemap: ${baseUrl}/sitemap.xml
Sitemap: ${config.mongoose.url ? config.mongoose.url.replace('/v1', '') : ''}/v1/seo/sitemap.xml
`;

  res.header('Content-Type', 'text/plain');
  res.status(httpStatus.OK).send(robots);
};
