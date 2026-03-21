import User from '../models/user.model';
import Project from '../models/project.model';
import ActivityLog from '../models/activity.model';
import File from '../models/file.model';
import Subscription from '../models/subscription.model';
import Notification from '../models/notification.model';

// Helper to assert authenticated admin context
const requireAuth = (context: any) => {
  if (!context.user) throw new Error('Authentication required');
};
const requireAdmin = (context: any) => {
  requireAuth(context);
  if (!context.user.roles?.includes('admin')) throw new Error('Admin access required');
};

const resolvers = {
  Query: {
    me: async (_: any, __: any, context: any) => {
      if (!context.user) return null;
      return User.findById(context.user._id).lean();
    },
    users: async (_: any, { page = 1, limit = 10 }: any, context: any) => {
      requireAdmin(context);
      return User.find()
        .skip((page - 1) * limit)
        .limit(Math.min(limit, 100))
        .sort({ createdAt: -1 })
        .lean();
    },
    stats: async (_: any, __: any, context: any) => {
      requireAdmin(context);
      const [totalUsers, newUsersToday, totalProjects, subscriptionData, activeSubscriptions] =
        await Promise.all([
          User.countDocuments(),
          User.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
          Project.countDocuments(),
          Subscription.aggregate([
            { $match: { status: 'active' } },
            { $group: { _id: null, count: { $sum: 1 } } },
          ]),
          Subscription.countDocuments({ status: 'active' }),
        ]);

      return {
        totalUsers,
        newUsersToday,
        totalProjects,
        totalRevenue: 0, // Connect to real payment provider (e.g. Stripe) when available
        activeSubscriptions,
      };
    },
    activityLogs: async (_: any, { limit = 20 }: any, context: any) => {
      requireAdmin(context);
      return ActivityLog.find()
        .populate('user', 'name email avatar')
        .limit(Math.min(limit, 100))
        .sort({ createdAt: -1 })
        .lean();
    },
    files: async (_: any, { category }: any, context: any) => {
      requireAuth(context);
      const query: any = { isDeleted: false };
      if (category) query.category = category;
      // Non-admins see only their own files
      if (!context.user.roles?.includes('admin')) {
        query.user = context.user._id;
      }
      return File.find(query).sort({ createdAt: -1 }).lean();
    },
    userById: async (_: any, { id }: any, context: any) => {
      requireAdmin(context);
      return User.findById(id).lean();
    },
  },
  Mutation: {
    updateProfile: async (_: any, { name, avatar }: any, context: any) => {
      requireAuth(context);
      return User.findByIdAndUpdate(
        context.user._id,
        { ...(name ? { name } : {}), ...(avatar ? { avatar } : {}) },
        { new: true }
      ).lean();
    },
    deleteUser: async (_: any, { id }: any, context: any) => {
      requireAdmin(context);
      await User.findByIdAndDelete(id);
      return true;
    },
    updateUserRole: async (_: any, { id, roles }: any, context: any) => {
      requireAdmin(context);
      return User.findByIdAndUpdate(id, { roles }, { new: true }).lean();
    },
    broadcastNotification: async (_: any, { message }: any, context: any) => {
      requireAdmin(context);
      const users = await User.find({}, '_id').lean();
      const notifications = users.map((u: any) => ({
        user: u._id,
        title: 'System Notification',
        message,
        type: 'broadcast',
        isRead: false,
      }));
      await Notification.insertMany(notifications);
      return true;
    },
  },
};

export default resolvers;
