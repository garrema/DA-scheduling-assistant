// Disposable preview with synthetic records. Never use as a deployment entry point.
import bcrypt from 'bcryptjs';
import { useMemoryStore } from './memory-store.js';
import { Workspace } from '../src/models.js';
import { createApp } from '../src/app.js';
useMemoryStore();
const passwordHash = await bcrypt.hash('Preview-only-password', 4);
await Workspace.create({ name: 'Campus North · Demo', config: { timezone: 'America/New_York', allowedShiftHours: [2,4,6], maxHours:20, targetHours:10, maxContinuousHours:6, minRestHours:8, openHours:[{day:1,start:480,end:720}] }, members:[{id:'manager',name:'Demo Manager',email:'manager@demo.test',passwordHash,role:'manager',availability:[],exceptions:[]},{id:'da1',name:'Alex · Demo',email:'alex@demo.test',passwordHash,role:'da',availability:[{day:1,start:480,end:720}],exceptions:[],nightPreference:false},{id:'da2',name:'Sam · Demo',email:'sam@demo.test',passwordHash,role:'da',availability:[{day:1,start:480,end:720}],exceptions:[],nightPreference:true}],plans:{} });
createApp().listen(4000,'127.0.0.1',()=>console.log('Disposable demo listening on 4000'));
