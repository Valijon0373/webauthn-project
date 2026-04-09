import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_FILE = path.join(__dirname, 'users.json');

function readFile() {
  const raw = fs.readFileSync(USERS_FILE, 'utf8');
  return JSON.parse(raw);
}

function writeFile(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

export function getAllUsers() {
  return readFile();
}

export function findUserByEmail(email) {
  if (!email) return undefined;
  const e = String(email).toLowerCase();
  return readFile().find((u) => u.email.toLowerCase() === e);
}

export function findUserById(id) {
  return readFile().find((u) => u.id === id);
}

export function findUserByCredentialID(credentialID) {
  if (!credentialID) return undefined;
  const users = readFile();
  for (const u of users) {
    const creds = u.webauthnCredentials || [];
    if (creds.some((c) => c.credentialID === credentialID)) return u;
  }
  return undefined;
}

export function createUser(user) {
  const users = readFile();
  users.push(user);
  writeFile(users);
  return user;
}

export function updateUser(userId, updater) {
  const users = readFile();
  const i = users.findIndex((u) => u.id === userId);
  if (i === -1) return null;
  users[i] = updater(users[i]);
  writeFile(users);
  return users[i];
}
