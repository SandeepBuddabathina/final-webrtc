import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VideoCallComponent } from './video-call/video-call.component';
import { FaceAuthComponent } from './face-auth/face-auth.component';
import { FaceAuthGuard } from './face-auth.guard';
import { RegisterComponent } from './register/register.component';
import { LoginComponent } from './login/login.component';

const routes: Routes = [
 // { path: '', redirectTo: '/face-auth', pathMatch: 'full' },
  {path:'',component:LoginComponent},
  { path: 'login',component:LoginComponent},
  { path: 'face-auth', component: FaceAuthComponent },
  { path: 'video-call/:roomId', component: VideoCallComponent },
  { path: 'register', component: RegisterComponent },

];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { } 
