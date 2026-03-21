import { create } from 'zustand'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  commandOutput?: {
    command: string
    stdout: string
    stderr: string
    exitCode: number
  }
}

interface ChatStore {
  messages: ChatMessage[]
  isLoading: boolean
  streamingContent: string

  addMessage: (message: ChatMessage) => void
  setLoading: (loading: boolean) => void
  setStreamingContent: (content: string) => void
  appendStreamingContent: (chunk: string) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isLoading: false,
  streamingContent: '',

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
      streamingContent: '',
    })),

  setLoading: (loading) => set({ isLoading: loading }),

  setStreamingContent: (content) => set({ streamingContent: content }),

  appendStreamingContent: (chunk) =>
    set((state) => ({
      streamingContent: state.streamingContent + chunk,
    })),

  clearMessages: () =>
    set({ messages: [], streamingContent: '' }),
}))
