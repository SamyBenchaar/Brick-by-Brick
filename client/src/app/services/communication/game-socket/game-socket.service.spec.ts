import { TestBed } from '@angular/core/testing';
import { Game } from '@app/interfaces/game';
import { GameEvents } from '@common/game.events';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { GameSocketService } from '@app/services/communication/game-socket/game-socket.service';

/**
 * Stratégie de test pour GameSocketService:
 *
 * 1. Tests d'intégration avec SocketService: Vérifier que le service gère correctement les événements socket
 *    en écoutant et en mettant à jour le signal des jeux
 * 2. Tests du cycle de vie: Assurer la connexion, la configuration des écouteurs et la déconnexion
 * 3. Gestion des événements socket: Tester la réception et le traitement des quatre événements principaux
 *    (GameList, GameCreated, GameUpdated, GameDeleted)
 * 4. Intégrité du signal réactif: Valider que les modifications du signal déclenchent les mises à jour correctes
 * 5. Isolation des dépendances: Utiliser des mocks Jasmine pour isoler SocketService
 *
 * Cas limites testés:
 * - Réception d'une liste vide de jeux
 * - Suppression d'un jeu inexistant (aucun changement)
 * - Mise à jour d'un jeu existant (pas de duplication)
 * - Ajout de jeux à une liste existante
 * - Intégration complète: plusieurs événements successifs
 * - Demande de liste (visibleOnly true/false)
 */

