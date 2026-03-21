import httpStatus from 'http-status';
import { getUserByEmail } from './user.service';
import ApiError from '../utils/ApiError';
import { IUser } from '../models/user.model';

/**
 * Login with email and password
 * Returns the user if credentials are valid (status check is done in controller)
 */
export const loginUserWithEmailAndPassword = async (email: string, password: string): Promise<IUser> => {
  const user = await getUserByEmail(email);
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect email or password');
  }
  return user;
};
