import { z } from 'zod';
const minute = z.number().int().min(0).max(1440);
const day = z.number().int().min(1).max(7);
export const weeklyWindow = z.object({ day, start: minute, end: minute }).refine(x => x.start < x.end, 'Split overnight windows at midnight');
export const configSchema = z.object({
  allowedShiftHours: z.array(z.number().int().min(1).max(6)).min(1).max(6).default([2, 4, 6]),
  timezone: z.string().min(1).max(80),
  maxHours: z.number().int().min(1).max(20),
  targetHours: z.number().int().min(0).max(20),
  maxContinuousHours: z.number().int().min(1).max(6),
  minRestHours: z.number().int().min(1).max(24),
  openHours: z.array(weeklyWindow).max(50),
}).refine(x => x.targetHours <= x.maxHours, 'Target exceeds maximum');
export const availabilitySchema = z.object({
  availability: z.array(weeklyWindow).max(50),
  exceptions: z.array(z.object({ start: z.iso.datetime({ offset: true }), end: z.iso.datetime({ offset: true }) }).refine(x => Date.parse(x.start) < Date.parse(x.end), 'Invalid exception interval')).max(100),
  nightPreference: z.boolean(),
});
export const memberSchema = z.object({ name: z.string().trim().min(1).max(80), email: z.email().toLowerCase(), password: z.string().min(12).max(72) });
export const shiftSchema = z.object({ start: z.iso.datetime({ offset: true }), end: z.iso.datetime({ offset: true }), required: z.number().int().min(1).max(10) });
export const assignmentSchema = z.object({ assignees: z.array(z.string()).max(10), locked: z.boolean() });
export const weekSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const revisionSchema = z.number().int().nonnegative();
