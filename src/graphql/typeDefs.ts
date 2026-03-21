import { gql } from 'apollo-server-express';

const typeDefs = gql`
  scalar Date

  enum Role {
    user
    admin
  }

  type User {
    id: ID!
    email: String!
    name: String!
    roles: [Role!]!
    isEmailVerified: Boolean!
    provider: String!
    avatar: String
    createdAt: Date
    updatedAt: Date
  }

  type Stats {
    totalUsers: Int!
    newUsersToday: Int!
    totalProjects: Int!
    totalRevenue: Float!
    activeSubscriptions: Int!
  }

  type ActivityLog {
    id: ID!
    user: User!
    action: String!
    module: String!
    details: String
    ipAddress: String
    userAgent: String
    createdAt: Date
  }

  type File {
    id: ID!
    name: String!
    originalName: String!
    url: String!
    size: Int!
    format: String
    category: String
    createdAt: Date
  }

  type Query {
    me: User
    users(page: Int, limit: Int): [User!]!
    stats: Stats!
    activityLogs(limit: Int): [ActivityLog!]!
    files(category: String): [File!]!
    userById(id: ID!): User
  }

  type Mutation {
    updateProfile(name: String, avatar: String): User!
    deleteUser(id: ID!): Boolean!
    updateUserRole(id: ID!, roles: [Role!]!): User!
    broadcastNotification(message: String!): Boolean!
  }
`;

export default typeDefs;
