import { Injectable } from "@angular/core";
import { io, Socket } from "socket.io-client";
import { BehaviorSubject, Observable } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class VideoCallService {
  private socket: Socket;
  private localStream: MediaStream | null = null;
  private peerConnections: { [key: string]: RTCPeerConnection } = {};
  private remoteStreams = new BehaviorSubject<{ [key: string]: MediaStream }>({});
  private participants = new BehaviorSubject<string[]>([]);

  constructor() {
    this.socket = io("https://back-web-production-9b88.up.railway.app");


    this.socket.on("user-joined", (userId: string) => {
      this.createOffer(userId);
      this.participants.next([...this.participants.value, userId]);
    });

    this.socket.on("receive-offer", (data) => this.handleOffer(data));
    this.socket.on("receive-answer", (data) => this.handleAnswer(data));
    this.socket.on("receive-ice-candidate", (data) => this.handleIceCandidate(data));

    this.socket.on("user-left", (userId) => {
      this.removeUser(userId);
      this.participants.next(this.participants.value.filter(id => id !== userId));
    });
  }

  async initLocalStream(): Promise<MediaStream> {
    this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    return this.localStream;
  }

  joinRoom(roomId: string): void {
    this.socket.emit("join-room", roomId);
  }

  private async createOffer(userId: string): Promise<void> {
    const peerConnection = this.createPeerConnection(userId);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    this.socket.emit("offer", { targetId: userId, offer });
  }

  private async handleOffer({ senderId, offer }: { senderId: string; offer: RTCSessionDescriptionInit }): Promise<void> {
    const peerConnection = this.createPeerConnection(senderId);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    this.socket.emit("answer", { targetId: senderId, answer });
  }

  private async handleAnswer({ senderId, answer }: { senderId: string; answer: RTCSessionDescriptionInit }): Promise<void> {
    await this.peerConnections[senderId].setRemoteDescription(new RTCSessionDescription(answer));
  }

  private async handleIceCandidate({ senderId, candidate }: { senderId: string; candidate: RTCIceCandidateInit }): Promise<void> {
    await this.peerConnections[senderId].addIceCandidate(new RTCIceCandidate(candidate));
  }

  private createPeerConnection(userId: string): RTCPeerConnection {
    const peerConnection = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit("ice-candidate", { targetId: userId, candidate: event.candidate });
      }
    };

    peerConnection.ontrack = (event) => {
      this.remoteStreams.next({ ...this.remoteStreams.value, [userId]: event.streams[0] });
    };

    this.localStream!.getTracks().forEach(track => peerConnection.addTrack(track, this.localStream!));
    this.peerConnections[userId] = peerConnection;
    return peerConnection;
  }

  private removeUser(userId: string): void {
    if (this.peerConnections[userId]) {
      this.peerConnections[userId].close();
      delete this.peerConnections[userId];
    }
    const updatedStreams = { ...this.remoteStreams.value };
    delete updatedStreams[userId];
    this.remoteStreams.next(updatedStreams);
  }

  getRemoteStreamsObservable(): Observable<{ [key: string]: MediaStream }> {
    return this.remoteStreams.asObservable();
  }

  getParticipantUpdates(): Observable<string[]> {
    return this.participants.asObservable();
  }
  /** ✅ Share Screen and update tracks */
async shareScreen(): Promise<void> {
  const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
  const screenTrack = screenStream.getVideoTracks()[0];

  if (!this.localStream) return;

  const oldTrack = this.localStream.getVideoTracks()[0];
  this.localStream.removeTrack(oldTrack);
  this.localStream.addTrack(screenTrack);

  for (const userId in this.peerConnections) {
    const sender = this.peerConnections[userId]
      .getSenders()
      .find(s => s.track?.kind === "video");
    if (sender) {
      sender.replaceTrack(screenTrack);
    }

    const offer = await this.peerConnections[userId].createOffer();
    await this.peerConnections[userId].setLocalDescription(offer);
    this.socket.emit("offer", { targetId: userId, offer });
  }

  screenTrack.onended = async () => {
    const newStream = await this.initLocalStream();
    const newVideoTrack = newStream.getVideoTracks()[0];
    this.localStream?.removeTrack(screenTrack);
    this.localStream?.addTrack(newVideoTrack);

    for (const userId in this.peerConnections) {
      const sender = this.peerConnections[userId]
        .getSenders()
        .find(s => s.track?.kind === "video");
      if (sender) {
        sender.replaceTrack(newVideoTrack);
      }

      const offer = await this.peerConnections[userId].createOffer();
      await this.peerConnections[userId].setLocalDescription(offer);
      this.socket.emit("offer", { targetId: userId, offer });
    }
  };
}

/** ✅ Leave Meeting and cleanup */
leaveMeeting(): void {
  for (const userId in this.peerConnections) {
    this.peerConnections[userId].close();
    delete this.peerConnections[userId];
  }

  this.localStream?.getTracks().forEach(track => track.stop());
  this.socket.disconnect();
}

}
