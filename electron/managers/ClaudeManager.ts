import log from 'electron-log'
import * as https from 'https'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export class ClaudeManager {
  private apiKey: string | null = null

  setApiKey(key: string) {
    this.apiKey = key
  }

  getApiKey(): string | null {
    return this.apiKey
  }

  async chat(messages: Message[], systemPrompt?: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        'Anthropic API key not set. Go to the chat tab and click "Set API Key" to configure it.'
      )
    }

    const body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system:
        systemPrompt ||
        'You are a helpful assistant integrated into a VPS management application. Help the user manage their server, write scripts, debug issues, and understand system administration. When suggesting commands, wrap them in code blocks so the user can run them directly on their VPS.',
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    })

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'api.anthropic.com',
          path: '/v1/messages',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey!,
            'anthropic-version': '2023-06-01',
          },
        },
        (res) => {
          let data = ''
          res.on('data', (chunk) => (data += chunk))
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data)

              if (res.statusCode !== 200) {
                const errMsg =
                  parsed?.error?.message || `API error (${res.statusCode})`
                log.error('Claude API error:', errMsg)
                reject(new Error(errMsg))
                return
              }

              const content = parsed?.content?.[0]?.text
              if (!content) {
                reject(new Error('Empty response from Claude API'))
                return
              }

              resolve(content)
            } catch (err) {
              log.error('Failed to parse Claude API response:', err)
              reject(new Error('Failed to parse API response'))
            }
          })
        }
      )

      req.on('error', (err) => {
        log.error('Claude API request failed:', err)
        reject(new Error(`API request failed: ${err.message}`))
      })

      req.write(body)
      req.end()
    })
  }
}
