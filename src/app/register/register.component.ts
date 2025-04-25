import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
})
export class RegisterComponent {
  name = '';
  email = '';
  password = '';
  confirmPassword = '';

  constructor(private router: Router, private toastr: ToastrService) {}

  register() {
    if (!this.name || !this.email || !this.password || !this.confirmPassword) {
      this.toastr.warning('All fields are required');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.toastr.error('Passwords do not match');
      return;
    }

    const storedUsers = JSON.parse(localStorage.getItem('users') || '[]');
    const userExists = storedUsers.find((u: any) => u.email === this.email);

    if (userExists) {
      this.toastr.error('User already exists with this email');
      return;
    }

    storedUsers.push({
      name: this.name,
      email: this.email,
      password: this.password,
    });
    localStorage.setItem('users', JSON.stringify(storedUsers));
    this.toastr.success('Registration successful!');

    this.router.navigate(['/login']);
  }
}
