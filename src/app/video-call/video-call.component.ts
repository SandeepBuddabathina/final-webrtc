import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { VideoCallService } from '../services/video-call.service';
import { ToastrService } from 'ngx-toastr';
import { FaceExpressionService } from '../services/face-expression.service';

@Component({
  selector: 'app-video-call',
  templateUrl: './video-call.component.html',
  styleUrls: ['./video-call.component.css'],
})
export class VideoCallComponent implements OnInit {
  meetingId!: string;
  localStream!: MediaStream;
  captionsEnabled = true;
  captions: { [key: string]: string } = {};
  @ViewChild('localVideo', { static: true })
  localVideo!: ElementRef<HTMLVideoElement>;
  remoteStreams: { [key: string]: MediaStream } = {};
  remoteVideoHidden: { [key: string]: boolean } = {};
  participants: string[] = [];
  signalStrengths: { [key: string]: number } = {};
  connectionStatus: string = 'Connecting...';
  searchQuery: string = '';
  videoEnabled: boolean = true;
  audioEnabled: boolean = true;
  showParticipants: boolean = false;
  detectedExpression: string = '';
  menuOpenFor: string | null = null;
  localVideoHidden = false;
  referenceImage: HTMLImageElement | null = null;
  faceMismatchDetected: boolean = false;
  showPopup: boolean = false;
  isRecording = false;
  mediaRecorder: any;
  recordedChunks: any[] = [];
  showSentimentModal: boolean = false;
  currentExpression: string = 'Neutral';

  sentimentData: { mood: string; faceExpression: string; summary: string } = {
    mood: '',
    faceExpression: '',
    summary: '',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private videoCallService: VideoCallService,
    private toastr: ToastrService,
    private faceService: FaceExpressionService
  ) {}

  async ngOnInit() {
    // Try to get meeting ID from route
    const paramId = this.route.snapshot.paramMap.get('roomId');


    if (!paramId) {
      // Generate new room ID and navigate to it
      const newRoomId = Math.random().toString(36).substring(2, 8);
      this.router.navigate(['/video-call', newRoomId]);
      return; // Stop execution until rerouted
    }

    this.meetingId = paramId;
    this.startCall();

    this.videoCallService.getParticipantUpdates().subscribe((participants) => {
      this.participants = participants;
      this.participants.forEach((userId) => {
        if (!this.signalStrengths[userId]) {
          this.signalStrengths[userId] = 100;
        }
      });
    });

    this.simulateSignalStrength();
  }

  async ngAfterViewInit() {
    await this.faceService.loadModels();
    this.startExpressionDetection();
  }

  startCall() {
    this.videoCallService
      .initLocalStream()
      .then((stream) => {
        this.localStream = stream;
        this.localVideo.nativeElement.srcObject = this.localStream;

        this.localVideo.nativeElement.onloadedmetadata = async () => {
          await this.faceService.loadModels();
          this.loadReferenceImage();
          this.startExpressionDetection();
        };

        this.videoCallService.joinRoom(this.meetingId);

        this.videoCallService.getRemoteStreamsObservable().subscribe((streams) => {
          this.remoteStreams = streams;
          Object.keys(this.remoteStreams).forEach((userId) => {
            if (!this.signalStrengths[userId]) {
              this.signalStrengths[userId] = 100;
            }
          });
        });

        this.connectionStatus = 'Connected';
      })
      .catch((error) =>
        console.error('Error accessing camera/microphone:', error)
      );
  }

  async loadReferenceImage() {
    this.referenceImage = new Image();
    this.referenceImage.src = 'assets/images/reference.jpg';
    await this.referenceImage.decode();
  }

  toggleCaptions() {
    this.captionsEnabled = !this.captionsEnabled;
  }

  startCaptioning() {
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join('');
      this.captions['local'] = transcript;
    };

    recognition.onerror = (err: any) => {
      console.error('Speech recognition error:', err);
    };

