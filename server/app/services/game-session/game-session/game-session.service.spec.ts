import { GameGateway } from '@app/gateways/game/game.gateway';
import { CombatService } from '@app/services/game-session/combat.service';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { MovementService } from '@app/services/game-session/movement.service';
import { StartingPointService } from '@app/services/game-session/starting-point.service';
import { TurnManagementService } from '@app/services/game-session/turn-management.service';
import { VirtualPlayerCtfService } from '@app/services/game-session/virtual-player-ctf.service';
import { VirtualPlayerMechanicsService } from '@app/services/game-session/virtual-player-mechanics.service';
import { VirtualPlayerPathfindingService } from '@app/services/game-session/virtual-player-mechanics/virtual-player-pathfinding.service';
import { VirtualPlayerTargetingService } from '@app/services/game-session/virtual-player-mechanics/virtual-player-targeting.service';
import { VirtualPlayerService } from '@app/services/game-session/virtual-player.service';
import { GameService } from '@app/services/game/game.service';
import { Character } from '@common/character';
import { Dice } from '@common/dice';
import { Player } from '@common/player';
import { Test, TestingModule } from '@nestjs/testing';

/**
 * Stratégie de test pour GameSessionService:
 *
 * 2. Rejoindre une session : Tester les cas valides et d'erreur (introuvable, pleine, déjà commencée)
 * 3. Sessions disponibles : Filtrer par statut et capacité
 * 4. Suppression et expulsion : Vérifier la gestion des joueurs et des sessions
 *
 * Cas limites testés:
 * - Rejoindre une session inexistante
 * - Rejoindre une session pleine
 * - Rejoindre une session déjà commencée
 * - Sessions disponibles avec mix de statuts
 */
