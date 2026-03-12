import { TestBed } from '@angular/core/testing';
import { SocketService } from './socket.service';

describe('SocketService', () => {
    let service: SocketService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(SocketService);
    });

    it('devrait être créé', () => {
        expect(service).toBeTruthy();
    });

    it('devrait retourner false pour isConnected avant connexion', () => {
        expect(service.isConnected()).toBe(false);
    });

    it('devrait retourner undefined pour getSocketId avant connexion', () => {
        expect(service.getSocketId()).toBeUndefined();
    });

    it('ne devrait rien faire lors du disconnect sans connexion', () => {
        expect(() => service.disconnect()).not.toThrow();
    });

    it('ne devrait rien faire lors du on sans connexion', () => {
        const callback = jasmine.createSpy('callback');
        expect(() => service.on('test', callback)).not.toThrow();
    });

    it('ne devrait rien faire lors du off sans connexion', () => {
        expect(() => service.off('test')).not.toThrow();
    });

    it('ne devrait rien faire lors du emit sans connexion', () => {
        expect(() => service.emit('test')).not.toThrow();
    });

    describe('on / emit avec socket mockée', () => {
        let mockSocket: { on: jasmine.Spy; off: jasmine.Spy; emit: jasmine.Spy; disconnect: jasmine.Spy; connected: boolean; id: string };

        beforeEach(() => {
            mockSocket = {
                on: jasmine.createSpy('on'),
                off: jasmine.createSpy('off'),
                emit: jasmine.createSpy('emit'),
                disconnect: jasmine.createSpy('disconnect'),
                connected: true,
                id: 'mock-id',
            };
            // Injecter la fausse socket dans le service
            (service as unknown as { socket: typeof mockSocket }).socket = mockSocket;
        });

        it('devrait enregistrer le callback sur la socket lors de on', () => {
            const callback = jasmine.createSpy('callback');
            service.on('testEvent', callback);

            expect(mockSocket.on).toHaveBeenCalledWith('testEvent', callback);
        });

        it('devrait appeler le callback quand la socket reçoit l\'événement', () => {
            const callback = jasmine.createSpy('callback');

            // Simuler le comportement réel : quand on() est appelé, stocker le handler
            mockSocket.on.and.callFake((event: string, handler: Function) => {
                // Simuler immédiatement la réception de l'événement
                handler({ data: 'test-payload' });
            });

            service.on('testEvent', callback);

            expect(callback).toHaveBeenCalledWith({ data: 'test-payload' });
        });

        it('devrait retirer le listener lors de off', () => {
            service.off('testEvent');
            expect(mockSocket.off).toHaveBeenCalledWith('testEvent');
        });

        it('devrait émettre un événement avec données via emit', () => {
            service.emit('testEvent', { key: 'value' });
            expect(mockSocket.emit).toHaveBeenCalledWith('testEvent', { key: 'value' });
        });

        it('devrait émettre un événement sans données via emit', () => {
            service.emit('testEvent');
            expect(mockSocket.emit).toHaveBeenCalledWith('testEvent');
        });

        it('devrait retourner true pour isConnected quand la socket est connectée', () => {
            expect(service.isConnected()).toBe(true);
        });

        it('devrait retourner l\'id de la socket', () => {
            expect(service.getSocketId()).toBe('mock-id');
        });
    });
});
