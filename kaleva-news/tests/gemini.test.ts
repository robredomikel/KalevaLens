import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { getAgentModel } from '@/lib/ai/config'
import { generateStructured, getGeminiClient, setGeminiClientForTests } from '@/lib/ai/gemini'

test('all agents share one API key while models remain independently configurable', () => {
  process.env.GEMINI_API_KEY = 'test-key'
  process.env.GEMINI_MODEL_DEFAULT = 'default-model'
  process.env.GEMINI_MODEL_TRANSLATION = 'translation-model'
  setGeminiClientForTests(null)
  assert.equal(getGeminiClient(), getGeminiClient())
  assert.equal(getAgentModel('translation'), 'translation-model')
  assert.equal(getAgentModel('classification'), 'default-model')
})

test('missing Gemini key fails clearly', () => {
  delete process.env.GEMINI_API_KEY
  setGeminiClientForTests(null)
  assert.throws(() => getGeminiClient(), /GEMINI_API_KEY is not configured/)
})

test('structured generation validates mocked Gemini JSON', async () => {
  process.env.GEMINI_API_KEY = 'test-key'
  const fake = {
    models: { generateContent: async () => ({ text: '{"value":42}', modelVersion: 'mock-model', usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 } }) },
  }
  setGeminiClientForTests(fake as never)
  const result = await generateStructured({ agent: 'classification', schema: z.object({ value: z.number() }), systemInstruction: 'test', prompt: 'test' })
  assert.deepEqual(result.data, { value: 42 })
  assert.equal(result.model, 'mock-model')
})

test('invalid structured responses are rejected after bounded retries', async () => {
  process.env.GEMINI_API_KEY = 'test-key'
  let calls = 0
  setGeminiClientForTests({
    models: { generateContent: async () => { calls += 1; return { text: '{"wrong":true}' } } },
  } as never)
  await assert.rejects(
    generateStructured({ agent: 'classification', schema: z.object({ value: z.number() }), systemInstruction: 'test', prompt: 'test' }),
    /failed after/,
  )
  assert.equal(calls, 3)
})

test('transient Gemini failures retry and can recover', async () => {
  process.env.GEMINI_API_KEY = 'test-key'
  let calls = 0
  setGeminiClientForTests({
    models: { generateContent: async () => {
      calls += 1
      if (calls === 1) throw new Error('temporary rate limit')
      return { text: '{"value":7}' }
    } },
  } as never)
  const result = await generateStructured({ agent: 'classification', schema: z.object({ value: z.number() }), systemInstruction: 'test', prompt: 'test' })
  assert.equal(result.data.value, 7)
  assert.equal(calls, 2)
})
