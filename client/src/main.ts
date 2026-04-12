import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import localeFr from '@angular/common/locales/fr-CA';
import { enableProdMode, enableProfiling, provideZoneChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { Routes, provideRouter, withHashLocation } from '@angular/router';
import { AdminPageComponent } from '@app/pages/admin-page/admin-page.component';
import { AppComponent } from '@app/pages/app/app.component';
import { CharacterCreationPageComponent } from '@app/pages/character-creation-page/character-creation-page.component';
import { EditionPageComponent } from '@app/pages/edition-page/edition-page.component';
import { GameCreationPageComponent } from '@app/pages/game-creation-page/game-creation-page.component';
import { JoinGamePageComponent } from '@app/pages/join-game-page/join-game-page.component';
import { MainPageComponent } from '@app/pages/main-page/main-page.component';
import { WaitingRoomPage } from '@app/pages/waiting-room-page/waiting-room-page.component';
import { GameViewComponent } from '@app/pages/game-view/game-view.component';
import { environment } from './environments/environment';
import { GameStatisticsComponent } from '@app/pages/game-statistics/game-statistics.component';

registerLocaleData(localeFr);

if (environment.production) {
    enableProdMode();
}


const routes: Routes = [
    { path: '', redirectTo: '/home', pathMatch: 'full' },
    { path: 'home', component: MainPageComponent },
    { path: 'game-creation', component: GameCreationPageComponent },
    { path: 'waiting-room/:gameId', component: WaitingRoomPage },
    { path: 'waiting-room', component: WaitingRoomPage },
    { path: 'edition/:game_id', component: EditionPageComponent },
    { path: 'edition', component: EditionPageComponent },
    { path: 'admin', component: AdminPageComponent },
    { path: 'character-creation', component: CharacterCreationPageComponent },
    { path: 'join-game', component: JoinGamePageComponent },
    { path: 'game-view', component: GameViewComponent },
    { path: 'game-statistics', component: GameStatisticsComponent },
    { path: '**', redirectTo: '/home' },
];

enableProfiling();
bootstrapApplication(AppComponent, {
    providers: [provideZoneChangeDetection(), provideHttpClient(), provideRouter(routes, withHashLocation())],
});
