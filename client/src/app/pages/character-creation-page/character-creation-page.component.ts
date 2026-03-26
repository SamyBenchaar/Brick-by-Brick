import { Component, computed, effect, inject, Injector, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
    AVATARS,
    BASE_ACTIONS,
    BASE_ATTACK,
    BASE_DEFENSE,
    BASE_LIFE,
    BASE_SPEED,
    BONUS_AMOUNT,
    BONUS_ATTRIBUTES,
    DICE_PROBABILITY,
    RANDOM_NAME_MAX,
} from '@app/constants/character-constants';
import { AvatarOption } from '@app/interfaces/avatar';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { Character } from '@common/character';
import { Dice } from '@common/dice';

const WAITING_ROOM_ACCESS_KEY = 'waitingRoomAccess';


@Component({
    selector: 'app-character-creation-page',
    templateUrl: './character-creation-page.component.html',
    styleUrls: ['./character-creation-page.component.scss'],
    imports: [FormsModule],
})

export class CharacterCreationPageComponent implements OnInit {
    private router = inject(Router);
    private gamePlaySocketService = inject(GamePlaySocketService);
    private gameSessionSocketService = inject(GameSessionSocketService);
    private injector = inject(Injector);
    character!: Character;
    bonusTarget: 'life' | 'speed' | null = null;
    avatars: AvatarOption[] = AVATARS;
    dice: typeof Dice = Dice;

    private route = inject(ActivatedRoute);
    roomId: string | null = null;
    gameId: string | null = null;
    fromGameCreation = false;

    takenAvatars = computed(() => new Set(this.gameSessionSocketService.takenAvatars()));

    avatarState = computed(() => {
        const taken = this.takenAvatars();

        return this.avatars.map(avatar => ({
            ...avatar,
            taken: taken.has(avatar.id),
        }));
    });


    ngOnInit(): void {
        this.gameSessionSocketService.connect();
        this.route.queryParams.subscribe(params => {
            this.gameId = params.gameId || null;
            this.roomId = params.roomId || null;
            if (this.gameId) {
                this.fromGameCreation = true;
            }

            if (this.roomId) {
                this.gameSessionSocketService.observeGameSession(this.roomId);

                effect(() => {
                    const taken = this.gameSessionSocketService.takenAvatars();

                    if (!this.character && taken.length > 0) {
                        const freeAvatar = AVATARS.find(a => !taken.includes(a.id));
                        if (!freeAvatar) {
                            alert('Toutes les places sont déjà prises ! Trop de joueurs en même temps.');
                            return;
                        }
                        this.character = this.createBaseCharacter(freeAvatar.id);
                        if (this.roomId) {
                            this.gameSessionSocketService.updateTakenAvatars(this.roomId, this.character.avatarId);
                        }
                    }
                }, { injector: this.injector });
            } else {
                this.character = this.createBaseCharacter(AVATARS[0].id);
            }
        });
    }

    createBaseCharacter(freeAvatarId: number): Character {
        return {
            id: '',
            name: '',
            avatarId: freeAvatarId,
            maxLife: BASE_LIFE,
            life: BASE_LIFE,
            speed: BASE_SPEED,
            attack: BASE_ATTACK,
            defense: BASE_DEFENSE,
            movements: BASE_SPEED,
            actions: BASE_ACTIONS,
            attackDice: Dice.D4,
            defenseDice: Dice.D6,
            isActif: false,
            battlesWon: 0,
        };
    }

    selectAvatar(avatar: AvatarOption): void {
        if (this.takenAvatars().has(avatar.id) || this.character.avatarId === avatar.id) {
            return;
        }
        this.character.avatarId = avatar.id;
        if (this.roomId) {
            this.gameSessionSocketService.updateTakenAvatars(this.roomId, avatar.id);
        }
    }

    getSelectedAvatarImage(): string {
        if (!this.avatars?.length) {
            return '';
        }
        const avatar = this.avatars.find(a => a.id === this.character.avatarId);
        return avatar?.image ?? this.avatars[0]?.image ?? '';
    }

    applyBonus(target: 'life' | 'speed') {
        this.character.life = BASE_LIFE;
        this.character.speed = BASE_SPEED;

        if (target === 'life') {
            this.character.life += BONUS_AMOUNT;
        } else {
            this.character.speed += BONUS_AMOUNT;
        }
        this.bonusTarget = target;
    }
    setDice(attribute: 'attackDice' | 'defenseDice', dice: Dice) {
        this.character[attribute] = dice;

        if (attribute === 'attackDice') {
            this.character.defenseDice = dice === Dice.D6 ? Dice.D4 : Dice.D6;
        } else {
            this.character.attackDice = dice === Dice.D6 ? Dice.D4 : Dice.D6;
        }
    }
    close() {
        this.router.navigate(['/game-creation']);
    }
    createRandomCharacter() {
        const randomName = 'Hero' + Math.floor(Math.random() * RANDOM_NAME_MAX);

        const availableAvatars = this.avatarState().filter(avatar => !avatar.taken);

        const randomAvatar = availableAvatars[Math.floor(Math.random() * availableAvatars.length)];
        this.selectAvatar(randomAvatar);

        const attributes = ['life', 'speed'] as const;
        const randomAttribute = attributes[Math.floor(Math.random() * BONUS_ATTRIBUTES.length)];

        this.character.name = randomName;

        this.applyBonus(randomAttribute as 'life' | 'speed');

        this.character.attackDice = Math.random() < DICE_PROBABILITY ? Dice.D4 : Dice.D6;
        this.character.defenseDice = this.character.attackDice === Dice.D6 ? Dice.D4 : Dice.D6;
    }
    submitCharacter() {
        if (!this.gameId && !this.roomId) {
            alert('Erreur: Identifiant de session manquant. Veuillez revenir à la page précédente.');
            return;
        }

        sessionStorage.setItem('playerUsername', this.character.name);

        if (this.fromGameCreation && this.gameId) {

            this.gameSessionSocketService.currentSession.set(null);
            this.gameSessionSocketService.roomId.set('');
            this.gamePlaySocketService.mapCopy.set(null);

            // Le créateur: créer la session et attendre que le roomId soit reçu du serveur
            this.gameSessionSocketService.createGameSession(this.gameId, this.character);

            effect(() => {
                const roomId = this.gameSessionSocketService.currentSession()?.roomId;
                if (roomId && roomId !== '') {
                    sessionStorage.setItem(WAITING_ROOM_ACCESS_KEY, 'true');
                    this.router.navigate(['/waiting-room', roomId]);
                }
            }, { injector: this.injector });
        } else if (this.roomId) {
            this.gameSessionSocketService.joinGameSession(this.roomId, this.character);
            sessionStorage.setItem(WAITING_ROOM_ACCESS_KEY, 'true');
            this.router.navigate(['/waiting-room', this.roomId]);
        }
    }
    submitHover = false;

    onSubmitHover(isHovering: boolean): void {
        this.submitHover = isHovering;
    }

    isSubmitDisabled(): boolean {
        return !this.character.name || !this.bonusTarget || this.character.name.includes(' ');
    }


    getTooltipText(): string {
        let text = 'Attention:\n';
        if (this.character.name.includes(' ')) {
            text += '- Le nom ne peut pas contenir d\'espaces\n';
        }

        if (!this.character.name) {
            text += '- Le nom du personnage\n';
        }
        if (!this.bonusTarget) {
            text += '- Le bonus\n';
        }
        return text;
    }
}