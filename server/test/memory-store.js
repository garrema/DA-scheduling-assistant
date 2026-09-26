// Test-only repository double. It exercises HTTP behavior, NOT MongoDB durability.
import { randomUUID } from 'node:crypto';
import { Workspace, Session } from '../src/models.js';
export function useMemoryStore() {
  const workspaces = [], sessions = [];
  const copy = value => value == null ? value : structuredClone(value);
  function matches(item, query) {
    return Object.entries(query).every(([key, value]) => {
      if (key === 'members.email') return item.members.some(m => m.email === value);
      if (value?.$gt) return new Date(item[key]) > value.$gt;
      return String(item[key]) === String(value);
    });
  }
  function wire(model, items) {
    model.init = async () => {};
    model.create = async value => { const item = { _id: randomUUID(), revision: 0, plans: {}, ...copy(value) }; items.push(item); return copy(item); };
    model.exists = async query => items.some(x => matches(x, query));
    model.findOne = query => ({ lean: async () => copy(items.find(x => matches(x, query))) });
    model.findById = id => ({ lean: async () => copy(items.find(x => String(x._id) === String(id))) });
    model.findOneAndUpdate = (query, changes) => ({ lean: async () => {
      const item = items.find(x => matches(x, query));
      if (!item) return null;
      for (const [key, value] of Object.entries(changes.$set || {})) {
        if (key.startsWith('plans.')) item.plans[key.slice(6)] = copy(value);
        else item[key] = copy(value);
      }
      for (const [key, value] of Object.entries(changes.$inc || {})) item[key] += value;
      return copy(item);
    } });
    model.deleteOne = async query => { const index = items.findIndex(x => matches(x, query)); if (index >= 0) items.splice(index, 1); };
  }
  wire(Workspace, workspaces); wire(Session, sessions);
}
