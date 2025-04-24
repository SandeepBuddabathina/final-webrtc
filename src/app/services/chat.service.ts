import { Injectable } from '@angular/core';
import { io } from 'socket.io-client';

interface Message {
  sender: string;  // User sending the message
  text: string;    // The message text
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private socket: any;

  constructor() {
    this.socket = io('http://localhost:3000');  // Connect to your backend
  }

  sendMessage(sender: string, text: string): void {
    const messageData: Message = { sender, text };
    this.socket.emit('send-message', messageData);  // Emit message to backend
  }

  receiveMessage(callback: (message: Message) => void): void {
    this.socket.on('receive-message', (message: Message) => {
      callback(message);  // Call the callback with the received message
    });
  }

  // Optional: Emit typing event
  typing(data: any) {
    this.socket.emit('typing', data);
  }
}
