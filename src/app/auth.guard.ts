// auth.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const user = localStorage.getItem('loggedInUser');

    if (user) {
      return true;
    } else {
      // Save intended route (e.g., /video-call/abc123)
      localStorage.setItem('redirectAfterLogin', state.url);
      this.router.navigate(['/login']);
      return false;
    }
  }
}
