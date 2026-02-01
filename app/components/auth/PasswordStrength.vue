<script setup lang="ts">
export interface PasswordStrengthProps {
  password: string
}

const props = defineProps<PasswordStrengthProps>()

interface StrengthCheck {
  label: string
  test: (password: string) => boolean
}

const checks: StrengthCheck[] = [
  { label: '8+ characters', test: (p) => p.length >= 8 },
  { label: 'Uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'Number', test: (p) => /[0-9]/.test(p) }
]

const passedChecks = computed(() =>
  checks.filter(check => check.test(props.password))
)

const strength = computed(() => {
  const passed = passedChecks.value.length
  if (passed === 0) return { level: 0, label: '', color: '' }
  if (passed === 1) return { level: 1, label: 'Weak', color: '#EF4444' }
  if (passed === 2) return { level: 2, label: 'Fair', color: '#F59E0B' }
  if (passed === 3) return { level: 3, label: 'Good', color: '#22C55E' }
  return { level: 4, label: 'Strong', color: '#00D2BE' }
})

const allChecksPassed = computed(() => passedChecks.value.length === checks.length)
</script>

<template>
  <div v-if="password.length > 0" class="password-strength">
    <!-- Strength bar -->
    <div class="strength-bar-container">
      <div
        class="strength-bar"
        :style="{
          width: `${(strength.level / 4) * 100}%`,
          backgroundColor: strength.color
        }"
      />
    </div>

    <!-- Strength label -->
    <div v-if="strength.label" class="strength-label" :style="{ color: strength.color }">
      {{ strength.label }}
    </div>

    <!-- Requirements checklist -->
    <div class="requirements">
      <div
        v-for="check in checks"
        :key="check.label"
        class="requirement"
        :class="{ passed: check.test(password) }"
      >
        <span :class="check.test(password) ? 'i-lucide-check' : 'i-lucide-circle'" class="req-icon" />
        <span class="req-label">{{ check.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.password-strength {
  margin-top: 0.75rem;
}

.strength-bar-container {
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}

.strength-bar {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.strength-label {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.requirements {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.375rem;
  margin-top: 0.75rem;
}

.requirement {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.4);
  transition: color 0.2s ease;
}

.requirement.passed {
  color: var(--nc-teal, #00D2BE);
}

.req-icon {
  font-size: 0.75rem;
  flex-shrink: 0;
}

.req-label {
  white-space: nowrap;
}
</style>
