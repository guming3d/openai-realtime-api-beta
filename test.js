import { RealtimeClient } from '@openai/realtime-api-beta';
import fs from 'fs';
import decodeAudio from 'audio-decode';

// Converts Float32Array of audio data to PCM16 ArrayBuffer
function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
};

// Converts a Float32Array to base64-encoded PCM16 data
function base64EncodeAudio(float32Array) {
  const arrayBuffer = floatTo16BitPCM(float32Array);
  let binary = '';
  let bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000; // 32KB chunk size
  for (let i = 0; i < bytes.length; i += chunkSize) {
    let chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
};


async function main() {
  const client = new RealtimeClient({
    url: 'wss://aoai-sweden-minggu.openai.azure.com/openai/realtime?api-version=2024-10-01-preview&deployment=gpt-4o-realtime-preview',
    apiKey: process.env.AZURE_OPENAI_API_KEY,
  });

  // Set parameters ahead of connecting
  client.updateSession({ instructions: 'You are a helpful assistent.' });
  client.updateSession({ voice: 'alloy' });
  client.updateSession({
    turn_detection: { type: 'none' }, // or 'server_vad'
    input_audio_transcription: { model: 'whisper-1' },
  });

  // Set up event handling before connecting
  client.on('connected', () => {
    console.log('Client connected to the Realtime API.');
  });

  client.on('disconnected', () => {
    console.log('Client disconnected from the Realtime API.');
  });

  client.on('error', (error) => {
    console.error('An error occurred:', error);
  });

  client.on('conversation.updated', (event) => {
    const { item, delta } = event;
    const items = client.conversation.getItems();
    console.log('Conversation updated event received:');
    console.log('Current item:', item);
    console.log('Delta:', delta);
    console.log('All conversation items:', items);
  });

  client.on('response', (event) => {
    const { item, delta } = event;
    const items = client.conversation.getItems();
    console.log('Response event received:');
    console.log('Current item:', item);
    console.log('Delta:', delta);
    console.log('All conversation items:', items);
  });

  // Using the "audio-decode" library to get raw audio bytes
  // const myAudio = fs.readFileSync('./test.wav');
  const myAudio = fs.readFileSync('./output_mono.wav');
  // const myAudio = fs.readFileSync('./test/samples/toronto.mp3');
  const audioBuffer = await decodeAudio(myAudio);
  const channelData = audioBuffer.getChannelData(0); // only accepts mono
  const base64AudioData = base64EncodeAudio(channelData);
  // print the content of base64AudioData
  // console.log(base64AudioData);

  try {
    // Connect to Realtime API
    await client.connect();
    console.log('Successfully connected to the Realtime API.');

    // Send a message and trigger a generation
    client.sendUserMessageContent([
      { type: 'input_text', text: 'How are you?' },
      { type: 'input_audio', audio: base64AudioData }
    ]);
  } catch (error) {
    console.error('Error during connection or message sending:', error);
  }
}

main();
