import {
  cert,
  getApps,
  initializeApp,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import fs from "fs";
import path from "path";

const keyPath = path.join(__dirname, "../../../firebase-service-account.json");
const serviceAccount: ServiceAccount = fs.existsSync(keyPath)
  ? JSON.parse(fs.readFileSync(keyPath, "utf8"))
  : ({} as ServiceAccount);

if (!getApps().length && fs.existsSync(keyPath)) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const firebaseAdmin = { messaging: getMessaging };
export default firebaseAdmin;