import React, { useState, useRef, useEffect } from 'react'
import { useChatStore } from '../../context/useChatStore'

interface ChatInterfaceProps {
  connId: string
}

export function ChatInterface({ connId }: ChatInterfaceProps) {
  const [input, setInput] = useState('')
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showApiKeyForm, setShowApiKeyForm] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const {
    messages,
    isLoading,
    streamingContent,
    addMessage,
    setLoading,
  } = useChatStore()

  // Check if API key is configured on mount
  useEffect(() => {
    window.api.claude.getApiKey().then((has: boolean) => setHasApiKey(has))
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSetApiKey = async () => {
    if (!apiKeyInput.trim()) return
    await window.api.claude.setApiKey(apiKeyInput.trim())
    setHasApiKey(true)
    setShowApiKeyForm(false)
    setApiKeyInput('')
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMsg = {
      id: `msg_${Date.now()}`,
      role: 'user' as const,
      content: input.trim(),
      timestamp: Date.now(),
    }
    addMessage(userMsg)
    setInput('')
    setLoading(true)

    try {
      const response = await window.api.claude.chat(connId, [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: input.trim() },
      ])

      const assistantMsg = {
        id: `msg_${Date.now()}`,
        role: 'assistant' as const,
        content: response.content || response,
        timestamp: Date.now(),
      }
      addMessage(assistantMsg)
    } catch (err: any) {
      addMessage({
        id: `msg_${Date.now()}`,
        role: 'system' as const,
        content: `Error: ${err.message}`,
        timestamp: Date.now(),
      })
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleRunCommand = async (command: string) => {
    try {
      const result = await window.api.claude.execute(connId, command)
      addMessage({
        id: `msg_${Date.now()}`,
        role: 'system' as const,
        content: `Command executed: \`${command}\``,
        timestamp: Date.now(),
        commandOutput: {
          command,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        },
      })
    } catch (err: any) {
      addMessage({
        id: `msg_${Date.now()}`,
        role: 'system' as const,
        content: `Command failed: ${err.message}`,
        timestamp: Date.now(),
      })
    }
  }

  const renderMessage = (msg: any) => {
    const isUser = msg.role === 'user'
    const isSystem = msg.role === 'system'

    return (
      <div
        key={msg.id}
        style={{
          ...styles.message,
          alignSelf: isUser ? 'flex-end' : 'flex-start',
          background: isUser
            ? 'var(--accent)'
            : isSystem
            ? 'var(--bg-tertiary)'
            : 'var(--bg-secondary)',
          maxWidth: '80%',
        }}
      >
        <div style={styles.messageRole}>
          {isUser ? 'You' : isSystem ? 'System' : 'Claude'}
        </div>
        <div style={styles.messageContent}>
          {renderContent(msg.content)}
        </div>
        {msg.commandOutput && (
          <div style={styles.commandOutput}>
            <div style={styles.commandHeader}>
              $ {msg.commandOutput.command}
              <span
                style={{
                  color:
                    msg.commandOutput.exitCode === 0
                      ? 'var(--success)'
                      : 'var(--error)',
                }}
              >
                {' '}
                (exit: {msg.commandOutput.exitCode})
              </span>
            </div>
            {msg.commandOutput.stdout && (
              <pre style={styles.commandPre}>{msg.commandOutput.stdout}</pre>
            )}
            {msg.commandOutput.stderr && (
              <pre style={{ ...styles.commandPre, color: 'var(--error)' }}>
                {msg.commandOutput.stderr}
              </pre>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderContent = (content: string) => {
    // Simple code block detection
    const parts = content.split(/(```[\s\S]*?```)/g)
    return parts.map((part, i) => {
      if (part.startsWith('```')) {
        const lines = part.slice(3, -3).split('\n')
        const lang = lines[0] || ''
        const code = lines.slice(1).join('\n')
        return (
          <div key={i} style={styles.codeBlock}>
            {lang && <div style={styles.codeLang}>{lang}</div>}
            <pre style={styles.codePre}>{code || lines.join('\n')}</pre>
            <button
              style={styles.runBtn}
              onClick={() => handleRunCommand(code || lines.join('\n'))}
            >
              Run on VPS
            </button>
          </div>
        )
      }
      return (
        <span key={i} style={{ whiteSpace: 'pre-wrap' as const }}>
          {part}
        </span>
      )
    })
  }

  return (
    <div style={styles.container}>
      {/* Messages */}
      <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.welcome}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>
              {'\u{1F916}'}
            </div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>
              Claude Assistant
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px' }}>
              Ask Claude to help with your VPS. Code blocks can be run directly
              on the server.
            </p>
            {hasApiKey === false && !showApiKeyForm && (
              <button style={styles.apiKeyBtn} onClick={() => setShowApiKeyForm(true)}>
                Set Anthropic API Key to get started
              </button>
            )}
            {showApiKeyForm && (
              <div style={styles.apiKeyForm}>
                <input
                  style={styles.apiKeyInput}
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSetApiKey() }}
                  placeholder="sk-ant-..."
                  autoFocus
                />
                <button style={styles.apiKeySaveBtn} onClick={handleSetApiKey}>Save</button>
                <button
                  style={{ ...styles.apiKeyBtn, background: 'var(--bg-tertiary)' }}
                  onClick={() => setShowApiKeyForm(false)}
                >
                  Cancel
                </button>
              </div>
            )}
            {hasApiKey && (
              <button
                style={{ ...styles.apiKeyBtn, background: 'var(--bg-tertiary)', fontSize: '11px' }}
                onClick={() => setShowApiKeyForm(true)}
              >
                Change API Key
              </button>
            )}
          </div>
        )}
        {messages.map(renderMessage)}
        {isLoading && (
          <div
            style={{
              ...styles.message,
              background: 'var(--bg-secondary)',
              alignSelf: 'flex-start',
            }}
          >
            <div style={styles.messageRole}>Claude</div>
            <div style={styles.typing}>Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={styles.inputArea}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Claude about your VPS... (Enter to send, Shift+Enter for new line)"
          style={styles.input}
          rows={3}
        />
        <button
          style={{
            ...styles.sendBtn,
            opacity: input.trim() && !isLoading ? 1 : 0.5,
          }}
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
        >
          Send
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  messages: {
    flex: 1,
    overflow: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  welcome: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    textAlign: 'center' as const,
  },
  message: {
    padding: '10px 14px',
    borderRadius: 'var(--radius)',
    fontSize: '13px',
    lineHeight: '1.5',
  },
  messageRole: {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: 'var(--text-muted)',
    marginBottom: '4px',
  },
  messageContent: {
    color: 'var(--text-primary)',
  },
  typing: {
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  codeBlock: {
    background: 'var(--bg-primary)',
    borderRadius: 'var(--radius-sm)',
    marginTop: '8px',
    overflow: 'hidden',
    border: '1px solid var(--border)',
  },
  codeLang: {
    padding: '4px 10px',
    fontSize: '10px',
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-tertiary)',
  },
  codePre: {
    padding: '10px',
    margin: 0,
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    color: 'var(--text-primary)',
    overflow: 'auto',
    maxHeight: '200px',
    whiteSpace: 'pre-wrap' as const,
  },
  runBtn: {
    width: '100%',
    padding: '6px',
    border: 'none',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-tertiary)',
    color: 'var(--accent)',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  commandOutput: {
    marginTop: '8px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
  },
  commandHeader: {
    padding: '6px 10px',
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    background: 'var(--bg-tertiary)',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-secondary)',
  },
  commandPre: {
    padding: '8px 10px',
    margin: 0,
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--text-primary)',
    maxHeight: '150px',
    overflow: 'auto',
    whiteSpace: 'pre-wrap' as const,
  },
  inputArea: {
    borderTop: '1px solid var(--border)',
    padding: '12px',
    background: 'var(--bg-secondary)',
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    resize: 'none' as const,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    fontSize: '13px',
    padding: '10px 12px',
    outline: 'none',
    lineHeight: '1.4',
  },
  apiKeyBtn: {
    padding: '8px 16px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  apiKeyForm: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginTop: '8px',
  },
  apiKeyInput: {
    padding: '8px 12px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontFamily: 'var(--font-mono)',
    width: '280px',
    outline: 'none',
  },
  apiKeySaveBtn: {
    padding: '8px 16px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  sendBtn: {
    padding: '10px 20px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    flexShrink: 0,
  },
}
