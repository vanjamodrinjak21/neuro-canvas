<template>
  <footer class="footer">
    <div class="footer-brand">
      <div class="footer-brand-row">
        <NcLogo :size="11" :container-size="18" :radius="5" />
        <span class="footer-brand-name">NeuroCanvas</span>
      </div>
      <span class="footer-meta">{{ $t('landing.footer.version_meta') }}</span>
      <span class="footer-meta footer-meta--credit">{{ $t('landing.footer.made_by') }}</span>
    </div>
    <div class="footer-cols">
      <div class="footer-col">
        <span class="footer-col-head">{{ $t('landing.footer.product_head') }}</span>
        <NuxtLink to="/templates">{{ $t('landing.footer.templates_link') }}</NuxtLink>
        <NuxtLink to="/download">{{ $t('landing.footer.download_link') }}</NuxtLink>
        <NuxtLink to="/roadmap">{{ $t('landing.footer.roadmap_link') }}</NuxtLink>
      </div>
      <div class="footer-col">
        <span class="footer-col-head">{{ $t('landing.footer.resources_head') }}</span>
        <NuxtLink to="/docs">{{ $t('landing.footer.docs_link') }}</NuxtLink>
        <a href="https://github.com/vanjamodrinjak21/neuro-canvas" target="_blank" rel="noopener">{{ $t('landing.footer.github_link') }}</a>
      </div>
      <div class="footer-col">
        <span class="footer-col-head">{{ $t('landing.footer.company_head') }}</span>
        <NuxtLink to="/privacy">{{ $t('landing.footer.privacy_link') }}</NuxtLink>
        <NuxtLink to="/terms">{{ $t('landing.footer.terms_link') }}</NuxtLink>
        <a href="mailto:hello@neurocanvas.app">{{ $t('landing.footer.contact_link') }}</a>
      </div>
    </div>
  </footer>
</template>

<!--
  Extracted verbatim from index.vue's landing footer. CSS custom properties
  (--border, --text*, --sans, --mono, --nc-text-scale) cascade in from the
  landing wrapper through the unchanged DOM position, so no var redefinition
  is needed here.
-->
<style scoped>
.footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 48px 56px 36px;
  border-top: 1px solid var(--border);
}

.footer-brand {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.footer-brand-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.footer-brand-name {
  font-family: var(--sans);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 16px;
  color: var(--text-2);
}

.footer-meta {
  font-family: var(--mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  line-height: 14px;
  color: var(--text-3);
}

.footer-meta--credit {
  font-weight: 500;
  letter-spacing: 0.04em;
  margin-top: 6px;
}

.footer-cols {
  display: flex;
  align-items: flex-start;
  gap: 32px;
}

.footer-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-self: flex-start;
}

.footer-col-head {
  font-family: var(--sans);
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 16px;
  color: var(--text-3);
}

.footer-col a {
  font-family: var(--sans);
  font-size: calc(13px * var(--nc-text-scale, 1));
  line-height: 16px;
  color: var(--text-2);
  text-decoration: none;
  transition: color 120ms ease;
}

.footer-col a:hover { color: var(--text); }

@media (max-width: 1280px) {
  .footer { padding-left: 32px; padding-right: 32px; }
}

@media (max-width: 768px) {
  .footer { flex-direction: column; align-items: flex-start; gap: 32px; padding: 32px 20px; }
  .footer-cols { flex-wrap: wrap; gap: 24px; }
}
</style>
