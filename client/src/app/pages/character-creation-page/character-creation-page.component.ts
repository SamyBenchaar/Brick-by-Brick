import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
    AVATARS,
    BASE_ATTACK, BASE_DEFENSE,
    BASE_LIFE, BASE_SPEED,
    BONUS_AMOUNT,
    BONUS_ATTRIBUTES,
    DICE_PROBABILITY,
    RANDOM_NAME_MAX,
} from '@app/constants/character.constants';
import { Dice } from '@common/dice';
import { Character } from '@common/character';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket.service';
import { ActivatedRoute } from '@angular/router';

interface AvatarOption {
    id: number;
    name: string;
    image: string;
}

@Component({
    selector: 'app-character-creation-page',
    templateUrl: './character-creation-page.component.html',
    styleUrls: ['./character-creation-page.component.scss'],
    imports: [FormsModule],
})

export class CharacterCreationPageComponent {
    private router = inject(Router);
    private gameSessionSocketService = inject(GameSessionSocketService);
    character: Character = this.createBaseCharacter();
    bonusTarget: 'life' | 'speed' | null = null;
    avatars = AVATARS;
    
    private route = inject(ActivatedRoute);
    roomId: string | null = null;
    gameId: string | null = null;
    fromGameCreation = false;
    
    ngOnInit(): void {
        this.gameSessionSocketService.connect();
        this.route.queryParams.subscribe(params => {
        this.gameId = params['gameId'] || null;
        this.roomId = params['roomId'] || null;

        if (this.gameId) {
            this.fromGameCreation = true;
        }});
    }

    createBaseCharacter(): Character {
        return new Character('', 1, BASE_LIFE, BASE_SPEED, BASE_ATTACK, BASE_DEFENSE, 'D4', 'D6');
    }

    selectAvatar(avatar: AvatarOption): void {
        this.character.avatarId = avatar.id;
    }

    getSelectedAvatarImage(): string {
        const avatar = this.avatars.find(a => a.id === this.character.avatarId);
        return avatar ? avatar.image : this.avatars[0].image;
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
            this.character.defenseDice = dice === 'D6' ? 'D4' : 'D6';
        } else {
            this.character.attackDice = dice === 'D6' ? 'D4' : 'D6';
        }
    }
    close() {
        this.router.navigate(['/game-creation']);
    }
    createRandomCharacter() {
        const randomName = 'Hero' + Math.floor(Math.random() * RANDOM_NAME_MAX);
        const randomAvatarId = Math.floor(Math.random() * this.avatars.length) + 1;
        const attributes = ['life', 'speed'] as const;
        const randomAttribute = attributes[Math.floor(Math.random() * BONUS_ATTRIBUTES.length)];

        this.character.name = randomName;
        this.character.avatarId = randomAvatarId;

        this.applyBonus(randomAttribute as 'life' | 'speed');

        this.character.attackDice = Math.random() < DICE_PROBABILITY ? 'D4' : 'D6';
        this.character.defenseDice = this.character.attackDice === 'D6' ? 'D4' : 'D6';
    }
    submitCharacter() {
        if(this.fromGameCreation && this.gameId) {
            this.gameSessionSocketService.createGameSession(this.gameId, this.character)
            this.router.navigate(['/waiting-room']);
        } else if (this.roomId) {
            this.gameSessionSocketService.joinGameSession(this.roomId, this.character);
            this.router.navigate(['/waiting-room']);
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