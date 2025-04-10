import { Component, OnInit, ViewChild, ElementRef } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { VideoCallService } from "../services/video-call.service";
import { ToastrService } from 'ngx-toastr'; // Import ToastrService
import { FaceExpressionService } from '../services/face-expression.service';
@Component({
  selector: "app-video-call",
  templateUrl: "./video-call.component.html",
  styleUrls: ["./video-call.component.css"],
})
export class VideoCallComponent implements OnInit {
  meetingId!: string;
  localStream!: MediaStream;
  @ViewChild('localVideo', { static: true }) localVideo!: ElementRef<HTMLVideoElement>;
  remoteStreams: { [key: string]: MediaStream } = {};
  remoteVideoHidden: { [key: string]: boolean } = {}; // NEW: for remote video visibility toggle
  participants: string[] = [];
  signalStrengths: { [key: string]: number } = {};  // Track signal strength for each participant
  connectionStatus: string = "Connecting...";
  searchQuery: string = "";
  videoEnabled: boolean = true;
  audioEnabled: boolean = true;
  showParticipants: boolean = false;
  enlargedVideoUserId: string | null = null;
  isDarkMode = false;
  detectedExpression: string = '';
  menuOpenFor: string | null = null; // NEW: Track open menu userId
  localVideoHidden = false;
  referenceImage: HTMLImageElement | null = null;
  faceMismatchDetected: boolean = false;
  showPopup: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private videoCallService: VideoCallService,
    private toastr: ToastrService,
    private faceService: FaceExpressionService
  ) {}


  async ngAfterViewInit() {
    await this.faceService.loadModels();
    this.startExpressionDetection();
    this.loadReferenceImage(); 
    
  }
  closePopup() {
    this.showPopup = false;
  }
  
  ngOnInit() {
    this.meetingId = this.route.snapshot.paramMap.get("meetingId") || "";
    this.startCall();

    this.videoCallService.getParticipantUpdates().subscribe((participants) => {
      this.participants = participants;

      this.participants.forEach((userId) => {
        if (!this.signalStrengths[userId]) {
          this.signalStrengths[userId] = 100;
        }
      });
    });

    this.simulateSignalStrength(); // Optional: for signal simulation
    
  }
  async loadReferenceImage() {
    this.referenceImage = new Image();
    this.referenceImage.src = 'assets/images/reference.jpg'; // Path to your reference image
    await this.referenceImage.decode();
  }
  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    const root = document.documentElement;
    if (this.isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
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
        this.videoCallService.joinRoom(this.meetingId);

        this.videoCallService.getRemoteStreamsObservable().subscribe((streams) => {
          this.remoteStreams = streams;

          Object.keys(this.remoteStreams).forEach((userId) => {
            if (!this.signalStrengths[userId]) {
              this.signalStrengths[userId] = 100;
            }
          });
        });

        this.connectionStatus = "Connected";
      })
      .catch((error) =>
        console.error("Error accessing camera/microphone:", error)
      );
  }

  enlargeVideo(userId: string) {
    this.enlargedVideoUserId = this.enlargedVideoUserId === userId ? null : userId;
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

  copyMeetingLink() {
    const meetingLink = `${window.location.origin}/video-call/${this.meetingId}`;
    navigator.clipboard.writeText(meetingLink).then(() => {
      this.toastr.success('Meeting link copied to clipboard!', 'Success');
    }).catch(err => {
      this.toastr.error('Failed to copy link.', 'Error');
      console.error("Failed to copy link: ", err);
    });
  }

  filteredParticipants(): string[] {
    return this.participants.filter(user => user.toLowerCase().includes(this.searchQuery.toLowerCase()));
  }

  toggleParticipants() {
    this.showParticipants = !this.showParticipants;
  }

  toggleVideo() {
    this.videoEnabled = !this.videoEnabled;
    this.localStream.getVideoTracks().forEach(track => track.enabled = this.videoEnabled);
    if (this.videoEnabled) {
      this.toastr.info('Video enabled', 'Info');
    } else {
      this.toastr.info('Video disabled', 'Info');
    }
  }

  toggleAudio() {
    this.audioEnabled = !this.audioEnabled;
    this.localStream.getAudioTracks().forEach(track => track.enabled = this.audioEnabled);
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
    window.location.href = "/";
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
    this.toastr.info(`${this.remoteVideoHidden[userId] ? 'Hiding' : 'Showing'} ${userId}'s video`, 'Info');
  }
  startExpressionDetection() {
    const videoElement = this.localVideo.nativeElement;
  
    setInterval(async () => {
      const expressions = await this.faceService.detectExpressions(videoElement);
      if (expressions) {
        const topExpression = Object.entries(expressions)
          .sort((a, b) => b[1] - a[1])[0][0];
  
        this.detectedExpression = topExpression; // Set it to display in UI
        console.log('Detected expression:', topExpression);
        const isFaceRecognized = await this.compareFaceWithReference(videoElement);
        if (isFaceRecognized) {
          console.log('Face recognized');
        } else {
          console.log('Face not recognized');
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
      neutral: '😐'
    };
    return emojiMap[expression] || '';
  }
  async compareFaceWithReference(videoElement: HTMLVideoElement): Promise<boolean> {
    if (!this.referenceImage) return false;
  
    const result = await this.faceService.compareFace(videoElement, this.referenceImage);
    return result;
  }
}
