import admin from 'firebase-admin';
import { databaseConfig, isDevelopment } from './environment';
import logger from '../utils/logger';

// Firebase Admin SDK initialization
class FirebaseManager {
  private static instance: FirebaseManager;
  private initialized = false;

  public static getInstance(): FirebaseManager {
    if (!FirebaseManager.instance) {
      FirebaseManager.instance = new FirebaseManager();
    }
    return FirebaseManager.instance;
  }

  public initialize(): void {
    if (this.initialized) {
      logger.warn('Firebase Admin SDK is already initialized');
      return;
    }

    try {
      if (admin.apps.length === 0) {
        const { firebase } = databaseConfig;
        
        if (firebase.serviceAccountKey && firebase.serviceAccountKey.trim() !== '') {
          try {
            // Production: Use service account key
            const serviceAccount = JSON.parse(firebase.serviceAccountKey);
            const config: any = {
              credential: admin.credential.cert(serviceAccount),
              projectId: firebase.projectId,
            };
            if (firebase.databaseURL) config.databaseURL = firebase.databaseURL;
            if (firebase.storageBucket) config.storageBucket = firebase.storageBucket;
            admin.initializeApp(config);
            logger.info('✅ Firebase initialized with service account key');
          } catch (error) {
            logger.error('❌ Failed to parse Firebase service account key:', error);
            if (!isDevelopment) {
              throw error;
            }
            // Fall back to default credentials in development
            logger.warn('⚠️ Falling back to default credentials');
            const config: any = { projectId: firebase.projectId };
            if (firebase.databaseURL) config.databaseURL = firebase.databaseURL;
            if (firebase.storageBucket) config.storageBucket = firebase.storageBucket;
            admin.initializeApp(config);
          }
        } else {
          // Development: Use default credentials (gcloud auth application-default login)
          const config: any = {
            projectId: firebase.projectId,
          };
          if (firebase.databaseURL) config.databaseURL = firebase.databaseURL;
          if (firebase.storageBucket) config.storageBucket = firebase.storageBucket;
          admin.initializeApp(config);
          logger.info('✅ Firebase initialized with default credentials');
        }

        this.initialized = true;
        logger.info('✅ Firebase Admin SDK initialized successfully');
      }
    } catch (error) {
      logger.error('❌ Failed to initialize Firebase Admin SDK:', error);
      if (!isDevelopment) {
        process.exit(1);
      }
    }
  }

  public getFirestore() {
    if (!this.initialized) {
      this.initialize();
    }
    return admin.firestore();
  }

  public getAuth() {
    if (!this.initialized) {
      this.initialize();
    }
    return admin.auth();
  }

  public getStorage() {
    if (!this.initialized) {
      this.initialize();
    }
    return admin.storage();
  }
}



// Database connection manager
class DatabaseManager {
  private static instance: DatabaseManager;
  private firebaseManager: FirebaseManager;

  private constructor() {
    this.firebaseManager = FirebaseManager.getInstance();
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public async initialize(): Promise<void> {
    logger.info('🔄 Initializing database connections...');
    
    // Initialize Firebase
    this.firebaseManager.initialize();
    
    logger.info('✅ Database initialization completed');
  }

  public getFirestore() {
    return this.firebaseManager.getFirestore();
  }

  public getAuth() {
    return this.firebaseManager.getAuth();
  }

  public getStorage() {
    return this.firebaseManager.getStorage();
  }

  public async disconnect(): Promise<void> {
    logger.info('🔄 Closing database connections...');
    
    // Firebase Admin SDK doesn't need explicit disconnection
    logger.info('✅ Database connections closed');
  }

  public async healthCheck(): Promise<{ firebase: boolean; cache: boolean }> {
    const health = { firebase: false, cache: true }; // In-memory cache is always "up"

    try {
      // Test Firebase connection
      await this.getFirestore().collection('health').limit(1).get();
      health.firebase = true;
    } catch (error) {
      logger.error('Firebase health check failed:', error);
    }

    return health;
  }
}

// Export singleton instances
export const databaseManager = DatabaseManager.getInstance();
export const db = databaseManager.getFirestore();
export const auth = databaseManager.getAuth();
export const storage = databaseManager.getStorage();

// Export manager for advanced usage
export { DatabaseManager, FirebaseManager };

// Initialize database on module load
databaseManager.initialize().catch((error) => {
  logger.error('Failed to initialize database:', error);
  if (!isDevelopment) {
    process.exit(1);
  }
});
