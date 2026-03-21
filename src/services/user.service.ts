import httpStatus from 'http-status';
import User, { IUser } from '../models/user.model';
import ApiError from '../utils/ApiError';

/**
 * Create a user
 */
export const createUser = async (userBody: any): Promise<IUser> => {
  if (await (User as any).isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  // Map 'fullName' field from frontend to 'name'
  if (userBody.fullName && !userBody.name) {
    userBody.name = userBody.fullName;
    delete userBody.fullName;
  }
  return User.create(userBody);
};

/**
 * Get user by email — explicitly selects password for auth comparisons
 */
export const getUserByEmail = async (email: string): Promise<IUser | null> => {
  return User.findOne({ email }).select('+password');
};

/**
 * Get user by id (no password)
 */
export const getUserById = async (id: string): Promise<IUser | null> => {
  return User.findById(id);
};

/**
 * Update user by id
 */
export const updateUserById = async (userId: string, updateBody: Partial<IUser>): Promise<IUser> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  // Prevent direct role escalation from this endpoint
  delete (updateBody as any).roles;
  Object.assign(user, updateBody);
  await user.save();
  return user;
};

/**
 * Delete user by id
 */
export const deleteUserById = async (userId: string): Promise<IUser> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  await user.deleteOne();
  return user;
};

/**
 * Get paginated list of users
 */
export const queryUsers = async (filter: any = {}, options: { limit?: number; skip?: number; sort?: any } = {}) => {
  const { limit = 20, skip = 0, sort = { createdAt: -1 } } = options;
  const [users, total] = await Promise.all([
    User.find(filter).sort(sort).limit(limit).skip(skip).lean(),
    User.countDocuments(filter),
  ]);
  return { users, total, limit, skip };
};
