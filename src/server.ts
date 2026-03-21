import mongoose from 'mongoose';
import app from './app';
import { config } from './config';
import logger from './utils/logger';

mongoose.set('debug', true);

const startServer = async () => {
  try {
    console.log('--- STARTING SERVER ---');
    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    console.log('Connected to MongoDB');

    const server = app.listen(config.port, () => {
      console.log(`Server listening on port ${config.port} [${config.env}]`);
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

    process.on('SIGTERM', () => {
      logger.info('SIGTERM received — shutting down gracefully');
      if (server) server.close();
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received — shutting down gracefully');
      if (server) server.close(() => process.exit(0));
    });

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

startServer();
