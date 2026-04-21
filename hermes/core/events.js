const { connect, StringCodec } = require('nats');

const sc = StringCodec();
let nc = null;

async function connectNATS() {
    nc = await connect({ servers: 'nats://localhost:4222' });
    console.log('[events] Connected to NATS');
    // Watch the connection's lifecycle events. Without this, a disconnect is
    // silent — publishes keep succeeding on stale state until they don't, and
    // "pipeline stalled" becomes indistinguishable from "NATS briefly dropped
    // an event." Logs are surfaced to every operator, not buried in an ack.
    (async () => {
        for await (const status of nc.status()) {
            console.log(`[events] NATS status: ${status.type}`, status.data ?? '');
        }
    })().catch((err) => {
        console.warn('[events] NATS status stream error:', err.message);
    });
    return nc;
}

function publish(topic, payload) {
    if (!nc) {
        console.error(`[events] publish('${topic}') called before NATS connected — dropped.`);
        return;
    }
    try {
        nc.publish(topic, sc.encode(JSON.stringify(payload)));
    } catch (err) {
        // Core NATS publish is fire-and-forget and can throw on closed/draining
        // connections. Log loudly so a stalled pipeline leaves a breadcrumb
        // instead of just "agent.completed never arrived." The eval harness in
        // particular depends on publish success — if this fires during an eval
        // run, attributions will look wrong and that's where to start looking.
        console.error(`[events] publish('${topic}') failed:`, err.message);
    }
}

function subscribe(topic, handler) {
    if (!nc) throw new Error('NATS not connected');
    const sub = nc.subscribe(topic);
    (async () => {
        for await (const msg of sub) {
            try {
                handler(JSON.parse(sc.decode(msg.data)));
            } catch (e) {
                console.error(`[events] Error in handler for ${topic}:`, e.message);
            }
        }
    })();
    return sub;
}

module.exports = { connectNATS, publish, subscribe };
