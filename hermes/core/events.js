const { connect, StringCodec } = require('nats');

const sc = StringCodec();
let nc = null;

async function connectNATS() {
    nc = await connect({ servers: 'nats://localhost:4222' });
    console.log('[events] Connected to NATS');
    return nc;
}

function publish(topic, payload) {
    if (!nc) throw new Error('NATS not connected');
    nc.publish(topic, sc.encode(JSON.stringify(payload)));
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
