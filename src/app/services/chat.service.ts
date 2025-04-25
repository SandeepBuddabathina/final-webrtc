import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private socket: Socket;
  private messageSubject: Subject<any> = new Subject<any>();

  constructor() {
    this.socket = io('https://face-back-production.up.railway.app');
    this.socket.on('receive-message', (msg) => this.messageSubject.next(msg));
  }

  sendMessage(message: { sender: string; text: string }): void {
    this.socket.emit('send-message', message);
  }

  receiveMessage(callback: (msg: any) => void): void {
    this.messageSubject.subscribe(callback);
  }
}
