import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Character, Dice } from '@app/interfaces/character-model';
import {BASE_LIFE, BASE_SPEED, BASE_ATTACK, BASE_DEFENSE, 
    BONUS_AMOUNT, AVATARS, BONUS_ATTRIBUTES, RANDOM_NAME_MAX, DICE_PROBABILITY} from '@app/constants/character.constants';

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
    character: Character = this.createBaseCharacter();
    bonusTarget: 'life' | 'speed' | null = null;
    avatars = AVATARS;

    createBaseCharacter(): Character {
    return {
        name: '',
        avatarId: 1,
        life: BASE_LIFE,
        speed: BASE_SPEED,
        attack: BASE_ATTACK,
        defense: BASE_DEFENSE,
        attackDice: 'D4',
        defenseDice: 'D6',
    };
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

        this.character[target] += BONUS_AMOUNT;
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
        this.router.navigate(['/waiting-room']);
    }
    submitHover = false;

    onSubmitHover(isHovering: boolean): void {
        this.submitHover = isHovering;
    }

    getTooltipText(): string { 
        let text = 'Il manque:\n';
        if (!this.character.name) {
            text += '- Le nom du personnage\n';
        }
        if (!this.bonusTarget) {
            text += '- Le bonus\n';
        }
        return text;
    }
}