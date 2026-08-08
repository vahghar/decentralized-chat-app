import { signalSocket } from './socket';

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private roomId: string;
  private onMessageCallback: (msg: any) => void;
  private onStatusChange: (connected: boolean) => void;
  
  // File receiving state
  private receivingFile: { id: string, name: string, size: number, chunks: ArrayBuffer[], received: number } | null = null;

  constructor(roomId: string, onMessage: (msg: any) => void, onStatusChange: (connected: boolean) => void) {
    this.roomId = roomId;
    this.onMessageCallback = onMessage;
    this.onStatusChange = onStatusChange;
    this.init();
  }

  private init() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { 
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        { 
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        { 
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ]
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        signalSocket.emit('webrtc_ice_candidate', { candidate: event.candidate, roomId: this.roomId });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection?.connectionState === 'connected') {
        this.onStatusChange(true);
      } else if (this.peerConnection?.connectionState === 'disconnected' || this.peerConnection?.connectionState === 'failed') {
        this.onStatusChange(false);
      }
    };

    // Handle receiving data channel
    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };

    signalSocket.on('ready_for_webrtc', async () => {
      this.createOffer();
    });

    signalSocket.on('webrtc_offer', async (offer) => {
      if (!this.peerConnection) return;
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      signalSocket.emit('webrtc_answer', { answer, roomId: this.roomId });
    });

    signalSocket.on('webrtc_answer', async (answer) => {
      if (!this.peerConnection) return;
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

    signalSocket.on('webrtc_ice_candidate', async (candidate) => {
      if (!this.peerConnection) return;
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });

    signalSocket.emit('join_room', this.roomId);
  }

  public async createOffer() {
    if (!this.peerConnection) return;
    this.dataChannel = this.peerConnection.createDataChannel('chat', { negotiated: false });
    this.setupDataChannel();

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    signalSocket.emit('webrtc_offer', { offer, roomId: this.roomId });
  }

  private setupDataChannel() {
    if (!this.dataChannel) return;
    this.dataChannel.binaryType = 'arraybuffer';
    this.dataChannel.onopen = () => this.onStatusChange(true);
    this.dataChannel.onclose = () => this.onStatusChange(false);
    this.dataChannel.onmessage = (event) => this.handleIncomingData(event.data);
  }

  private handleIncomingData(data: string | ArrayBuffer) {
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'file_start') {
          this.receivingFile = {
            id: parsed.id,
            name: parsed.name,
            size: parsed.size,
            chunks: [],
            received: 0
          };
          this.onMessageCallback(JSON.stringify({ type: 'sys', text: `Receiving file: ${parsed.name}...` }));
        } else if (parsed.type === 'file_end') {
          if (this.receivingFile) {
            const blob = new Blob(this.receivingFile.chunks);
            const url = URL.createObjectURL(blob);
            this.onMessageCallback(JSON.stringify({ 
              type: 'file_received', 
              url, 
              name: this.receivingFile.name, 
              size: this.receivingFile.size 
            }));
            this.receivingFile = null;
          }
        } else {
          // Regular text message
          this.onMessageCallback(data);
        }
      } catch (e) {
        // Plain string fallback
        this.onMessageCallback(data);
      }
    } else if (data instanceof ArrayBuffer) {
      if (this.receivingFile) {
        this.receivingFile.chunks.push(data);
        this.receivingFile.received += data.byteLength;
        // Could emit progress events here
      }
    }
  }

  public sendMessage(message: string): boolean {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(message);
      return true;
    }
    return false;
  }

  public async sendFile(file: File, senderName: string): Promise<boolean> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return false;

    const fileId = Math.random().toString(36).substring(7);
    
    // Announce file start
    this.dataChannel.send(JSON.stringify({
      type: 'file_start',
      id: fileId,
      name: file.name,
      size: file.size,
      sender: senderName
    }));

    const chunkSize = 16384; // 16KB
    const reader = file.stream().getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      let offset = 0;
      while (offset < value.length) {
        const end = Math.min(offset + chunkSize, value.length);
        const chunk = value.slice(offset, end);
        
        // Wait if buffer is full
        while (this.dataChannel && this.dataChannel.bufferedAmount > 65535) {
          await new Promise(r => setTimeout(r, 10));
        }
        
        if (this.dataChannel?.readyState === 'open') {
          this.dataChannel.send(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength));
        } else {
          return false;
        }
        offset += chunkSize;
      }
    }

    // Announce file end
    this.dataChannel.send(JSON.stringify({
      type: 'file_end',
      id: fileId
    }));
    return true;
  }

  public close() {
    if (this.dataChannel) this.dataChannel.close();
    if (this.peerConnection) this.peerConnection.close();
    signalSocket.off('ready_for_webrtc');
    signalSocket.off('webrtc_offer');
    signalSocket.off('webrtc_answer');
    signalSocket.off('webrtc_ice_candidate');
  }
}
