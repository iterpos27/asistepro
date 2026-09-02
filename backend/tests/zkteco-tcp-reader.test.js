const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createTCPHeader } = require('node-zklib/utils');
const { COMMANDS: C } = require('node-zklib/constants');
const { readWithBuffer } = require('../src/integrations/zkteco.tcp-reader');

class DeviceSocket extends EventEmitter {
  constructor(data, incomplete = false) {
    super();
    this.data = data;
    this.requests = [];
    this.incomplete = incomplete;
  }
  write(packet, callback) {
    const command = packet.readUInt16LE(8);
    let frames;
    if (command === C.CMD_DATA_WRRQ) {
      const metadata = Buffer.alloc(13);
      metadata.writeUInt32LE(this.data.length, 1);
      frames = [createTCPHeader(C.CMD_ACK_OK, 1, 1, metadata)];
    } else {
      const offset = packet.readUInt32LE(16);
      const size = packet.readUInt32LE(20);
      this.requests.push({ offset, size });
      const prepare = Buffer.alloc(8);
      prepare.writeUInt32LE(size, 0);
      frames = [
        createTCPHeader(C.CMD_PREPARE_DATA, 1, 1, prepare),
        createTCPHeader(C.CMD_DATA, 1, 1, this.data.subarray(offset, offset + size - (this.incomplete ? 1 : 0))),
        createTCPHeader(C.CMD_ACK_OK, 1, 1, Buffer.alloc(0)),
      ];
    }
    queueMicrotask(() => {
      // Cabecera fragmentada y varios frames completos unidos en un evento.
      const bytes = Buffer.concat(frames);
      this.emit('data', bytes.subarray(0, 3));
      this.emit('data', bytes.subarray(3, 11));
      this.emit('data', bytes.subarray(11));
      callback?.();
    });
  }
}

for (const size of [16384, 32769]) {
  test(`descarga secuencial completa (${size} bytes) sin perder frames ni pedir bloques vacios`, async () => {
    const data = Buffer.alloc(size, 17);
    const socket = new DeviceSocket(data);
    const result = await readWithBuffer({ socket, timeout: 1000, sessionId: 1, replyId: 1 }, Buffer.alloc(1));
    assert.deepEqual(result.data, data);
    assert.equal(socket.requests.length, Math.ceil(size / 16384));
    assert.equal(socket.listenerCount('data'), 0);
    assert.equal(socket.listenerCount('close'), 0);
  });
}

test('rechaza bloques incompletos y retira listeners', async () => {
  const socket = new DeviceSocket(Buffer.alloc(100), true);
  await assert.rejects(readWithBuffer({ socket, timeout: 1000, sessionId: 1, replyId: 1 }, Buffer.alloc(1)), /incompleto/);
  assert.equal(socket.listenerCount('data'), 0);
});

test('libera listeners al agotar tiempo', async () => {
  const socket = new EventEmitter();
  socket.write = () => {};
  await assert.rejects(readWithBuffer({ socket, timeout: 15, sessionId: 1, replyId: 1 }, Buffer.alloc(1)), /Tiempo agotado/);
  assert.equal(socket.listenerCount('data'), 0);
});
