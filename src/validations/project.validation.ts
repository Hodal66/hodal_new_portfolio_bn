import { z } from 'zod';

/**
 * Zod validation schemas for Project management.
 */

const projectLinkSchema = z.object({
  label: z.string().min(1),
  url: z.string().url('Invalid URL format for project link'),
}).partial().or(z.object({
  label: z.string(),
  url: z.string()
})); // Relaxed URLs as requested in previous session

export const createProjectSchema = z.object({
  body: z.object({
    title: z.string().min(3, 'Title must be at least 3 characters').max(100),
    slug: z.string().optional(),
    description: z.string().min(10, 'Description must be at least 10 characters'),
    category: z.string().min(2),
    technologies: z.array(z.string()).optional(),
    links: z.array(projectLinkSchema).optional(),
    isFeatured: z.boolean().optional(),
    status: z.enum(['draft', 'published', 'archived']).optional(),
  }),
});

export const updateProjectSchema = z.object({
  body: createProjectSchema.shape.body.partial(),
  params: z.object({
    projectId: z.string().min(1),
  }),
});

export const getProjectSchema = z.object({
  params: z.object({
    projectId: z.string().min(1),
  }),
});
