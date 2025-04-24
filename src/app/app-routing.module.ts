import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VideoCallComponent } from './video-call/video-call.component';
import { FaceAuthComponent } from './face-auth/face-auth.component';
import { FaceAuthGuard } from './face-auth.guard';

const routes: Routes = [
  { path: '', redirectTo: '/face-auth', pathMatch: 'full' },
  { path: 'face-auth', component: FaceAuthComponent },
  { path: 'video-call/:roomId', component: VideoCallComponent },

];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { } 
