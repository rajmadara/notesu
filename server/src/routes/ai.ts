import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'

export type NoteFormatMode = 'formal' | 'informal' | 'summarize'

const MODE_INSTRUCTIONS: Record<NoteFormatMode, string> = {
  formal:
    'Rewrite the note in a formal, professional tone suitable for sharing with colleagues or management. Fix grammar and spelling. Preserve every fact, name, number, and date exactly.',
  informal:
    'Rewrite the note in a relaxed, casual, conversational tone. Keep it natural and friendly. Preserve every fact, name, number, and date exactly.',
  summarize:
    'Summarize the note into its essential points, as briefly as possible without losing any important fact, name, number, or date. Use short sentences or a compact bullet list if there are multiple distinct points.',
}

export function createAiRouter(): Router {
  const router = Router()

  // Lazily constructed so the server still boots without a key;
  // the route itself reports a clear error if the key is missing.
  let client: Anthropic | null = null

  router.post('/format-note', async (req, res) => {
    const content = String(req.body.content ?? '').trim()
    const mode = req.body.mode as NoteFormatMode

    if (!content) {
      res.status(400).json({ error: 'Note is empty — nothing to format.' })
      return
    }
    if (!MODE_INSTRUCTIONS[mode]) {
      res.status(400).json({ error: `Unknown mode: ${String(mode)}` })
      return
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(503).json({
        error:
          'AI formatting is not configured. Add ANTHROPIC_API_KEY to server/.env and restart the server.',
      })
      return
    }

    client ??= new Anthropic()

    try {
      const response = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 4096,
        thinking: { type: 'adaptive' },
        system:
          'You transform personal task notes. Respond with ONLY the transformed note text — no preamble, no explanations, no quotation marks around the result. Keep the same language the note was written in.',
        messages: [
          {
            role: 'user',
            content: `${MODE_INSTRUCTIONS[mode]}\n\nNote:\n${content}`,
          },
        ],
      })

      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('')
        .trim()

      if (!text) {
        res.status(502).json({ error: 'The model returned an empty result.' })
        return
      }
      res.json({ content: text })
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) {
        res.status(503).json({
          error: 'Invalid Anthropic API key. Check ANTHROPIC_API_KEY in server/.env.',
        })
      } else if (error instanceof Anthropic.RateLimitError) {
        res.status(429).json({ error: 'Rate limited — try again in a moment.' })
      } else if (error instanceof Anthropic.APIError) {
        res.status(502).json({ error: `AI request failed: ${error.message}` })
      } else {
        res.status(500).json({ error: 'Unexpected error calling the AI service.' })
      }
    }
  })

  return router
}
