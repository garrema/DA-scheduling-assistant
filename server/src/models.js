import mongoose from 'mongoose';
// The neighborhood is the atomic aggregate: revision protects concurrent edits.
const workspaceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  revision: { type: Number, default: 0 },
  config: { type: mongoose.Schema.Types.Mixed, required: true },
  members: { type: [mongoose.Schema.Types.Mixed], default: [] },
  plans: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { minimize: false, timestamps: true });
workspaceSchema.index({ 'members.email': 1 }, { unique: true });
export const Workspace = mongoose.model('Workspace', workspaceSchema);
const sessionSchema = new mongoose.Schema({
  tokenHash: { type: String, unique: true },
  workspaceId: mongoose.Schema.Types.ObjectId,
  memberId: String,
  expiresAt: { type: Date, index: { expires: 0 } },
});
export const Session = mongoose.model('Session', sessionSchema);
