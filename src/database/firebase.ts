import admin from 'firebase-admin';
import type { Database } from 'firebase-admin/database';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('../../secrets/serviceAccountKey.json');

const firebaseConfig = {
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://bolnoy-shop-default-rtdb.europe-west1.firebasedatabase.app',
};

admin.initializeApp(firebaseConfig);

export const database: Database = admin.database();
