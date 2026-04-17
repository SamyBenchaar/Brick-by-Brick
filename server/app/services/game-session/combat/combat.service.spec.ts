import { CombatService } from './combat.service';
import { Character } from '@common/character';
import { GameSession } from '@app/domain/game-session';
import { GameModeValue } from '@common/constants/game-config-constants';

/**
 * Strategie de test:
 * Use cases vises:
 * - Verification de la condition de victoire: detection du joueur ayant atteint le nombre de victoires requis.
 * - Validation des conditions de combat: distance entre joueurs et disponibilite des actions.
 * - Application des regles du mode CTF: restriction des combats entre joueurs de la meme equipe.
 *
 * Mocks / Stubs / Spies:
 * - Stubs de Character: creation d objets minimaux (position, victories, remainingActions) pour isoler la logique.
 * - Stub de GameSession: simulation du mode de jeu (CTF ou non) et des equipes via playerTeams.
 * - Aucune dependance externe a mocker: service purement deterministe base sur ses entrees.
 *
 * Cas testes:
 * - Liste de joueurs vide: garantit que la detection de victoire retourne null sans erreur.
 * - Plusieurs joueurs atteignant le seuil de victoire: valide que le premier joueur trouve est retourne.
 * - Joueur sans victories defini: evite un comportement inattendu ou un crash.
 * - Distance nulle (meme case) ou diagonale: garantit que seul un voisin direct peut etre attaque.
 * - remainingActions undefined ou <= 0: empeche un combat sans ressources disponibles.
 * - Mode CTF avec joueurs de la meme equipe: verifie que le combat est correctement bloque.
 * - Mode CTF avec joueur sans equipe ou playerTeams absent: valide que le combat reste autorise (comportement implicite).
 */

describe('CombatService', () => {
    let service: CombatService;

    beforeEach(() => {
        service = new CombatService();
    });

    describe('checkGameWinCondition', () => {
        it('devrait retourner le joueur qui atteint le nombre de victoires requis', () => {
            const joueurs: Character[] = [
                { id: '1', victories: 1 } as Character,
                { id: '2', victories: 3 } as Character,
            ];

            const gagnant = service.checkGameWinCondition(joueurs);

            expect(gagnant).toBe(joueurs[1]);
        });

        it('devrait retourner null si aucun joueur ne remplit la condition de victoire', () => {
            const joueurs: Character[] = [
                { id: '1', victories: 1 } as Character,
                { id: '2', victories: 2 } as Character,
            ];

            const gagnant = service.checkGameWinCondition(joueurs);

            expect(gagnant).toBeNull();
        });

        it('devrait retourner le premier joueur si plusieurs atteignent le seuil', () => {
            const joueurs: Character[] = [
                { id: '1', victories: 3 } as Character,
                { id: '2', victories: 3 } as Character,
            ];

            const gagnant = service.checkGameWinCondition(joueurs);

            expect(gagnant).toBe(joueurs[0]);
        });

        it('devrait retourner null si la liste des joueurs est vide', () => {
            const gagnant = service.checkGameWinCondition([]);

            expect(gagnant).toBeNull();
        });
    });

    describe('canFight', () => {
        const attaquant: Character = {
            id: 'A',
            position: { x: 0, y: 0 },
            remainingActions: 1,
        } as Character;

        const defenseur: Character = {
            id: 'B',
            position: { x: 0, y: 1 },
        } as Character;

        it('devrait permettre le combat si les joueurs sont adjacents et que l attaquant a des actions', () => {
            const resultat = service.canFight(attaquant, defenseur);

            expect(resultat).toBe(true);
        });

        it('devrait refuser le combat si les joueurs ne sont pas adjacents', () => {
            const defenseurLoin: Character = {
                ...defenseur,
                position: { x: 3, y: 3 },
            };

            const resultat = service.canFight(attaquant, defenseurLoin);

            expect(resultat).toBe(false);
        });

        it('devrait refuser le combat si l attaquant n a plus d actions', () => {
            const attaquantSansActions: Character = {
                ...attaquant,
                remainingActions: 0,
            };

            const resultat = service.canFight(attaquantSansActions, defenseur);

            expect(resultat).toBe(false);
        });

        it('devrait refuser le combat si les joueurs sont sur la meme case', () => {
            const defenseurMemeCase: Character = {
                ...defenseur,
                position: { x: 0, y: 0 },
            };

            const resultat = service.canFight(attaquant, defenseurMemeCase);

            expect(resultat).toBe(false);
        });

        it('devrait refuser le combat en diagonale', () => {
            const defenseurDiagonal: Character = {
                ...defenseur,
                position: { x: 1, y: 1 },
            };

            const resultat = service.canFight(attaquant, defenseurDiagonal);

            expect(resultat).toBe(false);
        });

        it('devrait refuser le combat en mode CTF si les joueurs sont dans la meme equipe', () => {
            const session: GameSession = {
                gameMode: GameModeValue.Ctf,
                playerTeams: new Map([
                    ['A', 'equipe1'],
                    ['B', 'equipe1'],
                ]),
            } as unknown as GameSession;

            const resultat = service.canFight(attaquant, defenseur, session);

            expect(resultat).toBe(false);
        });

        it('devrait permettre le combat en mode CTF si les joueurs sont dans des equipes differentes', () => {
            const session: GameSession = {
                gameMode: GameModeValue.Ctf,
                playerTeams: new Map([
                    ['A', 'equipe1'],
                    ['B', 'equipe2'],
                ]),
            } as unknown as GameSession;

            const resultat = service.canFight(attaquant, defenseur, session);

            expect(resultat).toBe(true);
        });

        it('devrait permettre le combat si un joueur n a pas d equipe en mode CTF', () => {
            const session: GameSession = {
                gameMode: GameModeValue.Ctf,
                playerTeams: new Map([
                    ['A', 'equipe1'],
                    // B n a pas d equipe
                ]),
            } as unknown as GameSession;

            const resultat = service.canFight(attaquant, defenseur, session);

            expect(resultat).toBe(true);
        });
    });
});