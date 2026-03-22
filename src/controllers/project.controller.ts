import httpStatus from 'http-status';
import { Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import * as projectService from '../services/project.service';
import catchAsync from '../utils/catchAsync';
import ApiError from '../utils/ApiError';
import logger from '../utils/logger';
import { config } from '../config';

// Cloudinary is configured globally in cloudinary.ts — just import v2 here
cloudinary.config({
  cloud_name: config.cloudinary.cloud_name,
  api_key: config.cloudinary.api_key,
  api_secret: config.cloudinary.api_secret,
});

// ─────────────────────── Cloudinary Upload Helper ───────────────────────

const CLOUDINARY_FOLDER = 'HodalTech/Projects';

/**
 * Upload a buffer to Cloudinary under HodalTech/Projects
 */
const uploadBufferToCloudinary = (
  buffer: Buffer,
  originalName: string
): Promise<{ url: string; publicId: string }> => {
  return new Promise((resolve, reject) => {
    const safeName = originalName
      .replace(/\.[^/.]+$/, '')        // remove extension
      .replace(/[^a-zA-Z0-9_-]/g, '-') // sanitize
      .slice(0, 60);

    const publicId = `${safeName}-${Date.now()}`;

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_FOLDER,
        public_id: publicId,
        resource_type: 'image',
        overwrite: false,
        transformation: [
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
          { width: 1280, crop: 'limit' }, // max 1280px wide
        ],
      },
      (error, result) => {
        if (error || !result) {
          logger.error('Cloudinary project image upload error:', error);
          return reject(error ?? new Error('Cloudinary upload returned no result'));
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );

    stream.end(buffer);
  });
};

/**
 * Delete an image from Cloudinary by its publicId
 */
const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    logger.info(`Cloudinary image deleted: ${publicId}`);
  } catch (err: any) {
    logger.warn(`Failed to delete Cloudinary image ${publicId}: ${err.message}`);
    // Don't throw — image cleanup failure should not block the API response
  }
};

// ─────────────────────── Project CRUD ───────────────────────

export const createProject = catchAsync(async (req: Request, res: Response) => {
  const project = await projectService.createProject(req.body);
  res.status(httpStatus.CREATED).send(project);
});

export const getProjects = catchAsync(async (req: Request, res: Response) => {
  const options = {
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
    skip: req.query.skip ? parseInt(req.query.skip as string, 10) : 0,
    featured: req.query.featured === 'true' ? true : undefined,
  };

  const filter: any = {};
  if (options.featured !== undefined) filter.featured = options.featured;
  if (req.query.category) filter.category = req.query.category;

  const result = await projectService.queryProjects(filter, options);
  res.send(result);
});

export const getProject = catchAsync(async (req: Request, res: Response) => {
  const { projectId } = req.params;

  // Support lookup by MongoDB _id OR by slug
  let project = null;
  if (projectId.match(/^[a-f\d]{24}$/i)) {
    project = await projectService.getProjectById(projectId);
  }
  if (!project) {
    project = await projectService.getProjectBySlug(projectId);
  }

  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }
  res.send(project);
});

export const updateProject = catchAsync(async (req: Request, res: Response) => {
  const project = await projectService.updateProjectById(req.params.projectId as string, req.body);
  res.send(project);
});

export const deleteProject = catchAsync(async (req: Request, res: Response) => {
  const project = await projectService.getProjectById(req.params.projectId as string);
  if (!project) throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');

  // Delete all associated Cloudinary images
  if (project.images?.length) {
    await Promise.allSettled(
      project.images
        .filter((img: any) => img.publicId)
        .map((img: any) => deleteFromCloudinary(img.publicId))
    );
  }

  await project.deleteOne();
  res.status(httpStatus.NO_CONTENT).send();
});

// ─────────────────────── Image Upload (Single) ───────────────────────

/**
 * Upload a single image and add it to the project's images array.
 * POST /projects/:projectId/images
 */
export const uploadProjectImage = catchAsync(async (req: any, res: Response) => {
  if (!req.file) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No image file provided');
  }

  const project = await projectService.getProjectById(req.params.projectId);
  if (!project) throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');

  // Upload to Cloudinary
  const { url, publicId } = await uploadBufferToCloudinary(
    req.file.buffer,
    req.file.originalname
  );

  // Determine if this should be the featured image
  const isFirstImage = !project.images || project.images.length === 0;
  const isFeatured = req.body.isFeatured === 'true' || isFirstImage;

  // If marking as featured, unmark all others
  const updatedImages = (project.images || []).map((img: any) => ({
    ...img.toObject(),
    isFeatured: isFeatured ? false : img.isFeatured,
  }));

  updatedImages.push({
    url,
    publicId,
    isFeatured,
    caption: req.body.caption || '',
  });

  // Also update the legacy `image` field if this is the featured image
  const updateBody: any = { images: updatedImages };
  if (isFeatured) {
    updateBody.image = url;
  }

  const updated = await projectService.updateProjectById(req.params.projectId, updateBody);

  logger.info(`Project image uploaded: ${publicId} → ${url}`);
  res.status(httpStatus.CREATED).send({
    message: 'Image uploaded successfully',
    image: { url, publicId, isFeatured },
    project: updated,
  });
});

// ─────────────────────── Image Delete ───────────────────────

/**
 * Remove an image from a project and delete it from Cloudinary.
 * DELETE /projects/:projectId/images/:publicId64
 * (publicId is base64-encoded to safely pass slashes in the URL)
 */
export const deleteProjectImage = catchAsync(async (req: any, res: Response) => {
  const project = await projectService.getProjectById(req.params.projectId);
  if (!project) throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');

  // Decode the base64-encoded publicId from the URL
  const publicId = Buffer.from(req.params.publicId64, 'base64').toString('utf-8');

  // Remove from images array
  const filteredImages = (project.images || []).filter(
    (img: any) => img.publicId !== publicId
  );

  // If we removed the featured image, make the first remaining image featured
  const hadFeatured = (project.images || []).some(
    (img: any) => img.publicId === publicId && img.isFeatured
  );
  if (hadFeatured && filteredImages.length > 0) {
    filteredImages[0].isFeatured = true;
  }

  const updateBody: any = { images: filteredImages };

  // Update legacy image field
  const newFeatured = filteredImages.find((img: any) => img.isFeatured);
  updateBody.image = newFeatured?.url || filteredImages[0]?.url || '';

  await projectService.updateProjectById(req.params.projectId, updateBody);

  // Delete from Cloudinary (non-blocking to not delay response)
  deleteFromCloudinary(publicId).catch(() => {});

  res.send({ message: 'Image removed successfully', publicId });
});

// ─────────────────────── Set Featured Image ───────────────────────

/**
 * Mark one image as featured (the cover image).
 * PATCH /projects/:projectId/images/:publicId64/featured
 */
export const setFeaturedImage = catchAsync(async (req: any, res: Response) => {
  const project = await projectService.getProjectById(req.params.projectId);
  if (!project) throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');

  const publicId = Buffer.from(req.params.publicId64, 'base64').toString('utf-8');

  const updatedImages = (project.images || []).map((img: any) => {
    const obj = img.toObject ? img.toObject() : { ...img };
    return { ...obj, isFeatured: img.publicId === publicId };
  });

  const featured = updatedImages.find((img: any) => img.isFeatured);
  if (!featured) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Image not found in this project');
  }

  const updated = await projectService.updateProjectById(req.params.projectId, {
    images: updatedImages,
    image: featured.url, // sync legacy field
  });

  res.send({ message: 'Featured image updated', project: updated });
});