describe('GameSessionService', () => {
    const SESSION_MIN_JOINER_INDEX = 2;
    const SESSION_MAX_PLAYERS = 4;

    let service: GameSessionService;
    let mockGameService: { findOne: jest.Mock };

    const createCharacter = (name = 'TestPlayer'): Character => ({
        id: '',
        name,
        avatarId: 1,
        maxLife: 6,
        life: 6,
        speed: 6,
        attack: 4,
        defense: 4,
        movements: 6,
        actions: 1,
        attackDice: Dice.D4,
        defenseDice: Dice.D6,
        isActif: false,
        battlesWon: 0,
    });

    const createPlayer = (socketId: string, name = 'TestPlayer'): Player => ({
        socketId,
        character: createCharacter(name),
    });

    beforeEach(async () => {
        mockGameService = {
            findOne: jest.fn().mockResolvedValue({ name: 'TestGame', mapConfig: { size: 'Medium', tiles: [] } }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GameSessionService,
                StartingPointService,
                TurnManagementService,
                MovementService,
                CombatService,
                VirtualPlayerPathfindingService,
                VirtualPlayerTargetingService,
                VirtualPlayerMechanicsService,
                VirtualPlayerCtfService,
                VirtualPlayerService,
                { provide: GameGateway, useValue: { notifyRoomEvent: jest.fn() } },
                { provide: GameService, useValue: mockGameService },
            ],
        }).compile();

        service = module.get<GameSessionService>(GameSessionService);
    });

    describe('createGameSession', () => {
        it('devrait créer une session avec le joueur hôte', async () => {
            const host = createPlayer('host-1');
            const session = await service.createGameSession(host, 'map-1');

            expect(session).toBeDefined();
            expect(session.roomId).toBeTruthy();
            expect(session.players.length).toBe(1);
            expect(session.players[0].socketId).toBe('host-1');
        });

        it('devrait copier la carte du jeu original', async () => {
            const host = createPlayer('host-1');
            const session = await service.createGameSession(host, 'map-1');

            expect(mockGameService.findOne).toHaveBeenCalledWith('map-1');
            expect(session.mapCopy).toBeDefined();
        });

        it('devrait stocker la session dans la map interne', async () => {
            const host = createPlayer('host-1');
            const session = await service.createGameSession(host, 'map-1');

            expect(service.getGameSession(session.roomId)).toBe(session);
        });
    });

    describe('joinSession', () => {
        it('devrait permettre à un joueur de rejoindre une session valide', async () => {
            const host = createPlayer('host-1');
            const session = await service.createGameSession(host, 'map-1');

            const joiner = createPlayer('player-2', 'Joiner');
            const error = service.joinSession(session.roomId, joiner);

            expect(error).toBeNull();
            expect(session.players.length).toBe(2);
        });

        it('devrait retourner une erreur si la session est introuvable', () => {
            const player = createPlayer('player-1');
            const error = service.joinSession('INEXISTANT', player);

            expect(error).toBe('Session de jeu introuvable');
        });

        it('devrait retourner une erreur si la session a déjà commencé', async () => {
            const host = createPlayer('host-1');
            const session = await service.createGameSession(host, 'map-1');
            session.startGame();

            const player = createPlayer('player-2');
            const error = service.joinSession(session.roomId, player);

            expect(error).toBe('La session de jeu a déjà commencé');
        });

        it('devrait retourner une erreur si la session est pleine', async () => {
            const host = createPlayer('host-1');
            const session = await service.createGameSession(host, 'map-1');

            // Remplir la session (maxPlayers = 4)
            for (let i = SESSION_MIN_JOINER_INDEX; i <= SESSION_MAX_PLAYERS; i++) {
                service.joinSession(session.roomId, createPlayer(`player-${i}`, `P${i}`));
            }

            const extraPlayer = createPlayer('player-5', 'Extra');
            const error = service.joinSession(session.roomId, extraPlayer);

            expect(error).toBe('La session de jeu est pleine');
        });
    });

    describe('getAvailableGameSessions', () => {
        it('devrait retourner seulement les sessions en attente et non pleines', async () => {
            const session1 = await service.createGameSession(createPlayer('h1', 'H1'), 'map-1');
            const session2 = await service.createGameSession(createPlayer('h2', 'H2'), 'map-1');
            session2.startGame();

            const available = service.getAvailableGameSessions();

            expect(available.length).toBe(1);
            expect(available[0].roomId).toBe(session1.roomId);
        });

        it('devrait exclure les sessions pleines', async () => {
            const session = await service.createGameSession(createPlayer('h1', 'H1'), 'map-1');
            for (let i = SESSION_MIN_JOINER_INDEX; i <= SESSION_MAX_PLAYERS; i++) {
                service.joinSession(session.roomId, createPlayer(`p${i}`, `P${i}`));
            }

            const available = service.getAvailableGameSessions();
            expect(available.length).toBe(0);
        });

        it('devrait retourner une liste vide si aucune session', () => {
            expect(service.getAvailableGameSessions()).toEqual([]);
        });
    });

    describe('kickPlayer', () => {
        it('devrait retirer un joueur de la session', async () => {
            const session = await service.createGameSession(createPlayer('h1', 'H1'), 'map-1');
            service.joinSession(session.roomId, createPlayer('p2', 'P2'));

            service.kickPlayer(session.roomId, 'p2');

            expect(session.players.length).toBe(1);
            expect(session.players[0].socketId).toBe('h1');
        });

        it('ne devrait pas planter pour une session inexistante', () => {
            expect(() => service.kickPlayer('FAKE', 'p1')).not.toThrow();
        });
    });

    describe('verifyUniqueName (suffixe -2)', () => {
        it('devrait ajouter -2 si le nom est déjà pris', async () => {
            const session = await service.createGameSession(createPlayer('h1', 'Hero'), 'map-1');
            const joiner = createPlayer('p2', 'Hero');
            service.joinSession(session.roomId, joiner);

            expect(joiner.character.name).toBe('Hero-2');
        });

        it('devrait incrémenter le suffixe si -2 est déjà pris', async () => {
            const session = await service.createGameSession(createPlayer('h1', 'Hero'), 'map-1');
            service.joinSession(session.roomId, createPlayer('p2', 'Hero'));
            const third = createPlayer('p3', 'Hero');
            service.joinSession(session.roomId, third);

            expect(third.character.name).toBe('Hero-3');
        });

        it('ne devrait pas modifier un nom unique', async () => {
            const session = await service.createGameSession(createPlayer('h1', 'Host'), 'map-1');
            const joiner = createPlayer('p2', 'UniqueHero');
            service.joinSession(session.roomId, joiner);

            expect(joiner.character.name).toBe('UniqueHero');
        });

        it('ne devrait pas changer le suffixe quand un joueur avec le même nom quitte', async () => {
            const session = await service.createGameSession(createPlayer('h1', 'Hero'), 'map-1');
            const p2 = createPlayer('p2', 'Hero');
            service.joinSession(session.roomId, p2);
            expect(p2.character.name).toBe('Hero-2');

            // L'hôte "Hero" quitte
            service.kickPlayer(session.roomId, 'h1');

            // Le nom de p2 reste "Hero-2", il ne revient pas à "Hero"
            const player = session.players.find(p => p.socketId === 'p2');
            expect(player?.character.name).toBe('Hero-2');
        });

        it('devrait rendre le nom disponible après le départ d\'un joueur', async () => {
            const session = await service.createGameSession(createPlayer('h1', 'Host'), 'map-1');
            service.joinSession(session.roomId, createPlayer('p2', 'Mage'));
            service.kickPlayer(session.roomId, 'p2');

            // Le nom "Mage" devrait être à nouveau disponible
            const newJoiner = createPlayer('p3', 'Mage');
            service.joinSession(session.roomId, newJoiner);
            expect(newJoiner.character.name).toBe('Mage');
        });
    });

    describe('deleteGameSession', () => {
        it('devrait supprimer la session', async () => {
            const session = await service.createGameSession(createPlayer('h1'), 'map-1');
            service.deleteGameSession(session.roomId);

            expect(service.getGameSession(session.roomId)).toBeUndefined();
        });
    });

    describe('getAllGameSessions', () => {
        it('devrait retourner toutes les sessions', async () => {
            await service.createGameSession(createPlayer('h1', 'H1'), 'map-1');
            await service.createGameSession(createPlayer('h2', 'H2'), 'map-1');

            expect(service.getAllGameSessions().length).toBe(2);
        });
    });
});
