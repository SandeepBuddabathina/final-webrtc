import { Injectable } from '@angular/core';
import * as faceapi from 'face-api.js';

@Injectable({
  providedIn: 'root',
})
export class FaceExpressionService {
  async loadModels(): Promise<void> {
    const MODEL_URL = '/assets/models';

    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
  }

  async detectExpressions(
    video: HTMLVideoElement
  ): Promise<faceapi.FaceExpressions | null> {
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceExpressions();

    return detection?.expressions ?? null;
  }

  async compareFace(
    videoElement: HTMLVideoElement,
    referenceImage: HTMLImageElement
  ): Promise<boolean> {
    const videoFaceDescriptor = await this.getFaceDescriptor(videoElement);
    const referenceFaceDescriptor = await this.getFaceDescriptor(
      referenceImage
    );

    if (!videoFaceDescriptor || !referenceFaceDescriptor) {
      return false;
    }

    const distance = faceapi.euclideanDistance(
      videoFaceDescriptor,
      referenceFaceDescriptor
    );
    return distance < 0.6;
  }

  private async getFaceDescriptor(
    image: HTMLVideoElement | HTMLImageElement
  ): Promise<Float32Array | null> {
    const detections = await faceapi
      .detectSingleFace(image)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detections) {
      return null;
    }

    return detections.descriptor as Float32Array;
  }
}
