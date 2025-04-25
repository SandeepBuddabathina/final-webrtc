import { Injectable } from '@angular/core';
import * as faceapi from 'face-api.js';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class FaceAuthService {
  private isUserAuthenticated: boolean = false;
  private referenceImages: HTMLImageElement[] = [];

  constructor(private http: HttpClient) {}

  setAuthenticated(status: boolean): void {
    this.isUserAuthenticated = status;
  }

  isAuthenticated(): boolean {
    return this.isUserAuthenticated;
  }

  async loadModels(): Promise<void> {
    const MODEL_URL = '/assets/models';
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
  }

  async loadReferenceImages(): Promise<HTMLImageElement[]> {
    const metadata: any = await this.http
      .get('https://face-back-production.up.railway.app/images')
      .toPromise();

    const validImages: HTMLImageElement[] = [];

    for (const meta of metadata) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = `https://face-back-production.up.railway.app/uploads/${meta.name}`; // Updated to match the new route

      img.alt = meta.name;

      await new Promise((resolve) => {
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
      });

      const descriptor = await this.getDescriptor(img);
      if (descriptor) {
        validImages.push(img);
      }
    }

    this.referenceImages = validImages;
    return validImages;
  }

  async getDescriptor(
    input: HTMLImageElement | HTMLVideoElement
  ): Promise<Float32Array | null> {
    try {
      const detection = await faceapi
        .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      return detection?.descriptor || null;
    } catch {
      return null;
    }
  }

  async autoVerifyFace(
    liveDescriptor: Float32Array
  ): Promise<{ matched: boolean; label?: string }> {
    if (this.referenceImages.length === 0) return { matched: false };

    const matches = [];

    for (const img of this.referenceImages) {
      const refDescriptor = await this.getDescriptor(img);
      if (!refDescriptor) continue;

      const distance = faceapi.euclideanDistance(refDescriptor, liveDescriptor);
      matches.push({ label: img.alt, distance });
    }

    if (matches.length === 0) return { matched: false };

    const bestMatch = matches.reduce((prev, curr) =>
      curr.distance < prev.distance ? curr : prev
    );

    if (bestMatch.distance < 0.45) {
      this.setAuthenticated(true);
      return { matched: true, label: bestMatch.label };
    } else {
      return { matched: false };
    }
  }
}
