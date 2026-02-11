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
});
