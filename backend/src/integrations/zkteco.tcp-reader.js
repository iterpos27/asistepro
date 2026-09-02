// node-zklib 1.3.0 solicita todos los bloques juntos y procesa solo un frame
// por evento TCP. Este adaptador conserva la API, pero descarga secuencialmente
// y comprueba la longitud completa antes de entregar registros al importador.
const { createTCPHeader } = require('node-zklib/utils');
const { COMMANDS } = require('node-zklib/constants');
const MAGIC = Buffer.from([0x50, 0x50, 0x82, 0x7d]);
const CHUNK_SIZE = 16384;
const MAX_DOWNLOAD = 32 * 1024 * 1024;

class FrameReader {
  constructor(socket, timeout) {
    this.socket = socket;
    this.timeout = timeout;
    this.buffer = Buffer.alloc(0);
    this.frames = [];
    this.pending = null;
    this.error = null;
    this.onData = data => {
      try {
        this.buffer = Buffer.concat([this.buffer, data]);
        while (this.buffer.length >= 8) {
          if (!this.buffer.subarray(0, 4).equals(MAGIC)) throw new Error('Cabecera TCP ZKTeco invalida');
          const length = this.buffer.readUInt32LE(4);
          if (length < 8 || length > MAX_DOWNLOAD) throw new Error('Longitud TCP ZKTeco invalida');
          if (this.buffer.length < length + 8) break;
          const packet = this.buffer.subarray(8, length + 8);
          this.buffer = this.buffer.subarray(length + 8);
          const frame = { command: packet.readUInt16LE(0), payload: packet.subarray(8) };
          if (this.pending) {
            const pending = this.pending;
            this.pending = null;
            clearTimeout(pending.timer);
            pending.resolve(frame);
          } else {
            this.frames.push(frame);
          }
        }
      } catch (error) {
        this.fail(error);
      }
    };
    this.onClose = () => this.fail(new Error('Conexion interrumpida durante descarga ZKTeco'));
    this.onError = error => this.fail(error);
    socket.on('data', this.onData);
    socket.on('close', this.onClose);
    socket.on('error', this.onError);
  }

  fail(error) {
    this.error = error;
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(error);
      this.pending = null;
    }
  }

  next() {
    if (this.error) return Promise.reject(this.error);
    if (this.frames.length) return Promise.resolve(this.frames.shift());
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new Error('Tiempo agotado durante descarga ZKTeco')), this.timeout);
      this.pending = { resolve, reject, timer };
    });
  }

  close() {
    if (this.pending) this.fail(new Error('Lector ZKTeco cerrado'));
    this.socket.removeListener('data', this.onData);
    this.socket.removeListener('close', this.onClose);
    this.socket.removeListener('error', this.onError);
  }
}

async function readWithBuffer(tcp, request, progress) {
  if (!tcp.socket) throw new Error('Socket ZKTeco no conectado');
  const reader = new FrameReader(tcp.socket, tcp.timeout || 10000);
  const send = (command, payload) => {
    tcp.replyId = (tcp.replyId + 1) % 65535;
    tcp.socket.write(createTCPHeader(command, tcp.sessionId, tcp.replyId, payload), error => {
      if (error) reader.fail(error);
    });
  };
  try {
    send(COMMANDS.CMD_DATA_WRRQ, request);
    const first = await reader.next();
    if (first.command === COMMANDS.CMD_DATA) return { data: first.payload, err: null };
    if (![COMMANDS.CMD_ACK_OK, COMMANDS.CMD_PREPARE_DATA].includes(first.command) || first.payload.length < 5) {
      throw new Error(`Respuesta de preparacion ZKTeco invalida (${first.command})`);
    }
    const size = first.payload.readUInt32LE(1);
    if (size > MAX_DOWNLOAD) throw new Error('Descarga ZKTeco supera el limite permitido');
    const chunks = [];
    for (let offset = 0; offset < size; offset += CHUNK_SIZE) {
      const length = Math.min(CHUNK_SIZE, size - offset);
      const requestChunk = Buffer.alloc(8);
      requestChunk.writeUInt32LE(offset, 0);
      requestChunk.writeUInt32LE(length, 4);
      send(COMMANDS.CMD_DATA_RDY, requestChunk);
      let received = 0;
      const parts = [];
      while (true) {
        const frame = await reader.next();
        if (frame.command === COMMANDS.CMD_PREPARE_DATA) {
          if (frame.payload.length < 4 || frame.payload.readUInt32LE(0) !== length) {
            throw new Error('Tamano de bloque ZKTeco inesperado');
          }
        } else if (frame.command === COMMANDS.CMD_DATA) {
          received += frame.payload.length;
          if (received > length) throw new Error('Bloque ZKTeco excede longitud solicitada');
          parts.push(frame.payload);
        } else if (frame.command === COMMANDS.CMD_ACK_OK) {
          if (received !== length) throw new Error('Bloque ZKTeco incompleto');
          break;
        } else {
          throw new Error(`Comando inesperado durante descarga ZKTeco (${frame.command})`);
        }
      }
      chunks.push(Buffer.concat(parts, length));
      if (progress) progress(offset + length, size);
    }
    return { data: Buffer.concat(chunks, size), err: null };
  } finally {
    reader.close();
  }
}

function installReliableTcpReader(device) {
  if (device.zklibTcp) {
    device.zklibTcp.readWithBuffer = function (request, progress) {
      return readWithBuffer(this, request, progress);
    };
  }
}

module.exports = { readWithBuffer, installReliableTcpReader };
