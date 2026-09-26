import mongoose from 'mongoose';
import { createApp } from './app.js';
if (!process.env.MONGODB_URI || !process.env.SCHEDULER_KEY) throw new Error('Set MONGODB_URI and SCHEDULER_KEY in server/.env');
await mongoose.connect(process.env.MONGODB_URI);
const server = createApp().listen(Number(process.env.PORT || 4000), () => console.log('Deskwise API ready on port '+(process.env.PORT || 4000)));
async function shutdown() { server.close(); await mongoose.disconnect(); process.exit(0); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
