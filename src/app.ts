import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import httpStatus from 'http-status';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import http from 'http';
import bodyParser from 'body-parser';

import { config } from './config';
import routes from './routes/v1';
import { errorConverter, errorHandler } from './middlewares/error';
import { schema } from './graphql';
import { auth } from './middlewares/auth';
import logger from './utils/logger';

const app: Application = express();
const httpServer = http.createServer(app);

// ────────────────────────────── Apollo Server 4 Setup ──────────────────────────────

export const apolloServer = new ApolloServer({
  schema,
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  formatError: (error) => {
    logger.error('GraphQL Error', {
      message: error.message,
      path: error.path,
      extensions: error.extensions,
    });
    // Don't leak stack traces in production
    if (config.env === 'production') {
      return { message: error.message, code: error.extensions?.code || 'INTERNAL_SERVER_ERROR' };
    }
    return error;
  },
});

// ────────────────────────────── Middleware ──────────────────────────────

if (config.env !== 'test') {
  app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
}

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: config.env === 'production' ? undefined : false,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

const allowedOrigins = [
  config.frontendUrl,
  'https://hodal-new-portfolio.onrender.com', // Potential production frontend
  'https://hodal-new-portfolio-bn.onrender.com' // Self-reference for internal calls
];

if (config.env === 'development') {
  ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:5174'].forEach((o) => {
    if (!allowedOrigins.includes(o)) allowedOrigins.push(o);
  });
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Check if origin is allowed or matches our onrender.com pattern
    const isAllowed = allowedOrigins.includes(origin) || 
                      origin.endsWith('.onrender.com');
                      
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { code: 429, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/v1/auth', authLimiter);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.status(httpStatus.OK).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.env,
    version: '1.0.0',
  });
});

// API Routes
app.use('/v1', routes);

// ──────────────────────────── GraphQL (Apollo 4) ────────────────────────────
// Note: apolloServer.start() MUST be called before this middleware is used.
// This is handled in server.ts for standalone and vercel.json for hosting.
export const mountGraphQL = async () => {
  app.use(
    '/graphql',
    auth,
    bodyParser.json(),
    expressMiddleware(apolloServer, {
      context: async ({ req }) => ({ user: (req as any).user }),
    })
  );
};

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(httpStatus.NOT_FOUND).json({ code: 404, message: 'Route not found' });
});

app.use(errorConverter);
app.use(errorHandler);

export default app;
export { httpServer };
