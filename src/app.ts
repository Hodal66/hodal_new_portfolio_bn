import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import httpStatus from 'http-status';

import { config } from './config';
import routes from './routes/v1';
import { errorConverter, errorHandler } from './middlewares/error';
import { schema } from './graphql';
import { graphqlHTTP } from 'express-graphql';
import { auth } from './middlewares/auth';
import logger from './utils/logger';

const app: Application = express();

// HTTP request logging
if (config.env !== 'test') {
  app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
}

// Security HTTP headers
app.use(helmet({
  crossOriginEmbedderPolicy: false, // allow GraphiQL in dev
}));

// Parse json request body (with size limit to prevent DoS)
app.use(express.json({ limit: '10mb' }));

// Parse urlencoded request body
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// gzip compression
app.use(compression());

// CORS — restrict to allowed frontend origins
const allowedOrigins = [config.frontendUrl];
if (config.env === 'development') {
  // Support common Vite dev ports (falls back when port is busy)
  ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:5174'].forEach((o) => {
    if (!allowedOrigins.includes(o)) allowedOrigins.push(o);
  });
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting — applied in both dev AND production for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 requests per IP per window
  message: { code: 429, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);
app.use('/v1/auth', authLimiter);

// Health check endpoint (no auth, for monitoring)
app.get('/health', (_req: Request, res: Response) => {
  res.status(httpStatus.OK).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.env,
    version: process.env.npm_package_version || '1.0.0',
  });
});

// v1 REST API routes
app.use('/v1', routes);

// GraphQL endpoint — protected by auth middleware
// Context populates req.user for resolvers
app.use('/graphql', auth, (req: Request, res: Response) => {
  graphqlHTTP({
    schema,
    graphiql: config.env === 'development',  // GraphiQL UI only in dev
    context: { user: (req as any).user },
  })(req, res);
});

// 404 handler for unknown routes
app.use((_req: Request, res: Response, _next: NextFunction) => {
  res.status(httpStatus.NOT_FOUND).json({ code: 404, message: 'Route not found' });
});

// Error pipeline
app.use(errorConverter);
app.use(errorHandler);

export default app;
