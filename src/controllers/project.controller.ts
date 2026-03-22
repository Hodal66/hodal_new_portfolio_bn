import httpStatus from 'http-status';
import { Request, Response } from 'express';
import * as projectService from '../services/project.service';
import * as fileService from '../services/file.service';
import catchAsync from '../utils/catchAsync';
import ApiError from '../utils/ApiError';

export const createProject = catchAsync(async (req: Request, res: Response) => {
  const project = await projectService.createProject(req.body);
  res.status(httpStatus.CREATED).send(project);
});

export const getProjects = catchAsync(async (req: Request, res: Response) => {
  const filter = {};
  const options = {
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 10,
    skip: req.query.skip ? parseInt(req.query.skip as string, 10) : 0,
  };
  const result = await projectService.queryProjects(filter, options);
  res.send(result);
});

export const getProject = catchAsync(async (req: Request, res: Response) => {
  const project = await projectService.getProjectById(req.params.projectId as string);
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
  await projectService.deleteProjectById(req.params.projectId as string);
  res.status(httpStatus.NO_CONTENT).send();
});

export const updateProjectImage = catchAsync(async (req: any, res: Response) => {
  if (!req.file) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Please upload an image file');
  }
  const { projectId } = req.params;
  const userId = req.user._id.toString();
  
  // Upload to Cloudinary
  const file = await fileService.processFileUpload(req.file, userId, 'image');
  
  // Update project
  const project = await projectService.updateProjectById(projectId, { image: file.url } as any);
  
  res.send({ project, image: file.url });
});
