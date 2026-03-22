import Joi from 'joi';

export const createProjectSchema = Joi.object({
  title: Joi.string().min(2).max(120).required(),
  slug: Joi.string().min(2).max(120).lowercase().optional(),
  description: Joi.string().min(10).required(),
  subtitle: Joi.string().max(200).optional(),
  category: Joi.string().optional(),
  year: Joi.string().optional(),
  duration: Joi.string().optional(),
  status: Joi.string().optional(),
  role: Joi.string().optional(),
  team: Joi.string().optional(),
  overview: Joi.string().optional(),
  challenge: Joi.string().optional(),
  solution: Joi.string().optional(),
  image: Joi.string().optional(),
  gradient: Joi.string().optional(),
  tech: Joi.array().items(Joi.string()).optional(),
  architecture: Joi.array().items(
    Joi.object({ layer: Joi.string(), tech: Joi.string() })
  ).optional(),
  features: Joi.array().items(
    Joi.object({ title: Joi.string(), description: Joi.string() })
  ).optional(),
  metrics: Joi.object().optional(),
  lessons: Joi.array().items(Joi.string()).optional(),
  links: Joi.object({
    github: Joi.string().optional().allow(''),
    live: Joi.string().optional().allow(''),
    demo: Joi.string().optional().allow(''),
    docs: Joi.string().optional().allow(''),
    company: Joi.string().optional().allow(''),
  }).optional(),
  featured: Joi.boolean().optional(),
  order: Joi.number().optional(),
});

export const updateProjectSchema = createProjectSchema.fork(
  ['title', 'slug', 'description'],
  (schema) => schema.optional()
);

export const getProjectSchema = Joi.object({
  projectId: Joi.string().hex().length(24).required().messages({
    'string.length': 'Invalid project ID format',
    'string.hex': 'Invalid project ID format',
  }),
});
