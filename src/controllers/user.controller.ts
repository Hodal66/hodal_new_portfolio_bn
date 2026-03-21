import httpStatus from 'http-status';
import { Request, Response } from 'express';
import * as userService from '../services/user.service';
import catchAsync from '../utils/catchAsync';
import ApiError from '../utils/ApiError';

export const getUsers = catchAsync(async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const skip = Number(req.query.skip) || 0;
  const result = await userService.queryUsers({}, { limit, skip });
  res.send(result);
});

export const getUser = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.getUserById(req.params.userId as string);
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  res.send(user);
});

export const updateUser = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.updateUserById(req.params.userId as string, req.body);
  res.send(user);
});

export const deleteUser = catchAsync(async (req: Request, res: Response) => {
  await userService.deleteUserById(req.params.userId as string);
  res.status(httpStatus.NO_CONTENT).send();
});

export const getMe = catchAsync(async (req: any, res: Response) => {
  res.send(req.user);
});

export const updateMe = catchAsync(async (req: any, res: Response) => {
  const user = await userService.updateUserById(req.user._id.toString(), req.body);
  res.send(user);
});
