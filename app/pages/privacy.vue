<script setup lang="ts">
definePageMeta({ layout: false })

useHead({ title: 'Privacy Policy - NeuroCanvas' })
</script>

<template>
  <LegalLayout title="Privacy Policy" last-updated="March 24, 2026">
    <h2>1. Introduction</h2>
    <p>
      NeuroCanvas ("we", "us", "our") is a mind mapping application developed and operated by
      Vanja Modrinjak, an individual developer based in Croatia. This Privacy Policy explains how
      we collect, use, store, and protect your personal information when you use the NeuroCanvas
      web application at <a href="https://neuro-canvas.com">neuro-canvas.com</a>, the NeuroCanvas
      desktop application (Tauri), the NeuroCanvas mobile application (Capacitor), and any
      associated services (collectively, the "Service").
    </p>
    <p>
      By creating an account or using the Service, you agree to the collection and use of
      information in accordance with this policy. If you do not agree, please do not use the
      Service.
    </p>

    <h2>2. Information We Collect</h2>

    <h3>2.1 Account Information</h3>
    <p>When you create an account, we collect:</p>
    <ul>
      <li><strong>Email address</strong> — used for authentication, account recovery, and transactional emails</li>
      <li><strong>Display name</strong> — optional, used within the application interface</li>
      <li><strong>Password hash</strong> — if you sign up with email/password credentials (we never store plaintext passwords)</li>
      <li><strong>OAuth profile data</strong> — if you sign in via Google or GitHub, we receive your name, email address, and profile picture URL from the OAuth provider</li>
    </ul>

    <h3>2.2 Map and Content Data</h3>
    <p>
      The core purpose of NeuroCanvas is to create and manage mind maps. We store the following
      content you create:
    </p>
    <ul>
      <li>Mind map metadata (titles, descriptions, creation and modification dates)</li>
      <li>Nodes (text content, position, styling, metadata)</li>
      <li>Edges (connections between nodes and their properties)</li>
      <li>Map settings and layout preferences</li>
    </ul>

    <h3>2.3 User Preferences</h3>
    <p>We store your application preferences, including:</p>
    <ul>
      <li>Theme selection (light, dark, or system)</li>
      <li>AI provider configurations (see Section 4 for details)</li>
      <li>Editor and canvas preferences</li>
    </ul>

    <h3>2.4 Technical Data</h3>
    <p>
      When you use the Service, we may automatically collect limited technical information
      necessary for the operation of the Service:
    </p>
    <ul>
      <li>Authentication session tokens</li>
      <li>IP addresses (in server access logs, retained temporarily)</li>
      <li>Browser type and version (from standard HTTP headers)</li>
    </ul>
    <p>
      We do not currently use any analytics services, tracking pixels, or behavioral tracking
      tools. If this changes in the future, this policy will be updated accordingly.
    </p>

    <h3>2.5 Client-Side Storage</h3>
    <p>
      The NeuroCanvas web application uses your browser's IndexedDB for local caching of map data
      to improve performance and enable offline access. This data remains on your device and is
      not transmitted to our servers beyond what is necessary for synchronization.
    </p>
    <p>
      We also store your theme preference in <code>localStorage</code>.
    </p>

    <h2>3. How We Use Your Information</h2>
    <p>We use your information for the following purposes:</p>
    <ul>
      <li><strong>Providing the Service</strong> — storing and rendering your mind maps, authenticating your sessions, and syncing data across your devices</li>
      <li><strong>Account management</strong> — enabling sign-in, account recovery, and profile management</li>
      <li><strong>Transactional emails</strong> — sending verification emails, password reset links, and essential account notifications via our email provider (Resend)</li>
      <li><strong>Service improvement</strong> — diagnosing technical issues and improving reliability</li>
      <li><strong>Security</strong> — detecting and preventing unauthorized access, abuse, or fraud</li>
    </ul>
    <p>
      We do not sell your personal information. We do not use your data for advertising. We do
      not profile you for marketing purposes.
    </p>

    <h2>4. Third-Party AI Providers</h2>
    <p>
      NeuroCanvas allows you to configure third-party AI providers (such as OpenAI, Anthropic,
      Google, and others) to power AI-assisted features within the application. This section is
      critical to understand:
    </p>
    <ul>
      <li>
        <strong>Your API keys.</strong> When you configure an AI provider, you supply your own API
        key. Your API key is stored in our database associated with your account. We use it solely
        to make API requests on your behalf.
      </li>
      <li>
        <strong>Your data is sent to those providers.</strong> When you use AI features,
        the content of your mind map nodes and any prompts you provide are sent to the third-party
        AI provider you have configured. This data transmission is governed by that provider's
        own privacy policy and terms of service.
      </li>
      <li>
        <strong>We do not control third-party providers.</strong> We have no control over how
        OpenAI, Anthropic, Google, or any other AI provider processes, stores, or uses the data
        you send to them. You should review their respective privacy policies before configuring
        them in NeuroCanvas.
      </li>
      <li>
        <strong>AI features are optional.</strong> You are not required to configure any AI
        provider. NeuroCanvas functions fully as a mind mapping tool without AI features.
      </li>
    </ul>

    <h3>4.1 Desktop Local Inference (Beta)</h3>
    <p>
      The NeuroCanvas desktop application (Tauri) includes an optional beta feature for local
      machine learning inference using ONNX Runtime. When using local inference, your data is
      processed entirely on your device and is not sent to any external server. This feature is
      provided as-is during the beta period.
    </p>

    <h2>5. Data Storage and Security</h2>

    <h3>5.1 Where Your Data Is Stored</h3>
    <p>
      Your account information and map data are stored in a PostgreSQL database hosted on
      infrastructure we manage. Server-side data is stored in data centers within the European
      Union unless otherwise noted.
    </p>

    <h3>5.2 Security Measures</h3>
    <p>We implement reasonable security measures to protect your data, including:</p>
    <ul>
      <li>Encrypted connections (HTTPS/TLS) for all data in transit</li>
      <li>Hashed passwords using industry-standard algorithms (bcrypt)</li>
      <li>Secure, HTTP-only session cookies for authentication</li>
      <li>Access controls limiting who can access the production database</li>
    </ul>
    <p>
      However, no method of electronic storage or transmission is 100% secure. While we strive
      to protect your information, we cannot guarantee absolute security.
    </p>

    <h3>5.3 Data Retention</h3>
    <p>
      We retain your account data and map content for as long as your account is active. If you
      delete your account, we will delete your personal data and map content from our active
      database within 30 days. Residual copies in backups may persist for up to 90 days before
      being overwritten.
    </p>

    <h2>6. Cookies and Local Storage</h2>
    <p>NeuroCanvas uses minimal cookies and local storage:</p>
    <ul>
      <li>
        <strong>Session cookie</strong> — A secure, HTTP-only cookie set by NextAuth.js to
        maintain your authenticated session. This is strictly necessary for the Service to
        function and cannot be disabled while using an account.
      </li>
      <li>
        <strong>Theme preference</strong> — Stored in your browser's <code>localStorage</code>
        to remember your light/dark mode selection. This never leaves your device.
      </li>
      <li>
        <strong>IndexedDB cache</strong> — Used to cache map data locally for performance and
        offline capability. This data stays on your device.
      </li>
    </ul>
    <p>
      We do not use advertising cookies, tracking cookies, or any third-party cookie-based
      analytics.
    </p>

    <h2>7. Third-Party Services</h2>
    <p>
      We use the following third-party services that may process your data in the course of
      providing the Service:
    </p>
    <ul>
      <li>
        <strong>Google OAuth</strong> — for authentication. Subject to
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google's Privacy Policy</a>.
      </li>
      <li>
        <strong>GitHub OAuth</strong> — for authentication. Subject to
        <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer">GitHub's Privacy Statement</a>.
      </li>
      <li>
        <strong>Resend</strong> — for transactional email delivery (verification, password
        reset). Subject to
        <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Resend's Privacy Policy</a>.
      </li>
      <li>
        <strong>AI providers (user-configured)</strong> — OpenAI, Anthropic, Google, and others as
        configured by you. See Section 4 above.
      </li>
    </ul>

    <h2>8. Your Rights</h2>
    <p>
      Depending on your jurisdiction (including under the EU General Data Protection Regulation),
      you may have the following rights regarding your personal data:
    </p>
    <ul>
      <li><strong>Access</strong> — Request a copy of the personal data we hold about you</li>
      <li><strong>Rectification</strong> — Request correction of inaccurate personal data</li>
      <li><strong>Erasure</strong> — Request deletion of your personal data ("right to be forgotten")</li>
      <li><strong>Data portability</strong> — Request an export of your data in a machine-readable format</li>
      <li><strong>Restriction</strong> — Request that we limit processing of your personal data</li>
      <li><strong>Objection</strong> — Object to processing of your personal data</li>
      <li><strong>Withdraw consent</strong> — Where processing is based on consent, withdraw it at any time</li>
    </ul>
    <p>
      To exercise any of these rights, contact us at the email address listed in Section 13.
      We will respond to your request within 30 days.
    </p>
    <p>
      You can also delete your account at any time from the Settings page within the application,
      which will initiate deletion of all your associated data.
    </p>

    <h2>9. Data Export</h2>
    <p>
      NeuroCanvas provides built-in export functionality that allows you to download your mind
      maps in standard formats. You may export your data at any time from within the application.
    </p>

    <h2>10. Self-Hosted Instances</h2>
    <p>
      NeuroCanvas can be self-hosted. If you deploy NeuroCanvas on your own infrastructure, you
      are the data controller for all data processed by that instance. This Privacy Policy applies
      only to the Service as hosted at <a href="https://neuro-canvas.com">neuro-canvas.com</a>
      and operated by us. Self-hosted instance operators are responsible for their own privacy
      policies and data handling practices.
    </p>

    <h2>11. Children's Privacy</h2>
    <p>
      NeuroCanvas is not directed at children under the age of 16. We do not knowingly collect
      personal information from children under 16. If we become aware that we have collected
      personal data from a child under 16, we will take steps to delete that information promptly.
      If you believe a child under 16 has provided us with personal data, please contact us.
    </p>

    <h2>12. Changes to This Policy</h2>
    <p>
      We may update this Privacy Policy from time to time. When we make changes, we will update
      the "Last updated" date at the top of this page. For significant changes, we will make
      reasonable efforts to notify you (for example, via a banner in the application or an email
      to your registered address).
    </p>
    <p>
      Your continued use of the Service after changes are posted constitutes acceptance of the
      updated policy.
    </p>

    <h2>13. Contact</h2>
    <p>
      If you have questions about this Privacy Policy, want to exercise your data rights, or have
      concerns about how your information is handled, you can reach us at:
    </p>
    <ul>
      <li><strong>Email:</strong> <a href="mailto:privacy@neuro-canvas.com">privacy@neuro-canvas.com</a></li>
      <li><strong>Developer:</strong> Vanja Modrinjak</li>
      <li><strong>Website:</strong> <a href="https://neuro-canvas.com">neuro-canvas.com</a></li>
    </ul>

    <h2>14. Legal Basis for Processing (GDPR)</h2>
    <p>
      For users in the European Economic Area, we process personal data under the following
      legal bases:
    </p>
    <ul>
      <li>
        <strong>Contract performance</strong> — Processing necessary to provide the Service you
        signed up for (account data, map storage, authentication)
      </li>
      <li>
        <strong>Legitimate interest</strong> — Processing necessary for security, fraud
        prevention, and service reliability
      </li>
      <li>
        <strong>Consent</strong> — Where you actively choose to use optional features such as
        third-party AI integrations
      </li>
    </ul>

    <h2>15. International Data Transfers</h2>
    <p>
      If you access the Service from outside the European Union, your data may be transferred
      to and processed in the EU. When third-party services (OAuth providers, email services, AI
      providers) process your data, transfers may occur to jurisdictions outside the EU. These
      transfers rely on the safeguards provided by each respective service (such as Standard
      Contractual Clauses or adequacy decisions).
    </p>
  </LegalLayout>
</template>

<style scoped>
/* Layout handles all prose styling via :deep() selectors */
</style>
