import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Game } from '@app/interfaces/game';
import { environment } from 'src/environments/environment';
import { CommunicationService } from './communication.service';

/**
 * Stratégie de test pour CommunicationService:
 *
 * 1. Tests de communication HTTP: Vérifier que le service envoie les bonnes requêtes (GET, POST, PUT, PATCH, DELETE)
 *    avec les paramètres corrects vers les bons endpoints
 * 2. Tests des réponses: Valider que les réponses du serveur sont correctement reçues et retournées
 * 3. Tests de gestion des erreurs: Assurer que les erreurs HTTP sont correctement propagées via les observables
 * 4. Intégrité des données: Vérifier que les données mockes correspondent à la structure réelle des DTOs
 *
 * Cas limites testés:
 * - Récupération d'un jeu inexistant (erreur 404)
 * - Création d'un jeu avec des données invalides (erreur 400)
 * - Mise à jour avec null (vérifier l'acceptation)
 * - Suppression d'un jeu en utilisation (erreur 409)
 * - Erreurs serveur (500)
 * - Tous les verbes HTTP sont testés (GET, POST, PUT, PATCH, DELETE)
 */

describe('CommunicationService', () => {
    let service: CommunicationService;
    let httpMock: HttpTestingController;
    const baseUrl = environment.serverUrl;

    const jeuMocke: Game = {
        _id: '123',
        name: 'Jeu Test',
        description: 'Description du jeu',
        isVisible: true,
        numberOfPlayers: 2,
        gameMode: 'classique',
        mapConfig: {
            size: '10x10',
            tiles: [],
        },
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [CommunicationService],
        });
        service = TestBed.inject(CommunicationService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    describe('getJeuParId', () => {
        it('devrait récupérer un jeu par son id avec une requête GET', (fait) => {
            const idJeu = '123';

            service.getGameById(idJeu).subscribe({
                next: (jeu: Game) => {
                    expect(jeu).toEqual(jeuMocke);
                    expect(jeu.name).toBe('Jeu Test');
                    fait();
                },
                error: () => {
                    fail('ne devrait pas avoir d\'erreur');
                },
            });

            const requete = httpMock.expectOne(`${baseUrl}/games/${idJeu}`);
            expect(requete.request.method).toBe('GET');
            requete.flush(jeuMocke);
        });

        it('devrait gérer les erreurs lors de la récupération d\'un jeu', (fait) => {
            const idJeu = '123';

            service.getGameById(idJeu).subscribe({
                next: () => {
                    fail('ne devrait pas reussir');
                },
                error: (err: Error) => {
                    expect(err).toBeDefined();
                    expect(err.message).toContain('404');
                    fait();
                },
            });

            const requete = httpMock.expectOne(`${baseUrl}/games/${idJeu}`);
            requete.error(new ProgressEvent('erreur'), { status: 404, statusText: 'Non trouvé' });
        });
    });

    describe('creerJeu', () => {
        it('devrait créer un nouveau jeu avec une requête POST', (fait) => {
            const donneesJeu: Partial<Game> = {
                name: 'Jeu Test',
                description: 'Description du jeu',
                isVisible: true,
                numberOfPlayers: 2,
                gameMode: 'classique',
            };

            service.createGame(donneesJeu).subscribe({
                next: (jeuCree: Game) => {
                    expect(jeuCree._id).toBe('123');
                    expect(jeuCree.name).toBe('Jeu Test');
                    fait();
                },
                error: () => {
                    fail('ne devrait pas avoir d\'erreur');
                },
            });

            const requete = httpMock.expectOne(`${baseUrl}/games`);
            expect(requete.request.method).toBe('POST');
            expect(requete.request.body).toEqual(donneesJeu);
            requete.flush(jeuMocke);
        });

        it('devrait gérer les erreurs lors de la création d\'un jeu', (fait) => {
            const donneesJeu: Partial<Game> = { name: '' };

            service.createGame(donneesJeu).subscribe({
                next: () => {
                    fail('ne devrait pas reussir');
                },
                error: (err: Error) => {
                    expect(err).toBeDefined();
                    expect(err.message).toContain('400');
                    fait();
                },
            });

            const requete = httpMock.expectOne(`${baseUrl}/games`);
            requete.error(new ProgressEvent('erreur'), { status: 400, statusText: 'Mauvaise requête' });
        });
    });

    describe('mettreAJourJeu', () => {
        it('devrait mettre à jour un jeu avec une requête PUT', (fait) => {
            const idJeu = '123';
            const donneesMAJ: Partial<Game> = { name: 'Nom mis à jour' };

            service.updateGame(idJeu, donneesMAJ).subscribe({
                next: (jeuMAJ: Game) => {
                    expect(jeuMAJ._id).toBe('123');
                    fait();
                },
                error: () => {
                    fail('ne devrait pas avoir d\'erreur');
                },
            });

            const requete = httpMock.expectOne(`${baseUrl}/games/${idJeu}`);
            expect(requete.request.method).toBe('PUT');
            expect(requete.request.body).toEqual(donneesMAJ);
            requete.flush(jeuMocke);
        });

        it('devrait accepter null comme données de mise à jour', (fait) => {
            const idJeu = '123';

            service.updateGame(idJeu, null).subscribe({
                next: (jeuMAJ: Game) => {
                    expect(jeuMAJ._id).toBe('123');
                    fait();
                },
                error: () => {
                    fail('ne devrait pas avoir d\'erreur');
                },
            });

            const requete = httpMock.expectOne(`${baseUrl}/games/${idJeu}`);
            expect(requete.request.method).toBe('PUT');
            requete.flush(jeuMocke);
        });
    });

    describe('mettreAJourVisibiliteJeu', () => {
        it('devrait mettre à jour la visibilité d\'un jeu avec une requête PATCH', (fait) => {
            const idJeu = '123';
            const nouvelleVisibilite = false;

            service.updateGameVisibility(idJeu, nouvelleVisibilite).subscribe({
                next: (jeuMAJ: Game) => {
                    expect(jeuMAJ._id).toBe('123');
                    fait();
                },
                error: () => {
                    fail('ne devrait pas avoir d\'erreur');
                },
            });

            const requete = httpMock.expectOne(`${baseUrl}/games/${idJeu}/visibility`);
            expect(requete.request.method).toBe('PATCH');
            expect(requete.request.body).toEqual({ isVisible: nouvelleVisibilite });
            requete.flush(jeuMocke);
        });

        it('devrait gérer les erreurs de mise à jour de visibilité', (fait) => {
            const idJeu = '123';

            service.updateGameVisibility(idJeu, true).subscribe({
                next: () => {
                    fail('ne devrait pas reussir');
                },
                error: (err: Error) => {
                    expect(err).toBeDefined();
                    expect(err.message).toContain('500');
                    fait();
                },
            });

            const requete = httpMock.expectOne(`${baseUrl}/games/${idJeu}/visibility`);
            requete.error(new ProgressEvent('erreur'), { status: 500, statusText: 'Erreur interne du serveur' });
        });
    });

    describe('supprimerJeu', () => {
        it('devrait supprimer un jeu avec une requête DELETE', (fait) => {
            const idJeu = '123';

            service.deleteGame(idJeu).subscribe({
                next: () => {
                    fait();
                },
                error: () => {
                    fail('ne devrait pas avoir d\'erreur');
                },
            });

            const requete = httpMock.expectOne(`${baseUrl}/games/${idJeu}`);
            expect(requete.request.method).toBe('DELETE');
            requete.flush(null);
        });

        it('devrait gérer les erreurs lors de la suppression d\'un jeu', (fait) => {
            const idJeu = '123';

            service.deleteGame(idJeu).subscribe({
                next: () => {
                    fail('ne devrait pas reussir');
                },
                error: (err: Error) => {
                    expect(err).toBeDefined();
                    expect(err.message).toContain('409');
                    fait();
                },
            });

            const requete = httpMock.expectOne(`${baseUrl}/games/${idJeu}`);
            requete.error(new ProgressEvent('erreur'), { status: 409, statusText: 'Conflit' });
        });
    });

    describe('Gestion des erreurs globale', () => {
        it('devrait retourner une observable avec l\'erreur', (fait) => {
            service.getGameById('123').subscribe({
                next: () => {
                    fail('ne devrait pas reussir');
                },
                error: (err: Error) => {
                    expect(err).toBeDefined();
                    fait();
                },
            });

            const requete = httpMock.expectOne(`${baseUrl}/games/123`);
            requete.error(new ProgressEvent('erreur'));
        });
    });
});
