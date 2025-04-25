import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable } from 'rxjs';
import { FaceExpressionService } from './face-expression.service';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class VideoCallService {
  private socket: Socket;
  private localStream: MediaStream | null = null;
  private peerConnections: { [key: string]: RTCPeerConnection } = {};
  private remoteStreams = new BehaviorSubject<{ [key: string]: MediaStream }>(
    {}
  );
  private participants = new BehaviorSubject<string[]>([]);

  private expressionAudioSnapshots: {
    [userId: string]: { timestamp: number; expression: any; volume: number }[];
  } = {};

  private meetingLink: string = ''; 

  constructor(
    private faceService: FaceExpressionService,
    private http: HttpClient
  ) {
    //  Inject FaceExpressionService
    this.socket = io('https://back-web-production-9b88.up.railway.app');

    this.socket.on('user-joined', (userId: string) => {
      this.createOffer(userId);
      this.participants.next([...this.participants.value, userId]);
    });

    this.socket.on('receive-offer', (data) => this.handleOffer(data));
    this.socket.on('receive-answer', (data) => this.handleAnswer(data));
    this.socket.on('receive-ice-candidate', (data) =>
      this.handleIceCandidate(data)
    );

    this.socket.on('user-left', (userId) => {
      this.analyzeUserOnLeave(userId); // 👈 Perform analysis when user leaves
      this.removeUser(userId);
      this.participants.next(
        this.participants.value.filter((id) => id !== userId)
      );
    });
  }

  async initLocalStream(): Promise<MediaStream> {
    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    return this.localStream;
  }

  joinRoom(roomId: string): void {
    this.socket.emit('join-room', roomId);
  }

  //  ** Meeting Link Generation **
  generateMeetingLink(): void {
    this.http
      .get<{ roomId: string }>('http://localhost:3000/generate-room')
      .subscribe((response) => {
        const roomId = response.roomId;
        this.socket.emit('create-room', roomId);
        this.meetingLink = `http://localhost:4200/meeting/${roomId}`; // Or whatever frontend URL you have
        console.log('Generated Meeting Link:', this.meetingLink);
      });
  }

  private generateRoomId(): string {
    return 'room_' + Math.random().toString(36).substring(2, 15);
  }

  private async createOffer(userId: string): Promise<void> {
    const peerConnection = this.createPeerConnection(userId);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    this.socket.emit('offer', { targetId: userId, offer });
  }

  private async handleOffer({
    senderId,
    offer,
  }: {
    senderId: string;
    offer: RTCSessionDescriptionInit;
  }): Promise<void> {
    const peerConnection = this.createPeerConnection(senderId);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    this.socket.emit('answer', { targetId: senderId, answer });
  }

  private async handleAnswer({
    senderId,
    answer,
  }: {
    senderId: string;
    answer: RTCSessionDescriptionInit;
  }): Promise<void> {
    await this.peerConnections[senderId].setRemoteDescription(
      new RTCSessionDescription(answer)
    );
  }

  private async handleIceCandidate({
    senderId,
    candidate,
  }: {
    senderId: string;
    candidate: RTCIceCandidateInit;
  }): Promise<void> {
    await this.peerConnections[senderId].addIceCandidate(
      new RTCIceCandidate(candidate)
    );
  }

  private createPeerConnection(userId: string): RTCPeerConnection {
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', {
          targetId: userId,
          candidate: event.candidate,
        });
      }
    };

    peerConnection.ontrack = (event) => {
      this.remoteStreams.next({
        ...this.remoteStreams.value,
        [userId]: event.streams[0],
      });

      //  Start monitoring expression and volume
      this.monitorFaceAndAudio(userId, event.streams[0]);
    };

    this.localStream!.getTracks().forEach((track) =>
      peerConnection.addTrack(track, this.localStream!)
    );
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

  async shareScreen(): Promise<void> {
    const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
      video: true,
    });
    const screenTrack = screenStream.getVideoTracks()[0];

    if (!this.localStream) return;

    const oldTrack = this.localStream.getVideoTracks()[0];
    this.localStream.removeTrack(oldTrack);
    this.localStream.addTrack(screenTrack);

    for (const userId in this.peerConnections) {
      const sender = this.peerConnections[userId]
        .getSenders()
        .find((s) => s.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(screenTrack);
      }

      const offer = await this.peerConnections[userId].createOffer();
      await this.peerConnections[userId].setLocalDescription(offer);
      this.socket.emit('offer', { targetId: userId, offer });
    }

    screenTrack.onended = async () => {
      const newStream = await this.initLocalStream();
      const newVideoTrack = newStream.getVideoTracks()[0];
      this.localStream?.removeTrack(screenTrack);
      this.localStream?.addTrack(newVideoTrack);

      for (const userId in this.peerConnections) {
        const sender = this.peerConnections[userId]
          .getSenders()
          .find((s) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(newVideoTrack);
        }

        const offer = await this.peerConnections[userId].createOffer();
        await this.peerConnections[userId].setLocalDescription(offer);
        this.socket.emit('offer', { targetId: userId, offer });
      }
    };
  }

  leaveMeeting(): void {
    for (const userId in this.peerConnections) {
      this.peerConnections[userId].close();
      delete this.peerConnections[userId];
    }

    this.localStream?.getTracks().forEach((track) => track.stop());
    this.socket.disconnect();
  }

  //  ANALYSIS FUNCTIONALITY SECTION

  private monitorFaceAndAudio(userId: string, stream: MediaStream): void {
    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 256;
    const faceVideo = document.createElement('video');
    faceVideo.srcObject = stream;
    faceVideo.play();

    const faceCheck = () => {
      this.faceService.detectExpressions(faceVideo).then((expression) => {
        const volume = this.getAudioVolume(analyser);
        if (!this.expressionAudioSnapshots[userId]) {
          this.expressionAudioSnapshots[userId] = [];
        }

        this.expressionAudioSnapshots[userId].push({
          timestamp: Date.now(),
          expression,
          volume,
        });
      });
    };

    setInterval(faceCheck, 5000); // Check every 5 seconds
  }

  private getAudioVolume(analyser: AnalyserNode): number {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    return avg / 255; // Normalize to 0-1
  }

  private analyzeUserOnLeave(userId: string): void {
    const data = this.expressionAudioSnapshots[userId];
    if (!data || data.length === 0) return;

    let totalVolume = 0;
    const expressionCounts: { [key: string]: number } = {};

    for (const snapshot of data) {
      totalVolume += snapshot.volume;

      const mostLikely = Object.entries(
        snapshot.expression as { [key: string]: number }
      ).reduce((a, b) => (a[1] > b[1] ? a : b));

      const emotion = mostLikely[0];

      if (!expressionCounts[emotion]) {
        expressionCounts[emotion] = 0;
      }
      expressionCounts[emotion]++;
    }

    const averageVolume = totalVolume / data.length;
    const topExpression = Object.entries(expressionCounts).sort(
      (a, b) => b[1] - a[1]
    )[0][0];
    const confidenceScore = Math.round(averageVolume * 100);

    console.log(` Summary for ${userId}:`);
    console.log(` Dominant Emotion: ${topExpression}`);
    console.log(` Confidence Score: ${confidenceScore}`);
  }
}
