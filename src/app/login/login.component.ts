import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  email = '';
  password = '';

  constructor(private router: Router, private toastr: ToastrService) {}

  login() {
    if (!this.email || !this.password) {
      this.toastr.warning('Please enter email and password');
      return;
    }

    const storedUsers = JSON.parse(localStorage.getItem('users') || '[]');
    const user = storedUsers.find(
      (u: any) => u.email === this.email && u.password === this.password
    );

    if (user) {
      localStorage.setItem('loggedInUser', JSON.stringify(user));
      this.toastr.success('Login successful!');

      const redirectUrl = localStorage.getItem('redirectAfterLogin');

      if (redirectUrl) {
        localStorage.removeItem('redirectAfterLogin');
        this.router.navigateByUrl(redirectUrl);
      } else {
        const roomId = this.generateRoomId();
        localStorage.setItem('hostRoomId', roomId);
        localStorage.setItem('isHost', 'true');
        this.router.navigate(['/video-call', roomId]);
      }
    } else {
      this.toastr.error('Invalid credentials!');
    }
  }

  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 10);
  }
}
