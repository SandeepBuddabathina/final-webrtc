import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import * as faceapi from 'face-api.js';
import { CommonModule } from '@angular/common';
import { FaceAuthService } from '../services/face-auth.service';

@Component({
  selector: 'app-face-auth',
  templateUrl: './face-auth.component.html',
  standalone: true,
  imports: [CommonModule],
  styleUrls: ['./face-auth.component.css'],
})
export class FaceAuthComponent implements OnInit {
  @ViewChild('videoElement', { static: true })
  videoRef!: ElementRef<HTMLVideoElement>;

  result: string = 'Initializing...';
  isLoading: boolean = true;

  constructor(
    private router: Router,
    private toastr: ToastrService,
    private faceAuthService: FaceAuthService
  ) {}

  async ngOnInit() {
    try {
      // If already face-verified and we have a saved redirect, go there immediately
      const faceVerified = localStorage.getItem('faceVerified') === 'true';
      const redirectUrl = localStorage.getItem('redirectAfterAuth');
      if (faceVerified && redirectUrl) {
        localStorage.removeItem('redirectAfterAuth');
        this.router.navigateByUrl(redirectUrl);
        return;
      }

      // Otherwise, load models & webcam
      await this.faceAuthService.loadModels();
      await this.startVideo();
      const refs = await this.faceAuthService.loadReferenceImages();

      if (refs.length === 0) {
        this.result = 'No valid reference faces found';
        this.toastr.error('No valid faces found!', 'Error');
      } else {
        this.result = `Loaded ${refs.length} reference faces`;
      }
    } catch (err) {
      console.error('Initialization error:', err);
      this.result = 'Initialization failed';
      this.toastr.error('Error initializing face auth', 'Error');
    }
  }

  private async startVideo() {
    const video = this.videoRef.nativeElement;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    video.onloadeddata = () => {
      video.play();
      this.result = 'Webcam started';
      this.isLoading = false;
    };
  }

  async onJoinNow() {
    this.isLoading = true;
    this.result = 'Verifying face...';

    try {
      const video = this.videoRef.nativeElement;
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        this.result = 'No face detected';
        this.toastr.error('Try again', 'No Face Found');
        this.isLoading = false;
        return;
      }

      const match = await this.faceAuthService.autoVerifyFace(
        detections[0].descriptor
      );

      if (match.matched) {
        this.result = `Welcome ${match.label}`;
        this.toastr.success(`Welcome ${match.label}`, 'Face Matched');
        localStorage.setItem('faceVerified', 'true');

        // Redirect back to the exact room URL, if present
        const redirectUrl = localStorage.getItem('redirectAfterAuth');
        if (redirectUrl) {
          localStorage.removeItem('redirectAfterAuth');
          this.router.navigateByUrl(redirectUrl);
        } else {
          // Fallback (unlikely for participants)
          const hostRoom = localStorage.getItem('hostRoomId');
          this.router.navigate(['/video-call', hostRoom]);
        }
      } else {
        this.result = 'Face not matched';
        this.toastr.error('Access Denied', 'Verification Failed');
      }
    } catch (error) {
      console.error('Verification error:', error);
      this.result = 'Verification failed';
      this.toastr.error('Unexpected error', 'Verification Failed');
    }

    this.isLoading = false;
  }

  onLeaveCall() {
    this.result = 'Left the call';
    this.toastr.info('You left the call.', 'Exit');
    this.router.navigate(['/']);
  }
}
