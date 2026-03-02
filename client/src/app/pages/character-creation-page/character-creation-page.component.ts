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
        return new Character('', 1, BASE_LIFE, BASE_SPEED, BASE_ATTACK, BASE_DEFENSE, 'D4', 'D6');
    }

    selectAvatar(avatar: AvatarOption): void {
        this.character.setAvatarId(avatar.id);
    }

    getSelectedAvatarImage(): string {
        const avatar = this.avatars.find(a => a.id === this.character.getAvatarId());
        return avatar ? avatar.image : this.avatars[0].image;
    }

    applyBonus(target: 'life' | 'speed') {
        this.character.setLife(BASE_LIFE);
        this.character.setSpeed(BASE_SPEED);

        if (target === 'life') {
            this.character.setLife(this.character.getLife() + BONUS_AMOUNT);
        } else {
            this.character.setSpeed(this.character.getSpeed() + BONUS_AMOUNT);
        }
        this.bonusTarget = target;
    }
    setDice(attribute: 'attackDice' | 'defenseDice', dice: Dice) {
        this.character[attribute] = dice;

        if (attribute === 'attackDice') {
            this.character.setDefenseDice(dice === 'D6' ? 'D4' : 'D6');
        } else {
            this.character.setAttackDice(dice === 'D6' ? 'D4' : 'D6');
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

        this.character.setName(randomName);
        this.character.setAvatarId(randomAvatarId);

        this.applyBonus(randomAttribute as 'life' | 'speed');

        this.character.setAttackDice(Math.random() < DICE_PROBABILITY ? 'D4' : 'D6');
        this.character.setDefenseDice(this.character.getAttackDice() === 'D6' ? 'D4' : 'D6');
    }
    submitCharacter() {
        this.router.navigate(['/waiting-room']);
    }
    submitHover = false;

    onSubmitHover(isHovering: boolean): void {
        this.submitHover = isHovering;
    }

    isSubmitDisabled(): boolean {
        return !this.character.getName() || !this.bonusTarget || this.character.getName().includes(' ');
    }


    getTooltipText(): string {
        let text = 'Attention:\n';
        if (this.character.getName().includes(' ')) {
            text += '- Le nom ne peut pas contenir d\'espaces\n';
        }

        if (!this.character.getName()) {
            text += '- Le nom du personnage\n';
        }
        if (!this.bonusTarget) {
            text += '- Le bonus\n';
        }
        return text;
    }
}