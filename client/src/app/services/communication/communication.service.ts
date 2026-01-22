import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Game } from '@app/interfaces/game';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root',
})
export class CommunicationService {
    private readonly baseUrl: string = environment.serverUrl;

    constructor(private readonly http: HttpClient) {}

    getAllGames(): Observable<Game[]> {
        return this.http.get<Game[]>(`${this.baseUrl}/games`).pipe(catchError(this.handleError<Game[]>('getAllGames')));
    }

    getGameById(id: string): Observable<Game> {
        return this.http.get<Game>(`${this.baseUrl}/games/${id}`).pipe(catchError(this.handleError<Game>('getGameById')));
    }

    createGame(gameData: Partial<Game>): Observable<Game> {
        return this.http.post<Game>(`${this.baseUrl}/games`, gameData).pipe(catchError(this.handleError<Game>('createGame')));
    }

    updateGame(id: string, gameData: Partial<Game>): Observable<Game> {
        return this.http.patch<Game>(`${this.baseUrl}/games/${id}`, gameData).pipe(catchError(this.handleError<Game>('updateGame')));
    }

    deleteGame(id: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/games/${id}`).pipe(catchError(this.handleError<void>('deleteGame')));
    }

    private handleError<T>(request: string, result?: T): (error: Error) => Observable<T> {
        return () => of(result as T);
    }
}
