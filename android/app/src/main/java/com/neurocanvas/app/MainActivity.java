package com.neurocanvas.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;

import com.getcapacitor.BridgeActivity;

/**
 * NeuroCanvas Android entry point (AER-70 quick-capture share target).
 *
 * Beyond the default Capacitor {@link BridgeActivity}, this activity turns
 * inbound Android "Share" intents ({@code ACTION_SEND} / {@code ACTION_SEND_MULTIPLE}
 * of {@code text/plain}) into a {@code neurocanvas://capture?...} deep link. By
 * rewriting the intent into an {@code ACTION_VIEW} with that data URI BEFORE the
 * Capacitor bridge inspects it, the shared text/URL surfaces to JavaScript
 * through the same {@code App.appUrlOpen} event the OAuth and quick-capture deep
 * links already use — so there is a single dispatch path in
 * {@code plugins/quick-capture-deeplink.client.ts} and no custom Capacitor
 * plugin (and thus no new dependency) is required.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        rewriteShareIntent(getIntent());
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onNewIntent(Intent intent) {
        rewriteShareIntent(intent);
        super.onNewIntent(intent);
    }

    /**
     * If {@code intent} is a plain-text share, replace it in place with an
     * {@code ACTION_VIEW} intent whose data is a {@code neurocanvas://capture}
     * deep link. Non-share intents (launcher, OAuth VIEW, etc.) pass through
     * untouched.
     */
    private void rewriteShareIntent(Intent intent) {
        if (intent == null) {
            return;
        }

        final String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            return;
        }

        final String type = intent.getType();
        if (type == null || !type.startsWith("text/")) {
            return;
        }

        final String shared = extractSharedText(intent);
        if (TextUtils.isEmpty(shared)) {
            return;
        }

        final Uri captureUri = buildCaptureUri(shared.trim());

        intent.setAction(Intent.ACTION_VIEW);
        intent.setDataAndType(captureUri, null);
        // Drop the now-consumed share extras so nothing re-processes them.
        intent.removeExtra(Intent.EXTRA_TEXT);
        intent.removeExtra(Intent.EXTRA_STREAM);
    }

    /** Pull the shared text out of a SEND or SEND_MULTIPLE intent. */
    private String extractSharedText(Intent intent) {
        final CharSequence single = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        if (!TextUtils.isEmpty(single)) {
            return single.toString();
        }

        final java.util.ArrayList<CharSequence> multi =
                intent.getCharSequenceArrayListExtra(Intent.EXTRA_TEXT);
        if (multi != null && !multi.isEmpty()) {
            final StringBuilder joined = new StringBuilder();
            for (CharSequence piece : multi) {
                if (TextUtils.isEmpty(piece)) {
                    continue;
                }
                if (joined.length() > 0) {
                    joined.append('\n');
                }
                joined.append(piece);
            }
            return joined.toString();
        }

        return null;
    }

    /**
     * Build {@code neurocanvas://capture?text=...} (or {@code ?url=...} when the
     * shared text is itself an http(s) link). Uri.Builder percent-encodes the
     * query values, which the JS {@code parseCaptureUrl} decodes symmetrically.
     */
    private Uri buildCaptureUri(String shared) {
        final Uri.Builder builder = new Uri.Builder()
                .scheme("neurocanvas")
                .authority("capture");

        final String lower = shared.toLowerCase();
        if (lower.startsWith("http://") || lower.startsWith("https://")) {
            builder.appendQueryParameter("url", shared);
        } else {
            builder.appendQueryParameter("text", shared);
        }

        return builder.build();
    }
}
