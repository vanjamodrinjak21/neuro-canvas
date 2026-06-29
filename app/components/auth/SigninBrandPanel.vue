<template>
  <div class="brand-panel">
    <NuxtLink to="/" class="brand-logo">
      <NcLogo :size="18" :container-size="32" :radius="8" />
      <span class="logo-text">NeuroCanvas</span>
    </NuxtLink>

    <div class="brand-content">
      <h1 class="brand-headline">{{ $t('auth.signin.brand_headline') }}</h1>
      <p class="brand-desc">{{ $t('auth.signin.brand_desc') }}</p>
    </div>

    <div class="testimonial">
      <p class="testimonial-quote">"{{ $t('auth.signin.testimonial_quote') }}"</p>
      <div class="testimonial-author">
        <div class="author-avatar">
          <span>AK</span>
        </div>
        <div class="author-info">
          <span class="author-name">{{ $t('auth.signin.testimonial_author') }}</span>
          <span class="author-role">{{ $t('auth.signin.testimonial_role') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<!-- Static marketing/brand side of the sign-in split. Extracted from signin.vue.
     The --a-* auth palette vars cascade in from .auth-page (unchanged DOM position). -->
<style scoped>
.brand-panel {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 640px;
  flex-shrink: 0;
  padding: 48px 56px;
  background: var(--a-surface);
  border-right: 1px solid var(--a-border);
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--a-text);
}

.logo-text {
  font-size: calc(17px * var(--nc-text-scale, 1));
  font-weight: 700;
  letter-spacing: -0.02em;
}

.brand-content {
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding-bottom: 80px;
}

.brand-headline {
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: calc(44px * var(--nc-text-scale, 1));
  font-weight: 400;
  font-style: italic;
  line-height: 52px;
  letter-spacing: -0.02em;
  margin: 0;
  color: var(--a-text);
}

.brand-desc {
  font-size: calc(16px * var(--nc-text-scale, 1));
  line-height: 26px;
  color: var(--a-text-3);
  margin: 0;
  max-width: 420px;
}

.testimonial {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 32px;
  border-top: 1px solid var(--a-border);
}

.testimonial-quote {
  font-size: calc(15px * var(--nc-text-scale, 1));
  font-style: italic;
  line-height: 24px;
  color: var(--a-text-2);
  margin: 0;
}

.testimonial-author {
  display: flex;
  align-items: center;
  gap: 12px;
}

.author-avatar {
  width: 36px;
  height: 36px;
  border-radius: 18px;
  background: var(--a-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--a-accent);
  flex-shrink: 0;
}

.author-name {
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--a-text);
}

.author-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.author-role {
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--a-text-3);
}

:root.light .author-avatar {
  background: #E8E8E6;
}

@media (max-width: 1366px) {
  .brand-panel {
    width: 520px;
    padding: 48px 48px;
  }

  .brand-headline {
    font-size: calc(38px * var(--nc-text-scale, 1));
    line-height: 46px;
  }

  .brand-desc {
    font-size: calc(15px * var(--nc-text-scale, 1));
    line-height: 24px;
  }
}

@media (max-width: 1024px) {
  .brand-panel {
    display: none;
  }
}
</style>
