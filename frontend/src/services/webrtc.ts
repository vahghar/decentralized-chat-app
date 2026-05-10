import { signalSocket } from './socket';

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private roomId: string;
  private onMessageCallback: (msg: string) => void;
  private onStatusChange: (connected: boolean) => void;

  constructor(roomId: string, onMessage: (msg: string) => void, onStatusChange: (connected: boolean) => void) {
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
    this.dataChannel = this.peerConnection.createDataChannel('chat');
    this.setupDataChannel();

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    signalSocket.emit('webrtc_offer', { offer, roomId: this.roomId });
  }

  private setupDataChannel() {
    if (!this.dataChannel) return;
    this.dataChannel.onopen = () => this.onStatusChange(true);
    this.dataChannel.onclose = () => this.onStatusChange(false);
    this.dataChannel.onmessage = (event) => {
      this.onMessageCallback(event.data);
    };
  }

  public sendMessage(message: string): boolean {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(message);
      return true;
    }
    return false;
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
