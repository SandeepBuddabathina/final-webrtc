import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VideoCallComponent } from './video-call/video-call.component';
import { FaceAuthComponent } from './face-auth/face-auth.component';
import { FaceAuthGuard } from './face-auth.guard';
import { RegisterComponent } from './register/register.component';
import { LoginComponent } from './login/login.component';
import { AuthGuard } from './auth.guard';

const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'face-auth', component: FaceAuthComponent },
  {
    path: 'video-call/:roomId',
    component: VideoCallComponent,
    canActivate: [AuthGuard, FaceAuthGuard]     // ← add FaceAuthGuard here
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { } 
