import express from 'express';
import * as projectController from '../../controllers/project.controller';
import { auth, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import {
  createProjectSchema,
  updateProjectSchema,
  getProjectSchema,
} from '../../validations/project.validation';

const router = express.Router();

router
  .route('/')
  .get(projectController.getProjects)                                             // Public: view all projects
  .post(auth, authorize('admin'), validate(createProjectSchema), projectController.createProject); // Admin only

router
  .route('/:projectId')
  .get(validate(getProjectSchema, 'params'), projectController.getProject)        // Public: view one
  .patch(auth, authorize('admin'), validate(updateProjectSchema), projectController.updateProject)  // Admin only
  .delete(auth, authorize('admin'), validate(getProjectSchema, 'params'), projectController.deleteProject); // Admin only

export default router;
