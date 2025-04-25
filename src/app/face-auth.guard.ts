// face-auth.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class FaceAuthGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const isHost = localStorage.getItem('isHost') === 'true';
    const faceVerified = localStorage.getItem('faceVerified') === 'true';

    if (isHost || faceVerified) {
      return true;
    }

    // Not verified — save where we wanted to go, then redirect
    localStorage.setItem('redirectAfterAuth', state.url);
    this.router.navigate(['/face-auth']);
    return false;
  }
}