describe('GameSocketService', () => {
    let service: GameSocketService;
    let socketServiceMock: jasmine.SpyObj<SocketService>;

    const jeuMocke: Game = {
        _id: '123',
        name: 'Jeu Test Socket',
        description: 'Test de socket',
        isVisible: true,
        numberOfPlayers: 2,
        gameMode: 'classique',
        mapConfig: {
            size: '10x10',
            tiles: [],
        },
    };

    const jeuMocke2: Game = {
        _id: '456',
        name: 'Deuxième Jeu',
        description: 'Autre jeu',
        isVisible: false,
        numberOfPlayers: 4,
        gameMode: 'equipe',
        mapConfig: {
            size: '15x15',
            tiles: [],
        },
    };

    beforeEach(() => {
        socketServiceMock = jasmine.createSpyObj('SocketService', [
            'connect',
            'disconnect',
            'on',
            'off',
            'emit',
            'isConnected',
            'getSocketId',
        ]);

        TestBed.configureTestingModule({
            providers: [GameSocketService, { provide: SocketService, useValue: socketServiceMock }],
        });
        service = TestBed.inject(GameSocketService);
    });

    describe('Initialisation de la connexion', () => {
        it('devrait connecter le service socket lors de la connexion', () => {
            service.connect();

            expect(socketServiceMock.connect).toHaveBeenCalled();
        });

        it('devrait demander la liste des jeux non visibles lors de la connexion', () => {
            service.connect();

            expect(socketServiceMock.emit).toHaveBeenCalledWith(GameEvents.RequestGameList);
        });

        it('devrait configurer les écouteurs d\'événements lors de la connexion', () => {
            service.connect();

            expect(socketServiceMock.on).toHaveBeenCalledWith(
                GameEvents.GameList,
                jasmine.any(Function),
            );
            expect(socketServiceMock.on).toHaveBeenCalledWith(
                GameEvents.GameCreated,
                jasmine.any(Function),
            );
            expect(socketServiceMock.on).toHaveBeenCalledWith(
                GameEvents.GameUpdated,
                jasmine.any(Function),
            );
            expect(socketServiceMock.on).toHaveBeenCalledWith(
                GameEvents.GameDeleted,
                jasmine.any(Function),
            );
        });
    });

    describe('Réception de la liste des jeux', () => {
        it('devrait mettre à jour le signal des jeux lors de la réception de GameList', () => {
            const jeuxMockes = [jeuMocke, jeuMocke2];

            service.connect();

            // Récupérer le callback enregistré
            const callbackGameList = socketServiceMock.on.calls
                .all()
                .find((call) => call.args[0] === GameEvents.GameList)?.args[1] as (jeux: Game[]) => void;

            callbackGameList(jeuxMockes);

            expect(service.games()).toEqual(jeuxMockes);
        });

        it('devrait contenir deux jeux après la réception de la liste', () => {
            const jeuxMockes = [jeuMocke, jeuMocke2];

            service.connect();

            const callbackGameList = socketServiceMock.on.calls
                .all()
                .find((call) => call.args[0] === GameEvents.GameList)?.args[1] as (jeux: Game[]) => void;

            callbackGameList(jeuxMockes);

            expect(service.games().length).toBe(2);
        });
    });

    describe('Création d\'un jeu', () => {
        it('devrait ajouter un nouveau jeu à la liste lors de GameCreated', () => {
            service.games.set([jeuMocke]);

            service.connect();

            const callbackGameCreated = socketServiceMock.on.calls
                .all()
                .find((call) => call.args[0] === GameEvents.GameCreated)?.args[1] as (jeu: Game) => void;

            callbackGameCreated(jeuMocke2);

            const jeuxActuels = service.games();
            expect(jeuxActuels.length).toBe(2);
            expect(jeuxActuels[1]).toEqual(jeuMocke2);
        });

        it('devrait contenir le jeu créé dans la liste', () => {
            service.games.set([]);

            service.connect();

            const callbackGameCreated = socketServiceMock.on.calls
                .all()
                .find((call) => call.args[0] === GameEvents.GameCreated)?.args[1] as (jeu: Game) => void;

            callbackGameCreated(jeuMocke);

            expect(service.getCurrentGames()).toContain(jeuMocke);
        });
    });

    describe('Mise à jour d\'un jeu', () => {
        it('devrait mettre à jour un jeu existant lors de GameUpdated', () => {
            service.games.set([jeuMocke]);

            service.connect();

            const jeuMisAJour: Game = {
                ...jeuMocke,
                name: 'Jeu Mis à Jour',
            };

            const callbackGameUpdated = socketServiceMock.on.calls
                .all()
                .find((call) => call.args[0] === GameEvents.GameUpdated)?.args[1] as (jeu: Game) => void;

            callbackGameUpdated(jeuMisAJour);

            const jeuxActuels = service.games();
            expect(jeuxActuels[0].name).toBe('Jeu Mis à Jour');
            expect(jeuxActuels.length).toBe(1);
        });

        it('devrait ne pas augmenter le nombre de jeux lors d\'une mise à jour', () => {
            service.games.set([jeuMocke, jeuMocke2]);

            service.connect();

            const jeuMisAJour: Game = {
                ...jeuMocke,
                name: 'Nouveau Nom',
            };

            const callbackGameUpdated = socketServiceMock.on.calls
                .all()
                .find((call) => call.args[0] === GameEvents.GameUpdated)?.args[1] as (jeu: Game) => void;

            callbackGameUpdated(jeuMisAJour);

            expect(service.games().length).toBe(2);
        });
    });

    describe('Suppression d\'un jeu', () => {
        it('devrait supprimer un jeu de la liste lors de GameDeleted', () => {
            service.games.set([jeuMocke, jeuMocke2]);

            service.connect();

            const callbackGameDeleted = socketServiceMock.on.calls
                .all()
                .find((call) => call.args[0] === GameEvents.GameDeleted)?.args[1] as (idJeu: string) => void;

            callbackGameDeleted(jeuMocke._id);

            const jeuxActuels = service.games();
            expect(jeuxActuels.length).toBe(1);
            expect(jeuxActuels[0]._id).toBe(jeuMocke2._id);
        });

        it('ne devrait pas supprimer un jeu avec un id qui n\'existe pas', () => {
            service.games.set([jeuMocke, jeuMocke2]);

            service.connect();

            const callbackGameDeleted = socketServiceMock.on.calls
                .all()
                .find((call) => call.args[0] === GameEvents.GameDeleted)?.args[1] as (idJeu: string) => void;

            callbackGameDeleted('999');

            expect(service.games().length).toBe(2);
        });
    });

    describe('Demande de liste des jeux', () => {
        it('devrait émettre RequestGameList quand visibleOnly est false', () => {
            service.requestGameList(false);

            expect(socketServiceMock.emit).toHaveBeenCalledWith(GameEvents.RequestGameList);
        });

        it('devrait émettre RequestVisibleGameList quand visibleOnly est true', () => {
            service.requestGameList(true);

            expect(socketServiceMock.emit).toHaveBeenCalledWith(GameEvents.RequestVisibleGameList);
        });
    });

    describe('Déconnexion', () => {
        it('devrait arrêter d\'écouter tous les événements lors de la déconnexion', () => {
            service.connect();
            service.disconnect();

            expect(socketServiceMock.off).toHaveBeenCalledWith(GameEvents.GameList);
            expect(socketServiceMock.off).toHaveBeenCalledWith(GameEvents.GameCreated);
            expect(socketServiceMock.off).toHaveBeenCalledWith(GameEvents.GameUpdated);
            expect(socketServiceMock.off).toHaveBeenCalledWith(GameEvents.GameDeleted);
        });

        it('devrait déconnecter le service socket lors de la déconnexion', () => {
            service.connect();
            service.disconnect();

            expect(socketServiceMock.disconnect).toHaveBeenCalled();
        });
    });

    describe('Récupération des jeux actuels', () => {
        it('devrait retourner la liste des jeux actuels', () => {
            const jeuxMockes = [jeuMocke, jeuMocke2];
            service.games.set(jeuxMockes);

            const jeuxActuels = service.getCurrentGames();

            expect(jeuxActuels).toEqual(jeuxMockes);
        });

        it('devrait retourner une liste vide si aucun jeu n\'est présent', () => {
            service.games.set([]);

            const jeuxActuels = service.getCurrentGames();

            expect(jeuxActuels.length).toBe(0);
        });
    });

    describe('Intégration complète', () => {
        it('devrait gérer plusieurs événements socket successifs', () => {
            service.connect();

            // Simuler la réception initiale d'une liste de jeux
            const callbackGameList = socketServiceMock.on.calls
                .all()
                .find((call) => call.args[0] === GameEvents.GameList)?.args[1] as (jeux: Game[]) => void;

            callbackGameList([jeuMocke]);
            expect(service.games().length).toBe(1);

            // Simuler la création d'un nouveau jeu
            const callbackGameCreated = socketServiceMock.on.calls
                .all()
                .find((call) => call.args[0] === GameEvents.GameCreated)?.args[1] as (jeu: Game) => void;

            callbackGameCreated(jeuMocke2);
            expect(service.games().length).toBe(2);

            // Simuler la suppression d'un jeu
            const callbackGameDeleted = socketServiceMock.on.calls
                .all()
                .find((call) => call.args[0] === GameEvents.GameDeleted)?.args[1] as (idJeu: string) => void;

            callbackGameDeleted(jeuMocke._id);
            expect(service.games().length).toBe(1);
            expect(service.games()[0]._id).toBe(jeuMocke2._id);
        });
    });
});
