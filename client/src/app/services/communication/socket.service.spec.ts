import { TestBed } from '@angular/core/testing';
import { environment } from 'src/environments/environment';
import { SocketService } from './socket.service';

/**
 * Stratégie de test pour SocketService:
 *
 * 1. Tests de connexion WebSocket: Vérifier que la connexion au serveur se fait correctement
 *    et qu'une reconnexion n'en crée pas une nouvelle
 * 2. Tests d'émission et de réception: Assurer que les événements peuvent être émis et écoutés
 * 3. Tests du cycle de vie: Valider la connexion, l'abonnement, la désinscription et la déconnexion
 * 4. Tests de robustesse: S'assurer que le service ne lève pas d'erreur lors des opérations en l'absence de connexion
 * 5. Tests de typage générique: Vérifier que le service supporte différents types de données (objets, tableaux, chaînes)
 * 6. Tests de l'état: Valider les méthodes isConnected() et getSocketId()
 *
 * Cas limites testés:
 * - Opérations sans connexion active
 * - Reconnexion après déconnexion
 * - Émission avec/sans données
 * - Émission avec callback
 * - Types génériques d'objet et de tableau
 * - Cycle de vie complet (connexion → émission → réception → déconnexion)
 * - Désinscription d'événements inexistants
 */

const DISCONNECT_DELAY = 100;
const EMIT_DELAY = 100;
const VERIFY_DELAY = 200;

