import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
} from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class FaceAuthGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    const isHost = localStorage.getItem('isHost') === 'true';
    const isVerified = localStorage.getItem('faceVerified') === 'true';

    if (isHost || isVerified) {
      return true;
    }

    const roomId = route.paramMap.get('roomId');
    this.router.navigate(['/face-auth'], { queryParams: { roomId } });
    return false;
  }
}