    recognition.start();
  }

  async toggleScreenRecording() {
    if (!this.isRecording) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });

        this.mediaRecorder = new MediaRecorder(screenStream);
        this.recordedChunks = [];

        this.mediaRecorder.ondataavailable = (event: any) => {
          if (event.data.size > 0) {
            this.recordedChunks.push(event.data);
          }
        };

        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'meeting-recording.webm';
          a.click();
          URL.revokeObjectURL(url);
        };

        this.mediaRecorder.start();
        this.isRecording = true;
      } catch (err) {
        console.error('Error starting screen recording:', err);
      }
    } else {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
  }

  toggleLocalVideo() {
    this.localVideoHidden = !this.localVideoHidden;
  }

  getRemoteStreamKeys(): string[] {
    return Object.keys(this.remoteStreams);
  }

  getConnectionStatus(userId: string): string {
    const status = this.signalStrengths[userId] || 0;
    if (status > 55) return 'Live';
    else if (status > 40) return 'Connecting...';
    return 'Low Signal';
  }

  getConnectionStatusClass(userId: string): string {
    const status = this.signalStrengths[userId] || 0;
    if (status > 55) return 'bg-green-500';
    else if (status > 40) return 'bg-yellow-500';
    return 'bg-red-500';
  }

  copyMeetingLink() {
    const meetingLink = `${window.location.origin}/video-call/${this.meetingId}`;
    navigator.clipboard
      .writeText(meetingLink)
      .then(() => this.toastr.success('Meeting link copied to clipboard!', 'Success'))
      .catch((err) => {
        this.toastr.error('Failed to copy link.', 'Error');
        console.error('Failed to copy link: ', err);
      });
  }

  filteredParticipants(): string[] {
    return this.participants.filter((user) =>
      user.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
  }

  toggleParticipants() {
    this.showParticipants = !this.showParticipants;
  }

  toggleVideo() {
    this.videoEnabled = !this.videoEnabled;
    this.localStream.getVideoTracks().forEach((track) => (track.enabled = this.videoEnabled));
    this.toastr.info(this.videoEnabled ? 'Video enabled' : 'Video disabled', 'Info');
  }

  toggleAudio() {
    this.audioEnabled = !this.audioEnabled;
    this.localStream.getAudioTracks().forEach((track) => (track.enabled = this.audioEnabled));
    this.toastr.info(this.audioEnabled ? 'Audio unmuted' : 'Audio muted', 'Info');
  }

  shareScreen() {
    this.videoCallService.shareScreen();
    this.toastr.info('Screen sharing started', 'Info');
  }

  leaveMeeting() {
    this.videoCallService.leaveMeeting();
    this.toastr.success('You have left the meeting.', 'Goodbye');

    this.sentimentData = this.analyzeSentiment();
    this.showSentimentModal = true;
  }

  closeSentimentModal(): void {
    this.showSentimentModal = false;
    window.location.href = '/';
  }

  // analyzeSentiment() {
  //   const map = {
  //     happy: { mood: 'Positive', summary: 'You appear to be in a positive mood!' },
  //     sad: { mood: 'Negative', summary: 'You seem a bit down. Hope everything is okay!' },
  //     angry: { mood: 'Negative', summary: "You seem frustrated. Let's try to stay calm." },
  //     surprised: { mood: 'Neutral', summary: 'You look surprised! What happened?' },
  //     neutral: { mood: 'Neutral', summary: 'You seem calm and composed.' },
  //     fearful: { mood: 'Negative', summary: 'You seem a bit anxious or fearful.' },
  //     disgusted: { mood: 'Negative', summary: "You appear to be disgusted. Let's talk about it!" },
  //   };

  //   const expression = this.detectedExpression.toLowerCase();
  //   const result = map[expression] || {
  //     mood: 'Neutral',
  //     summary: 'Your mood is unclear right now.',
  //   };

  //   return {
  //     mood: result.mood,
  //     faceExpression: expression,
  //     summary: result.summary,
  //   };
  // }
  analyzeSentiment(): {
    mood: string;
    faceExpression: string;
    summary: string;
  } {
    const expressionToSentimentMap: Record<
      'happy' | 'sad' | 'angry' | 'surprised' | 'neutral' | 'fearful' | 'disgusted',
      { mood: string; summary: string }
    > = {
      happy: {
        mood: 'Positive',
        summary: 'You appear to be in a positive mood!',
      },
      sad: {
        mood: 'Negative',
        summary: 'You seem a bit down. Hope everything is okay!',
      },
      angry: {
        mood: 'Negative',
        summary: "You seem frustrated. Let's try to stay calm.",
      },
      surprised: {
        mood: 'Neutral',
        summary: 'You look surprised! What happened?',
      },
      neutral: {
        mood: 'Neutral',
        summary: 'You seem calm and composed.',
      },
      fearful: {
        mood: 'Negative',
        summary: 'You seem a bit anxious or fearful. Everything alright?',
      },
      disgusted: {
        mood: 'Negative',
        summary: "You appear to be disgusted. Let's talk about it!",
      },
    };
  
    const expression = this.detectedExpression.toLowerCase();
  
    if (expression in expressionToSentimentMap) {
      const { mood, summary } =
        expressionToSentimentMap[expression as keyof typeof expressionToSentimentMap];
  
      return {
        mood,
        faceExpression: expression,
        summary,
      };
    }
  
    return {
      mood: 'Neutral',
      faceExpression: expression,
      summary: 'Your mood is unclear right now.',
    };
  }
  

  simulateSignalStrength() {
    setInterval(() => {
      this.participants.forEach((userId) => {
        this.signalStrengths[userId] = Math.floor(Math.random() * 101);
      });
    }, 5000);
  }

  toggleMenu(userId: string) {
    this.menuOpenFor = this.menuOpenFor === userId ? null : userId;
  }

  toggleRemoteVideo(userId: string) {
    this.remoteVideoHidden[userId] = !this.remoteVideoHidden[userId];
    this.toastr.info(
     `${this.remoteVideoHidden[userId] ? 'Hiding' : 'Showing'} ${userId}'s video,
      'Info'`
    );
  }

  startExpressionDetection() {
    const videoElement = this.localVideo.nativeElement;

    setInterval(async () => {
      const expressions = await this.faceService.detectExpressions(videoElement);
      if (expressions) {
        const topExpression = Object.entries(expressions).sort((a, b) => b[1] - a[1])[0][0];
        this.detectedExpression = topExpression;

        const sentiment = this.analyzeSentiment();
        console.log('Sentiment:', sentiment.mood, sentiment.summary);

        const isFaceRecognized = await this.compareFaceWithReference(videoElement);
        if (!isFaceRecognized) {
          this.faceMismatchDetected = true;
          this.showPopup = true;
        }
      }
    }, 5000);
  }

  getExpressionEmoji(expression: string): string {
    const emojiMap: { [key: string]: string } = {
      happy: '😊',
      sad: '😢',
      angry: '😠',
      fearful: '😨',
      disgusted: '🤢',
      surprised: '😲',
      neutral: '😐',
    };
    return emojiMap[expression] || '';
  }

  async compareFaceWithReference(videoElement: HTMLVideoElement): Promise<boolean> {
    if (!this.referenceImage) return false;
    return await this.faceService.compareFace(videoElement, this.referenceImage);
  }

  closePopup() {
    this.showPopup = false;
  }

  showTestToastr() {
    this.toastr.success('This is a test toast!', 'Test');
  }
}