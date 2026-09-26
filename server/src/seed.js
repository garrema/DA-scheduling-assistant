import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { Workspace } from './models.js';
import { memberSchema } from './contracts.js';
const manager = memberSchema.parse({ name: process.env.SEED_NAME || 'Manager', email: process.env.SEED_EMAIL, password: process.env.SEED_PASSWORD });
await mongoose.connect(process.env.MONGODB_URI);
await Workspace.init();
if (await Workspace.exists({ 'members.email': manager.email })) throw new Error('Account already exists; seed never overwrites data');
await Workspace.create({
  name: process.env.SEED_NEIGHBORHOOD || 'Neighborhood 1',
  config: { timezone: 'America/New_York', allowedShiftHours: [2, 4, 6], maxHours: 20, targetHours: 10, maxContinuousHours: 6, minRestHours: 8, openHours: Array.from({ length: 7 }, (_, i) => ({ day: i+1, start: 0, end: 1440 })) },
  members: [{ id: randomUUID(), name: manager.name, email: manager.email, passwordHash: await bcrypt.hash(manager.password, 12), role: 'manager', availability: [], exceptions: [], nightPreference: false }],
  plans: {},
});
console.log('Created neighborhood and manager. No real employee data was added.');
await mongoose.disconnect();
