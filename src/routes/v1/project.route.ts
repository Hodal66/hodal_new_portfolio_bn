import express from 'express';
import * as projectController from '../../controllers/project.controller';
import { auth, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import {
  createProjectSchema,
  updateProjectSchema,
  getProjectSchema,
} from '../../validations/project.validation';
import { upload } from '../../middlewares/upload';

const router = express.Router();

// ─── Public Routes ─────────────────────────────────────

router.get('/', projectController.getProjects);                              // All projects (with optional ?featured=true&category=...)
router.get('/:projectId', validate(getProjectSchema, 'params'), projectController.getProject); // By ID or slug

// ─── Admin-only Routes ─────────────────────────────────────

router.post(
  '/',
  auth, authorize('admin'),
  validate(createProjectSchema),
  projectController.createProject
);

router.patch(
  '/:projectId',
  auth, authorize('admin'),
  validate(updateProjectSchema),
  projectController.updateProject
);

router.delete(
  '/:projectId',
  auth, authorize('admin'),
  validate(getProjectSchema, 'params'),
  projectController.deleteProject
);

// ─── Image Management Routes ─────────────────────────────────────

// Upload a new image to a project (multipart/form-data, field: "image")
router.post(
  '/:projectId/images',
  auth, authorize('admin'),
  upload.single('image'),
  projectController.uploadProjectImage
);

// Remove an image from a project (publicId is base64-encoded)
router.delete(
  '/:projectId/images/:publicId64',
  auth, authorize('admin'),
  projectController.deleteProjectImage
);

// Mark an image as the featured/cover image
router.patch(
  '/:projectId/images/:publicId64/featured',
  auth, authorize('admin'),
  projectController.setFeaturedImage
);

// Legacy single-image upload (kept for backward compat)
router.patch(
  '/:projectId/image',
  auth, authorize('admin'),
  upload.single('image'),
  projectController.uploadProjectImage
);

export default router;
