
import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { VideoCallService } from '../services/video-call.service';
import { ToastrService } from 'ngx-toastr'; // Import ToastrService
import { FaceExpressionService } from '../services/face-expression.service';

@Component({
  selector: 'app-video-call',
  templateUrl: './video-call.component.html',
  styleUrls: ['./video-call.component.css'],
})
export class VideoCallComponent implements OnInit {
  meetingId!: string;
  localStream!: MediaStream;
  @ViewChild('localVideo', { static: true })
  localVideo!: ElementRef<HTMLVideoElement>;
  remoteStreams: { [key: string]: MediaStream } = {};
  remoteVideoHidden: { [key: string]: boolean } = {}; // NEW: for remote video visibility toggle
  participants: string[] = [];
  signalStrengths: { [key: string]: number } = {}; // Track signal strength for each participant
  connectionStatus: string = 'Connecting...';
  searchQuery: string = '';
  videoEnabled: boolean = true;
  audioEnabled: boolean = true;
  showParticipants: boolean = false;
  detectedExpression: string = '';
  menuOpenFor: string | null = null; // NEW: Track open menu userId
  localVideoHidden = false;
  referenceImage: HTMLImageElement | null = null;
  faceMismatchDetected: boolean = false;
  showPopup: boolean = false;
  isRecording = false;
  mediaRecorder: any;
  recordedChunks: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private videoCallService: VideoCallService,
    private toastr: ToastrService,
    private faceService: FaceExpressionService
  ) {}

  async ngAfterViewInit() {
    await this.faceService.loadModels();
    this.startExpressionDetection();
  }

  closePopup() {
    this.showPopup = false;
  }

  ngOnInit() {
    this.meetingId = this.route.snapshot.paramMap.get('meetingId') || '';
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

  async loadReferenceImage() {
    this.referenceImage = new Image();
    this.referenceImage.src = 'assets/images/reference.jpg'; // Path to your reference image
    await this.referenceImage.decode();
  }

  async toggleScreenRecording() {
    if (!this.isRecording) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
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

  startCall() {
    this.videoCallService
      .initLocalStream()
      .then((stream) => {
        this.localStream = stream;
        this.localVideo.nativeElement.srcObject = this.localStream;

        //  Wait until video metadata is ready (video can play)
        this.localVideo.nativeElement.onloadedmetadata = async () => {
          await this.faceService.loadModels(); // Load face detection models
          this.loadReferenceImage(); // Load the reference image
          this.startExpressionDetection(); // Start face recognition
        };

        // Join room
        this.videoCallService.joinRoom(this.meetingId);

        // Listen for other participants' streams
        this.videoCallService
          .getRemoteStreamsObservable()
          .subscribe((streams) => {
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


  getRemoteStreamKeys(): string[] {
    return Object.keys(this.remoteStreams);
  }

  getConnectionStatus(userId: string): string {
    const status = this.signalStrengths[userId] || 0;
    if (status > 55) {
      return 'Live';
    } else if (status > 40) {
      return 'Connecting...';
    } else {
      return 'Low Signal';
    }
  }

  getConnectionStatusClass(userId: string): string {
    const status = this.signalStrengths[userId] || 0;
    if (status > 55) {
      return 'bg-green-500';
    } else if (status > 40) {
      return 'bg-yellow-500';
    } else {
      return 'bg-red-500';
    }
  }

  // Meeting Link Generation - NEW CODE START
  copyMeetingLink() {
    const meetingLink = `${window.location.origin}/video-call/${this.meetingId}`;
    navigator.clipboard
      .writeText(meetingLink)
      .then(() => {
        this.toastr.success('Meeting link copied to clipboard!', 'Success');
      })
      .catch((err) => {
        this.toastr.error('Failed to copy link.', 'Error');
        console.error('Failed to copy link: ', err);
      });
  }
  // Meeting Link Generation - NEW CODE END

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
    this.localStream
      .getVideoTracks()
      .forEach((track) => (track.enabled = this.videoEnabled));
    if (this.videoEnabled) {
      this.toastr.info('Video enabled', 'Info');
    } else {
      this.toastr.info('Video disabled', 'Info');
    }
  }
  
  toggleAudio() {
    this.audioEnabled = !this.audioEnabled;
    this.localStream
      .getAudioTracks()
      .forEach((track) => (track.enabled = this.audioEnabled));
    if (this.audioEnabled) {
      this.toastr.info('Audio unmuted', 'Info');
    } else {
      this.toastr.info('Audio muted', 'Info');
    }
  }

  shareScreen() {
    this.videoCallService.shareScreen();
    this.toastr.info('Screen sharing started', 'Info');
  }

  leaveMeeting() {
    this.videoCallService.leaveMeeting();
    this.toastr.success('You have left the meeting.', 'Goodbye');
    window.location.href = '/';
  }

  showTestToastr() {
    this.toastr.success('This is a test toast!', 'Test');
  }

  simulateSignalStrength() {
    setInterval(() => {
      this.participants.forEach((userId) => {
        const randomSignal = Math.floor(Math.random() * 101);
        this.signalStrengths[userId] = randomSignal;
      });
    }, 5000);
  }

  // NEW: Show/hide dropdown menu
  toggleMenu(userId: string) {
    this.menuOpenFor = this.menuOpenFor === userId ? null : userId;
  }

  // NEW: Toggle visibility of a specific remote user's video
  toggleRemoteVideo(userId: string) {
    this.remoteVideoHidden[userId] = !this.remoteVideoHidden[userId];
    this.toastr.info(
      `${
        this.remoteVideoHidden[userId] ? 'Hiding' : 'Showing'
      } ${userId}'s video`,
      'Info'
    );
  }

  startExpressionDetection() {
    const videoElement = this.localVideo.nativeElement;

    setInterval(async () => {
      const expressions = await this.faceService.detectExpressions(
        videoElement
      );
      if (expressions) {
        const topExpression = Object.entries(expressions).sort(
          (a, b) => b[1] - a[1]
        )[0][0];

        this.detectedExpression = topExpression; // Set it to display in UI
        console.log('Detected expression:', topExpression);
        const isFaceRecognized = await this.compareFaceWithReference(
          videoElement
        );
        if (isFaceRecognized) {
          console.log('Face recognized');
        } else {
          console.log('Face not recognized');
          this.faceMismatchDetected = true; // Track face mismatch
          this.showPopup = true; // Show the popup when face mismatch is detected
        }
      }
    }, 5000); // Detect face expression and recognize face every 5 seconds
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

  async compareFaceWithReference(
    videoElement: HTMLVideoElement
  ): Promise<boolean> {
    if (!this.referenceImage) return false;

    const result = await this.faceService.compareFace(
      videoElement,
      this.referenceImage
    );
    return result;
  }
}