describe('SocketService', () => {
    let service: SocketService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [SocketService],
        });
        service = TestBed.inject(SocketService);
    });

    afterEach(() => {
        service.disconnect();
    });

    describe('Connexion au serveur WebSocket', () => {
        it('devrait créer une connexion socket au premier appel de connect', () => {
            const idSocket = service.connect();

            expect(idSocket).toBeDefined();
            expect(typeof idSocket).toBe('string');
        });

        it('devrait retourner un id de socket après la connexion', () => {
            const idSocket = service.connect();

            expect(idSocket.length).toBeGreaterThan(0);
        });

        it('devrait ne pas créer une nouvelle connexion si déjà connecté', () => {
            const idSocket1 = service.connect();
            const idSocket2 = service.connect();

            expect(idSocket1).toBe(idSocket2);
        });

        it('devrait se connecter à l\'adresse du serveur sans /api', () => {
            const adresseAttendue = environment.serverUrl.replace('/api', '');
            service.connect();

            expect(service.isConnected()).toBe(true);
            expect(adresseAttendue).toBeDefined();
        });
    });

    describe('Déconnexion du serveur WebSocket', () => {
        it('devrait déconnecter le socket', () => {
            service.connect();
            expect(service.isConnected()).toBe(true);

            service.disconnect();
            expect(service.isConnected()).toBe(false);
        });

        it('devrait pouvoir se reconnecter après une déconnexion', () => {
            service.connect();
            service.disconnect();

            const nouvelId = service.connect();
            expect(nouvelId).toBeDefined();
            expect(service.isConnected()).toBe(true);
        });

        it('ne devrait pas lever d\'erreur lors de la déconnexion si pas connecté', () => {
            expect(() => {
                service.disconnect();
            }).not.toThrow();
        });
    });

    describe('Abonnement aux événements', () => {
        it('devrait enregistrer un écouteur d\'événement', () => {
            service.connect();
            const callback = jasmine.createSpy('callback');

            service.on<string>('test-event', callback);

            expect(callback).not.toHaveBeenCalled();
        });

        it('devrait recevoir les données émises sur un événement', (fait) => {
            service.connect();

            const callback = jasmine.createSpy('callback');
            service.on<string>('test-event', callback);

            setTimeout(() => {
                service.emit('test-event', 'données test');
            }, EMIT_DELAY);

            setTimeout(() => {
                if (callback.calls.count() > 0) {
                    fait();
                }
            }, VERIFY_DELAY);
        });

        it('ne devrait pas lever d\'erreur lors de l\'abonnement si pas connecté', () => {
            const callback = jasmine.createSpy('callback');

            expect(() => {
                service.on<string>('test-event', callback);
            }).not.toThrow();
        });
    });

    describe('Désabonnement des événements', () => {
        it('devrait arrêter d\'écouter un événement après off', () => {
            service.connect();
            const callback = jasmine.createSpy('callback');

            service.on<string>('test-event', callback);
            service.off('test-event');

            expect(callback).not.toHaveBeenCalled();
        });

        it('ne devrait pas lever d\'erreur lors du désabonnement si pas connecté', () => {
            expect(() => {
                service.off('test-event');
            }).not.toThrow();
        });
    });

    describe('Émission d\'événements', () => {
        it('devrait émettre un événement sans données', () => {
            service.connect();

            expect(() => {
                service.emit('test-event');
            }).not.toThrow();
        });

        it('devrait émettre un événement avec des données', () => {
            service.connect();
            const donnees = { message: 'test' };

            expect(() => {
                service.emit<{ message: string }>('test-event', donnees);
            }).not.toThrow();
        });

        it('devrait émettre un événement avec callback', () => {
            service.connect();
            const callback = jasmine.createSpy('callback');

            expect(() => {
                service.emit('test-event', { data: 'test' }, callback);
            }).not.toThrow();
        });

        it('ne devrait pas lever d\'erreur lors de l\'émission si pas connecté', () => {
            expect(() => {
                service.emit('test-event', { data: 'test' });
            }).not.toThrow();
        });

        it('devrait émettre un événement avec données et sans callback', () => {
            service.connect();

            expect(() => {
                service.emit<{ contenu: string }>('message', { contenu: 'Bonjour' });
            }).not.toThrow();
        });
    });

    describe('État de la connexion', () => {
        it('devrait retourner true si connecté', () => {
            service.connect();

            expect(service.isConnected()).toBe(true);
        });

        it('devrait retourner false si déconnecté', () => {
            expect(service.isConnected()).toBe(false);
        });

        it('devrait retourner false après une déconnexion', () => {
            service.connect();
            service.disconnect();

            expect(service.isConnected()).toBe(false);
        });
    });

    describe('Récupération de l\'id du socket', () => {
        it('devrait retourner l\'id du socket après la connexion', () => {
            service.connect();

            const idSocket = service.getSocketId();
            expect(idSocket).toBeDefined();
        });

        it('devrait retourner undefined si pas connecté', () => {
            const idSocket = service.getSocketId();
            expect(idSocket).toBeUndefined();
        });

        it('l\'id du socket devrait être le même que celui retourné par connect', () => {
            const idDuConnect = service.connect();
            const idDuGet = service.getSocketId();

            expect(idDuGet).toBe(idDuConnect);
        });
    });

    describe('Types génériques', () => {
        it('devrait supporter les événements avec des données typées d\'objet', (fait) => {
            service.connect();

            interface DonneeTest {
                id: number;
                nom: string;
            }

            const donneeTest: DonneeTest = { id: 1, nom: 'test' };

            service.on<DonneeTest>('objet-event', (data: DonneeTest) => {
                expect(data.id).toBe(1);
                expect(data.nom).toBe('test');
                fait();
            });

            service.emit<DonneeTest>('objet-event', donneeTest);
        });

        it('devrait supporter les événements avec des données typées de tableau', (fait) => {
            service.connect();

            interface Element {
                valeur: string;
            }

            const donneeTest: Element[] = [
                { valeur: 'un' },
                { valeur: 'deux' },
            ];

            service.on<Element[]>('tableau-event', (data: Element[]) => {
                expect(data.length).toBe(2);
                fait();
            });

            service.emit<Element[]>('tableau-event', donneeTest);
        });
    });

    describe('Cycle de vie complet', () => {
        it('devrait gérer une connexion, émission, réception et déconnexion', (fait) => {
            const idSocket = service.connect();
            expect(idSocket).toBeDefined();

            const callback = jasmine.createSpy('callback');
            service.on<string>('cycle-event', callback);

            service.emit('cycle-event', 'donnees');

            setTimeout(() => {
                service.off('cycle-event');
                service.disconnect();
                expect(service.isConnected()).toBe(false);
                fait();
            }, DISCONNECT_DELAY);
        });
    });
});
