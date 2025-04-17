import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { Observable } from 'rxjs';
import { FaceAuthService } from './services/face-auth.service'; // Import your face auth service

@Injectable({
  providedIn: 'root',
})
export class FaceAuthGuard implements CanActivate {
  constructor(
    private faceAuthService: FaceAuthService,
    private router: Router
  ) {}

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    // Check if the user is authenticated via face recognition
    if (this.faceAuthService.isAuthenticated()) {
      return true; // User is authenticated, allow access
    } else {
      // Redirect to face authentication page if not authenticated
      this.router.navigate(['/face-auth']);
      return false;
    }
  }
}
