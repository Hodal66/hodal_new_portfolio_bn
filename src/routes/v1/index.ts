import express from 'express';
import projectRoute from './project.route';
import authRoute from './auth.route';
import userRoute from './user.route';
import dashboardRoute from './dashboard.route';
import messageRoute from './message.route';
import meetingRoute from './meeting.route';
import callRoute from './call.route';
import seoRoute from './seo.route';

const router = express.Router();

const defaultRoutes = [
  { path: '/auth', route: authRoute },
  { path: '/users', route: userRoute },
  { path: '/projects', route: projectRoute },
  { path: '/dashboard', route: dashboardRoute },
  { path: '/messages', route: messageRoute },
  { path: '/meetings', route: meetingRoute },
  { path: '/calls', route: callRoute },
  { path: '/seo', route: seoRoute },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
