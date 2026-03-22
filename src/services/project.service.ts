import httpStatus from 'http-status';
import Project, { IProject } from '../models/project.model';
import ApiError from '../utils/ApiError';

/**
 * Create a project
 * @param {Object} projectBody
 * @returns {Promise<IProject>}
 */
export const createProject = async (projectBody: IProject): Promise<IProject> => {
  if (await Project.isProjectNameTaken(projectBody.title)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Project title already taken');
  }
  return Project.create(projectBody);
};

/**
 * Query for projects with pagination and filtering
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<{ projects: IProject[]; total: number; limit: number; skip: number }>}
 */
export const queryProjects = async (
  filter: any,
  options: any
): Promise<{ projects: IProject[]; total: number; limit: number; skip: number }> => {
  const { limit = 50, skip = 0 } = options;
  const [projects, total] = await Promise.all([
    Project.find(filter)
      .sort({ order: 1, createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean(),
    Project.countDocuments(filter),
  ]);
  return { projects, total, limit, skip };
};

/**
 * Get project by id
 * @param {ObjectId} id
 * @returns {Promise<IProject | null>}
 */
export const getProjectById = async (id: string): Promise<IProject | null> => {
  return Project.findById(id);
};

/**
 * Get project by slug
 * @param {string} slug
 * @returns {Promise<IProject | null>}
 */
export const getProjectBySlug = async (slug: string): Promise<IProject | null> => {
  return Project.findOne({ slug });
};

/**
 * Update project by id
 * @param {ObjectId} projectId
 * @param {Object} updateBody
 * @returns {Promise<IProject>}
 */
export const updateProjectById = async (projectId: string, updateBody: any): Promise<IProject> => {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }
  // Check if title is taken but by another project (if updating title)
  if (updateBody.title && (await Project.isProjectNameTaken(updateBody.title, projectId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Project title already taken');
  }
  Object.assign(project, updateBody);
  await project.save();
  return project;
};

/**
 * Delete project by id
 * @param {ObjectId} projectId
 * @returns {Promise<IProject>}
 */
export const deleteProjectById = async (projectId: string): Promise<IProject> => {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }
  await project.deleteOne();
  return project;
};
