<script setup lang="ts">
import type { AgentAction, AgentMessage } from '~/ai/types/agent'
import { useAIAgent } from '~/composables/useAIAgent'
import { useMapStore } from '~/stores/mapStore'
import AgentActionCard from './AgentActionCard.vue'

const emit = defineEmits<{
  'apply-action': [action: AgentAction]
  'close': []
}>()

const mapStore = useMapStore()
const agent = useAIAgent()

const userInput = ref('')
const chatContainer = ref<HTMLElement | null>(null)

// Auto-scroll to bottom on new messages
watch(() => agent.messages.value.length, () => {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
})

// Also scroll during streaming
watch(() => agent.streamingContent.value, () => {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
})

async function handleStart() {
  await agent.startSession(mapStore.nodes, mapStore.edges, mapStore.title)
}

async function handleSend() {
  const text = userInput.value.trim()
  if (!text || agent.isThinking.value) return
  userInput.value = ''
  await agent.sendMessage(text)
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function handleAcceptAction(action: AgentAction) {
  agent.applyAction(action)
  emit('apply-action', action)
}

function handleDismissAction(action: AgentAction) {
  agent.dismissAction(action)
}

function handleEnd() {
  agent.endSession()
}
</script>

<template>
  <div class="nc-agent-panel">
    <!-- Header -->
    <div class="nc-agent-header">
      <span class="flex items-center gap-2">
        <span class="i-lucide-bot text-sm text-[#A78BFA]" />
        <span class="font-semibold text-xs text-[#FAFAFA]">AI Agent</span>
      </span>
      <div class="flex items-center gap-2">
        <button
          v-if="agent.isActive.value"
          class="nc-agent-end-btn"
          @click="handleEnd"
        >
          End
        </button>
        <button class="nc-agent-close-btn" @click="emit('close')">
          <span class="i-lucide-x text-xs" />
        </button>
      </div>
    </div>

    <!-- Not started state -->
    <div v-if="!agent.isActive.value" class="nc-agent-start">
      <span class="i-lucide-bot text-3xl text-[#444448] mb-3" />
      <p class="text-xs text-[#666670] mb-3 text-center">
        Start a conversation about your map. The AI agent can suggest additions, connections, and restructuring.
      </p>
      <button class="nc-agent-start-btn" @click="handleStart">
        <span class="i-lucide-sparkles text-sm" />
        Start Session
      </button>
    </div>

    <!-- Chat area -->
    <template v-else>
      <div ref="chatContainer" class="nc-agent-chat">
        <!-- Messages -->
        <div
          v-for="msg in agent.messages.value"
          :key="msg.id"
          :class="['nc-agent-msg', msg.role === 'user' ? 'nc-agent-msg-user' : 'nc-agent-msg-assistant']"
        >
          <div class="nc-agent-msg-bubble">
            {{ msg.content }}
          </div>

          <!-- Inline actions from this message -->
          <div v-if="msg.actions && msg.actions.length > 0" class="nc-agent-msg-actions">
            <AgentActionCard
              v-for="(action, i) in msg.actions"
              :key="`${msg.id}-action-${i}`"
              :action="action"
              @accept="handleAcceptAction"
              @dismiss="handleDismissAction"
            />
          </div>
        </div>

        <!-- Streaming indicator -->
        <div v-if="agent.isThinking.value" class="nc-agent-msg nc-agent-msg-assistant">
          <div class="nc-agent-msg-bubble nc-agent-streaming">
            {{ agent.streamingContent.value || '...' }}
            <span class="nc-agent-cursor" />
          </div>
        </div>
      </div>

      <!-- Pending actions (not yet applied) -->
      <div v-if="agent.pendingActions.value.length > 0" class="nc-agent-pending">
        <div class="nc-agent-pending-label">Pending Actions</div>
        <AgentActionCard
          v-for="(action, i) in agent.pendingActions.value"
          :key="`pending-${i}`"
          :action="action"
          @accept="handleAcceptAction"
          @dismiss="handleDismissAction"
        />
      </div>

      <!-- Input -->
      <div class="nc-agent-input-area">
        <textarea
          v-model="userInput"
          class="nc-agent-input"
          placeholder="Ask about your map..."
          :disabled="agent.isThinking.value"
          rows="1"
          @keydown="handleKeyDown"
        />
        <button
          class="nc-agent-send-btn"
          :disabled="!userInput.trim() || agent.isThinking.value"
          @click="handleSend"
        >
          <span
            :class="agent.isThinking.value ? 'i-lucide-loader-2 animate-spin' : 'i-lucide-send'"
            class="text-sm"
          />
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.nc-agent-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 500px;
}

.nc-agent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #1A1A1E;
}

.nc-agent-end-btn {
  font-size: 10px;
  color: #FB923C;
  background: rgba(251, 146, 60, 0.1);
  border: 1px solid rgba(251, 146, 60, 0.3);
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.nc-agent-end-btn:hover {
  background: rgba(251, 146, 60, 0.2);
}

.nc-agent-close-btn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: #555558;
  cursor: pointer;
}

.nc-agent-close-btn:hover {
  color: #FAFAFA;
  background: #2A2A30;
}

.nc-agent-start {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.nc-agent-start-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(167, 139, 250, 0.1);
  border: 1px solid rgba(167, 139, 250, 0.3);
  border-radius: 6px;
  color: #A78BFA;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nc-agent-start-btn:hover {
  background: rgba(167, 139, 250, 0.15);
  border-color: #A78BFA;
}

.nc-agent-chat {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.nc-agent-msg {
  display: flex;
  flex-direction: column;
}

.nc-agent-msg-user {
  align-items: flex-end;
}

.nc-agent-msg-assistant {
  align-items: flex-start;
}

.nc-agent-msg-bubble {
  max-width: 85%;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.nc-agent-msg-user .nc-agent-msg-bubble {
  background: rgba(0, 210, 190, 0.15);
  color: #FAFAFA;
  border-bottom-right-radius: 4px;
}

.nc-agent-msg-assistant .nc-agent-msg-bubble {
  background: #1A1A1E;
  color: #CCCCCC;
  border-bottom-left-radius: 4px;
}

.nc-agent-streaming {
  opacity: 0.8;
}

.nc-agent-cursor {
  display: inline-block;
  width: 2px;
  height: 14px;
  background: #A78BFA;
  margin-left: 2px;
  animation: blink 1s infinite;
  vertical-align: text-bottom;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.nc-agent-msg-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
  max-width: 85%;
}

.nc-agent-pending {
  padding: 8px 12px;
  border-top: 1px solid #1A1A1E;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nc-agent-pending-label {
  font-size: 10px;
  font-weight: 600;
  color: #666670;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.nc-agent-input-area {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid #1A1A1E;
}

.nc-agent-input {
  flex: 1;
  background: #141418;
  border: 1px solid #2A2A30;
  border-radius: 8px;
  padding: 8px 12px;
  color: #FAFAFA;
  font-size: 12px;
  resize: none;
  outline: none;
  font-family: inherit;
  max-height: 80px;
}

.nc-agent-input:focus {
  border-color: #A78BFA;
}

.nc-agent-input::placeholder {
  color: #444448;
}

.nc-agent-send-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(167, 139, 250, 0.15);
  border: 1px solid rgba(167, 139, 250, 0.3);
  border-radius: 8px;
  color: #A78BFA;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nc-agent-send-btn:hover:not(:disabled) {
  background: rgba(167, 139, 250, 0.25);
  border-color: #A78BFA;
}

.nc-agent-send-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
</style>
