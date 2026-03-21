import express from 'express';
import projectRoute from './project.route';
import authRoute from './auth.route';
import userRoute from './user.route';
import dashboardRoute from './dashboard.route';

const router = express.Router();

const defaultRoutes = [
  { path: '/auth', route: authRoute },
  { path: '/users', route: userRoute },
  { path: '/projects', route: projectRoute },
  { path: '/dashboard', route: dashboardRoute },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
