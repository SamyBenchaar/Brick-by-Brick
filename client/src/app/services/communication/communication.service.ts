import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Game } from '@app/interfaces/game';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root',
})
export class CommunicationService {
    private readonly baseUrl: string = environment.serverUrl;

    constructor(private readonly http: HttpClient) {}

    getAllGames(): Observable<Game[]> {
        return this.http.get<Game[]>(`${this.baseUrl}/games`).pipe(catchError(this.handleError));
    }

    getVisibleGames(): Observable<Game[]> {
        return this.http.get<Game[]>(`${this.baseUrl}/games/visible`);
    }

    getGameById(id: string): Observable<Game> {
        return this.http.get<Game>(`${this.baseUrl}/games/${id}`).pipe(catchError(this.handleError));
    }

    createGame(gameData: Partial<Game>): Observable<Game> {
        return this.http.post<Game>(`${this.baseUrl}/games`, gameData).pipe(catchError(this.handleError));
    }

    updateGame(id: string, gameData: Partial<Game | null>): Observable<Game> {
        return this.http.put<Game>(`${this.baseUrl}/games/${id}`, gameData).pipe(catchError(this.handleError));
    }

    updateGameVisibility(id: string, isVisible: boolean): Observable<Game> {
        return this.http
            .patch<Game>(`${this.baseUrl}/games/${id}/visibility`, { isVisible })
            .pipe(catchError(this.handleError));
    }

    deleteGame(id: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/games/${id}`).pipe(catchError(this.handleError));
    }

    private handleError(err: Error): Observable<never> {
        return throwError(() => err);
    }
}
