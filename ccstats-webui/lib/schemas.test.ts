import { describe, expect, test } from 'vitest'
import {
  EventSchema,
  MessageSchema,
  UsageSchema,
  EventsApiResponseSchema,
  type Event,
  type Message,
  type Usage
} from './schemas'
import * as fs from 'fs'
import * as path from 'path'

describe('Schema Validation Tests', () => {
  describe('EventSchema', () => {
    test('should validate user message event', () => {
      const userEvent: Event = {
        uuid: 'b8329e59-14d1-4dd0-be10-e35c0cd75c8f',
        parentUuid: 'b43d625b-2874-4d29-bc17-a807a8765a15',
        leafUuid: null,
        isSidechain: false,
        userType: 'external',
        cwd: '/Users/strrl/playground/GitHub/ccstats/ccstats-webui',
        sessionId: 'c05abc44-e406-4f25-8082-6d53d4b57258',
        version: '1.0.56',
        type: 'user',
        message: {
          role: 'user',
          content: '"ls"',
          id: null,
          type: null,
          model: null,
          stop_reason: null,
          stop_sequence: null,
          usage: null
        },
        timestamp: '2025-07-20T19:54:10.838Z',
        isMeta: null,
        requestId: null,
        toolUseResult: null,
        isApiErrorMessage: null,
        content: null,
        toolUseID: null,
        level: null,
        summary: null,
        isCompactSummary: null,
        filename: '/Users/strrl/.claude/projects/-Users-strrl-playground-GitHub-ccstats-ccstats-webui/c05abc44-e406-4f25-8082-6d53d4b57258.jsonl',
        gitBranch: 'master'
      }

      const result = EventSchema.safeParse(userEvent)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('user')
        expect(result.data.message.role).toBe('user')
      }
    })

    test('should validate system message event', () => {
      const systemEvent: Event = {
        uuid: '33ce8635-cc3e-4fce-b68f-05f512b4bd70',
        parentUuid: '631eab8c-e5f7-4cd8-9f36-ed12576d994e',
        leafUuid: null,
        isSidechain: false,
        userType: 'external',
        cwd: '/Users/strrl/playground/GitHub/ccstats/ccstats-webui',
        sessionId: 'c05abc44-e406-4f25-8082-6d53d4b57258',
        version: '1.0.56',
        type: 'system',
        message: null as any, // System messages have null message
        timestamp: '2025-07-20T19:53:29.310Z',
        isMeta: false,
        requestId: null,
        toolUseResult: null,
        isApiErrorMessage: null,
        content: 'Running \u001b[1mPostToolUse:Read\u001b[22m...',
        toolUseID: 'toolu_01VCYyVKLvBrG6KAdqvHs5BC',
        level: 'info',
        summary: null,
        isCompactSummary: null,
        filename: '/Users/strrl/.claude/projects/-Users-strrl-playground-GitHub-ccstats-ccstats-webui/c05abc44-e406-4f25-8082-6d53d4b57258.jsonl',
        gitBranch: 'master'
      }

      const result = EventSchema.safeParse(systemEvent)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('system')
        expect(result.data.content).toBe('Running \u001b[1mPostToolUse:Read\u001b[22m...')
        expect(result.data.level).toBe('info')
      }
    })

    test('should validate assistant message with usage', () => {
      const assistantEvent = {
        uuid: 'a6757b62-0aa8-421c-84e2-50c6875fa052',
        parentUuid: '43b11f16-b227-4e01-b1a3-043257539827',
        leafUuid: null,
        isSidechain: false,
        userType: 'external',
        cwd: '/Users/strrl/playground/GitHub/ccstats/ccstats-webui',
        sessionId: 'c05abc44-e406-4f25-8082-6d53d4b57258',
        version: '1.0.56',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: '[{"type":"tool_use","id":"toolu_01VCYyVKLvBrG6KAdqvHs5BC","name":"Read","input":{"file_path":"/Users/strrl/playground/GitHub/ccstats/ccstats-webui/lib/schemas.test.ts","offset":149,"limit":40}}]',
          id: 'msg_01AdUz7vynbWJmrD9yz5QDwf',
          type: 'message',
          model: 'claude-opus-4-20250514',
          stop_reason: 'tool_use',
          stop_sequence: null,
          usage: {
            input_tokens: 3,
            cache_creation_input_tokens: 1279,
            cache_read_input_tokens: 66466,
            output_tokens: 160,
            service_tier: 'standard',
            server_tool_use: null
          }
        },
        timestamp: '2025-07-20T19:53:29.257Z',
        isMeta: null,
        requestId: 'req_011CRJrbFKyLF535RjBrDRrv',
        toolUseResult: null,
        isApiErrorMessage: null,
        content: null,
        toolUseID: null,
        level: null,
        summary: null,
        isCompactSummary: null,
        filename: '/Users/strrl/.claude/projects/-Users-strrl-playground-GitHub-ccstats-ccstats-webui/c05abc44-e406-4f25-8082-6d53d4b57258.jsonl',
        gitBranch: 'master'
      }

      const result = EventSchema.safeParse(assistantEvent)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('assistant')
        expect(result.data.message.role).toBe('assistant')
        expect(result.data.message.usage).not.toBeNull()
        expect(result.data.message.usage?.input_tokens).toBe(3)
      }
    })

    test('should validate events from example file', async () => {
      const examplePath = path.join(__dirname, 'events.example.json')
      if (!fs.existsSync(examplePath)) {
        console.warn('events.example.json not found, skipping test')
        return
      }

      const fileContent = fs.readFileSync(examplePath, 'utf-8')
      const data = JSON.parse(fileContent)
      
      // Test a few events from the file
      const eventsToTest = data.events.slice(0, 5) // Test first 5 events
      
      eventsToTest.forEach((event: any, index: number) => {
        const result = EventSchema.safeParse(event)
        if (!result.success) {
          console.error(`Event ${index} validation failed:`, result.error.issues)
        }
        expect(result.success).toBe(true)
      })
    })
  })

  describe('MessageSchema', () => {
    test('should validate user message', () => {
      const userMessage: Message = {
        role: 'user',
        content: '"ls"',
        id: null,
        type: null,
        model: null,
        stop_reason: null,
        stop_sequence: null,
        usage: null
      }

      const result = MessageSchema.safeParse(userMessage)
      expect(result.success).toBe(true)
    })

    test('should validate assistant message with usage', () => {
      const assistantMessage: Message = {
        role: 'assistant',
        content: 'Some response',
        id: 'msg_01AdUz7vynbWJmrD9yz5QDwf',
        type: 'message',
        model: 'claude-opus-4-20250514',
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: {
          input_tokens: 3,
          cache_creation_input_tokens: 1279,
          cache_read_input_tokens: 66466,
          output_tokens: 160,
          service_tier: 'standard',
          server_tool_use: null
        }
      }

      const result = MessageSchema.safeParse(assistantMessage)
      expect(result.success).toBe(true)
    })
  })

  describe('UsageSchema', () => {
    test('should validate complete usage data', () => {
      const usage: Usage = {
        input_tokens: 3,
        cache_creation_input_tokens: 1279,
        cache_read_input_tokens: 66466,
        output_tokens: 160,
        service_tier: 'standard',
        server_tool_use: null
      }

      const result = UsageSchema.safeParse(usage)
      expect(result.success).toBe(true)
    })

    test('should validate partial usage data', () => {
      const usage: Usage = {
        input_tokens: 100,
        output_tokens: 50
      }

      const result = UsageSchema.safeParse(usage)
      expect(result.success).toBe(true)
    })

    test('should accept string tokens', () => {
      const usage = {
        input_tokens: "100",
        output_tokens: "50"
      }

      const result = UsageSchema.safeParse(usage)
      expect(result.success).toBe(true)
    })
  })

  describe('EventsApiResponseSchema', () => {
    test('should validate complete API response', () => {
      const apiResponse = {
        events: [
          {
            uuid: 'b8329e59-14d1-4dd0-be10-e35c0cd75c8f',
            parentUuid: 'b43d625b-2874-4d29-bc17-a807a8765a15',
            leafUuid: null,
            isSidechain: false,
            userType: 'external',
            cwd: '/Users/strrl/playground/GitHub/ccstats/ccstats-webui',
            sessionId: 'c05abc44-e406-4f25-8082-6d53d4b57258',
            version: '1.0.56',
            type: 'user',
            message: {
              role: 'user',
              content: '"ls"',
              id: null,
              type: null,
              model: null,
              stop_reason: null,
              stop_sequence: null,
              usage: null
            },
            timestamp: '2025-07-20T19:54:10.838Z',
            isMeta: null,
            requestId: null,
            toolUseResult: null,
            isApiErrorMessage: null,
            content: null,
            toolUseID: null,
            level: null,
            summary: null,
            isCompactSummary: null,
            filename: '/Users/strrl/.claude/projects/-Users-strrl-playground-GitHub-ccstats-ccstats-webui/c05abc44-e406-4f25-8082-6d53d4b57258.jsonl',
            gitBranch: 'master'
          }
        ],
        meta: {
          count: 1,
          queryDuration: 123.45,
          source: 'duckdb'
        }
      }

      const result = EventsApiResponseSchema.safeParse(apiResponse)
      expect(result.success).toBe(true)
    })

    test('should validate API response with error', () => {
      const apiResponse = {
        events: [],
        meta: {
          count: 0,
          queryDuration: 0,
          source: 'error'
        },
        error: 'Database connection failed'
      }

      const result = EventsApiResponseSchema.safeParse(apiResponse)
      expect(result.success).toBe(true)
    })
  })
})