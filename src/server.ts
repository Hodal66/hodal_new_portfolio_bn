import mongoose from 'mongoose';
import app, { apolloServer, mountGraphQL, httpServer } from './app';
import { config } from './config';
import logger from './utils/logger';
import { initSocket } from './utils/socket';

mongoose.set('debug', config.env === 'development');

const startServer = async () => {
  try {
    logger.info('Starting server initialization...');
    
    // Connect to MongoDB
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    logger.info('Connected to MongoDB');

    // Initialize Apollo Server 4
    await apolloServer.start();
    await mountGraphQL();
    logger.info('Apollo GraphQL server started');

    // Initialize Socket.io
    initSocket();
    logger.info('Socket.io initialized');

    const server = httpServer.listen(config.port, '0.0.0.0', () => {
      logger.info(`Server listening on port ${config.port} [${config.env}]`);
    });

    const exitHandler = () => {
      if (server) {
        server.close(() => {
          logger.info('Server closed gracefully');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    };

    const unexpectedErrorHandler = (error: Error) => {
      logger.error('Unexpected error occurred', { error: error.message, stack: error.stack });
      exitHandler();
    };

    process.on('uncaughtException', unexpectedErrorHandler);
    process.on('unhandledRejection', unexpectedErrorHandler);

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received — shutting down');
      if (server) server.close();
    });

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

startServer();
