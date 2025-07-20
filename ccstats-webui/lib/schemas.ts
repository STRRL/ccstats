import { z } from 'zod'

// Schema for usage data within messages
const UsageSchema = z.object({
  input_tokens: z.union([z.number(), z.string()]).optional(),
  cache_creation_input_tokens: z.union([z.number(), z.string()]).optional(),
  cache_read_input_tokens: z.union([z.number(), z.string()]).optional(),
  output_tokens: z.union([z.number(), z.string()]).optional(),
  service_tier: z.string().optional(),
  server_tool_use: z.any().nullable().optional()
})

// Schema for message content (direct object, not wrapped in entries)
const MessageSchema = z.object({
  role: z.string(),
  content: z.string(),
  id: z.string().nullable(),
  type: z.string().nullable(),
  model: z.string().nullable(),
  stop_reason: z.string().nullable(),
  stop_sequence: z.string().nullable(),
  usage: UsageSchema.nullable()
})

// Main event schema based on actual data structure
const EventSchema = z.object({
  parentUuid: z.string().nullable(),
  isSidechain: z.boolean(),
  userType: z.string(),
  cwd: z.string(),
  sessionId: z.string(),
  version: z.string(),
  type: z.string(),
  message: MessageSchema.nullable(), // System events can have null message
  uuid: z.string(),
  timestamp: z.string(),
  isMeta: z.boolean().nullable(),
  requestId: z.string().nullable(),
  toolUseResult: z.any().nullable(),
  isApiErrorMessage: z.boolean().nullable(),
  content: z.string().nullable(),
  toolUseID: z.string().nullable(),
  level: z.string().nullable(),
  summary: z.string().nullable(),
  leafUuid: z.string().nullable(),
  isCompactSummary: z.boolean().nullable(),
  filename: z.string(),
  gitBranch: z.string().nullable()
})

// API response meta information
const MetaSchema = z.object({
  count: z.number(),
  queryDuration: z.number(),
  source: z.string()
})

// Complete API response schema
const EventsApiResponseSchema = z.object({
  events: z.array(EventSchema),
  meta: MetaSchema,
  error: z.string().optional()
})

// Export schemas and types
export {
  UsageSchema,
  MessageSchema,
  EventSchema,
  MetaSchema,
  EventsApiResponseSchema
}

// Export TypeScript types
export type Usage = z.infer<typeof UsageSchema>
export type Message = z.infer<typeof MessageSchema>
export type Event = z.infer<typeof EventSchema>
export type Meta = z.infer<typeof MetaSchema>
export type EventsApiResponse = z.infer<typeof EventsApiResponseSchema>